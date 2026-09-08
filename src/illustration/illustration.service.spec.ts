import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { Story } from '../database/entities/story.entity';
import { StoryPage } from '../database/entities/story-page.entity';
import { UserRole } from '../database/entities/user.entity';
import { StoryStatus } from '../common/enums/story-status.enum';
import { IllustrationPageStatus } from './enums/illustration-page-status.enum';
import { StoryIllustrationStatus } from './enums/story-illustration-status.enum';
import {
  ILLUSTRATION_QUEUE,
  ILLUSTRATION_JOB_PREFIX,
} from './illustration.constants';
import { IllustrationService } from './illustration.service';
import { ScenePromptService } from './services/scene-prompt.service';
import { IllustrationStatusService } from './services/illustration-status.service';
import { StoryProgressService } from '../notifications/story-progress.service';
import { RedisService } from '../config/redis.service';
import { StoryTranslationService } from './services/story-translation.service';
import { StoryIllustrationEligibilityService } from './services/story-illustration-eligibility.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { AuditLogService } from '../admin/audit/audit-log.service';
import { StoryOptionsService } from '../modules/story-options/story-options.service';

describe('IllustrationService', () => {
  let service: IllustrationService;
  let storyRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let pageRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let queue: {
    add: jest.Mock;
  };
  let redisService: {
    getClient: jest.Mock;
  };

  const ownerId = 'user-1';
  const otherId = 'user-2';

  function makeStory(overrides: Partial<Story> = {}): Story {
    return Object.assign(new Story(), {
      id: 'story-1',
      userId: ownerId,
      title: 'Story',
      status: StoryStatus.READY,
      illustrationStatus: StoryIllustrationStatus.NOT_STARTED,
      pages: [],
      ...overrides,
    });
  }

  function makePage(overrides: Partial<StoryPage> = {}): StoryPage {
    return Object.assign(new StoryPage(), {
      id: 'page-1',
      storyId: 'story-1',
      pageNumber: 1,
      text: 'text',
      imageStatus: IllustrationPageStatus.PENDING,
      imagePrompt: null,
      imageError: null,
      ...overrides,
    });
  }

  beforeEach(async () => {
    storyRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      }),
    };
    pageRepo = { findOne: jest.fn(), save: jest.fn(), find: jest.fn() };
    queue = { add: jest.fn().mockResolvedValue({ id: 'job' }) };
    redisService = {
      getClient: jest.fn().mockReturnValue({
        eval: jest.fn().mockResolvedValue([1, 1]),
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        IllustrationService,
        {
          provide: getRepositoryToken(Story),
          useValue: storyRepo,
        },
        {
          provide: getRepositoryToken(StoryPage),
          useValue: pageRepo,
        },
        {
          provide: ILLUSTRATION_QUEUE,
          useValue: queue,
        },
        {
          provide: ScenePromptService,
          useValue: {
            buildImagePrompt: jest.fn().mockReturnValue('prompt'),
            buildCoverPrompt: jest.fn().mockReturnValue('cover prompt'),
          },
        },
        {
          provide: IllustrationStatusService,
          useValue: {
            computeStatus: jest.fn(() => ({ status: 'GENERATING' })),
          },
        },
        {
          provide: StoryProgressService,
          useValue: {
            setServer: jest.fn(),
            notifyGenerationStarted: jest.fn().mockResolvedValue(undefined),
            notifyPageCompleted: jest.fn(),
            onChangeStatus: jest.fn(),
            emitProgress: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: StoryTranslationService,
          useValue: {
            translateForVisual: jest.fn((text: string) =>
              Promise.resolve(text),
            ),
          },
        },
        {
          provide: StoryIllustrationEligibilityService,
          useValue: {
            assertCanGenerate: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AiUsageService,
          useValue: {
            recordUsage: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: StoryOptionsService,
          useValue: {
            resolveNames: jest
              .fn()
              .mockResolvedValue({
                genreName: null,
                eraName: null,
                civilizationName: null,
              }),
          },
        },
      ],
    }).compile();

    service = module.get(IllustrationService);
  });

  describe('queueStoryIllustrations', () => {
    it('creates jobs for eligible pages', async () => {
      const pages = [makePage(), makePage({ id: 'page-2', pageNumber: 2 })];
      storyRepo.findOne.mockResolvedValue(makeStory({ pages }));
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.queueStoryIllustrations(
        ownerId,
        'story-1',
        {},
      );

      expect(result.queuedPages).toBe(3);
      expect(result.totalPages).toBe(2);
      expect(queue.add).toHaveBeenCalledTimes(3);
      expect(queue.add).toHaveBeenCalledWith(
        'illustrate-page',
        expect.any(Object),
        {
          jobId: expect.stringContaining(`${ILLUSTRATION_JOB_PREFIX}-page-1-`),
        },
      );
    });

    it('skips pages already queued/generating/uploading', async () => {
      const pages = [
        makePage(),
        makePage({
          id: 'page-2',
          pageNumber: 2,
          imageStatus: IllustrationPageStatus.GENERATING,
        }),
      ];
      storyRepo.findOne.mockResolvedValue(makeStory({ pages }));
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.queueStoryIllustrations(
        ownerId,
        'story-1',
        {},
      );

      expect(result.queuedPages).toBe(2);
      expect(queue.add).toHaveBeenCalledTimes(2);
    });

    it('skips completed pages unless regenerate is requested', async () => {
      const pages = [
        makePage({
          id: 'page-1',
          imageStatus: IllustrationPageStatus.COMPLETED,
          imageUrl: 'http://img',
        }),
        makePage({
          id: 'page-2',
          pageNumber: 2,
          imageStatus: IllustrationPageStatus.COMPLETED,
          imageUrl: 'http://img2',
        }),
      ];
      storyRepo.findOne.mockResolvedValue(makeStory({ pages }));
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.queueStoryIllustrations(
        ownerId,
        'story-1',
        {},
      );
      expect(result.queuedPages).toBe(1);
    });

    it('regenerates completed pages when regenerate is true', async () => {
      const pages = [
        makePage({
          imageStatus: IllustrationPageStatus.COMPLETED,
          imageUrl: 'http://img',
        }),
      ];
      storyRepo.findOne.mockResolvedValue(makeStory({ pages }));
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.queueStoryIllustrations(ownerId, 'story-1', {
        regenerate: true,
      });
      expect(result.queuedPages).toBe(2);
    });

    it('rejects non-owners', async () => {
      storyRepo.findOne.mockResolvedValue(makeStory());
      await expect(
        service.queueStoryIllustrations(otherId, 'story-1', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects missing stories', async () => {
      storyRepo.findOne.mockResolvedValue(null);
      await expect(
        service.queueStoryIllustrations(ownerId, 'missing', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('blocks USER roles after the daily 4 image limit is exhausted', async () => {
      const pages = [makePage(), makePage({ id: 'page-2', pageNumber: 2 })];
      storyRepo.findOne.mockResolvedValue(
        makeStory({
          pages,
          user: { role: UserRole.USER } as any,
        }),
      );
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));
      redisService.getClient.mockReturnValue({
        eval: jest.fn().mockResolvedValue([0, 4]),
      });

      await expect(
        service.queueStoryIllustrations(ownerId, 'story-1', {}),
      ).rejects.toBeInstanceOf(HttpException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('rejects stories that are not READY', async () => {
      storyRepo.findOne.mockResolvedValue(
        makeStory({ status: StoryStatus.DRAFT }),
      );
      await expect(
        service.queueStoryIllustrations(ownerId, 'story-1', {}),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('clears a stale generation lock before queueing a new attempt', async () => {
      const pages = [makePage()];
      storyRepo.findOne.mockResolvedValue(
        makeStory({
          pages,
          illustrationGenerationAttemptId: 'stale-attempt',
        }),
      );
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));
      storyRepo.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      });
      (service as any).illustrationStatusService.computeStatus = jest.fn(() => ({
        status: StoryIllustrationStatus.FAILED,
      }));

      await service.queueStoryIllustrations(ownerId, 'story-1', {});

      expect(queue.add).toHaveBeenCalled();
      expect(storyRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('regeneratePage', () => {
    it('queues a job for a completed page', async () => {
      const page = makePage({
        imageStatus: IllustrationPageStatus.COMPLETED,
        imageUrl: 'http://old',
      });
      storyRepo.findOne.mockResolvedValue(makeStory());
      pageRepo.findOne.mockResolvedValue(page);
      pageRepo.find.mockResolvedValue([page]);
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.regeneratePage(ownerId, 'story-1', 'page-1');

      expect(result.pageId).toBe('page-1');
      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith(
        'illustrate-page',
        expect.any(Object),
        {
          jobId: expect.stringContaining(`${ILLUSTRATION_JOB_PREFIX}-page-1-`),
        },
      );
    });

    it('passes overrides into the centralized prompt builder', async () => {
      const page = makePage({
        imageStatus: IllustrationPageStatus.COMPLETED,
        imageUrl: 'http://old',
      });
      storyRepo.findOne.mockResolvedValue(makeStory());
      pageRepo.findOne.mockResolvedValue(page);
      pageRepo.find.mockResolvedValue([page]);
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));

      await service.regeneratePage(ownerId, 'story-1', 'page-1', {
        civilization: 'ANCIENT_EGYPTIAN' as any,
        theme: 'HORROR' as any,
      });

      expect(
        (service as any).scenePromptService.buildImagePrompt,
      ).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          civilization: 'ANCIENT_EGYPTIAN',
          theme: 'HORROR',
        }),
      );
    });

    it('blocks regeneration of a page already generating', async () => {
      const page = makePage({ imageStatus: IllustrationPageStatus.GENERATING });
      storyRepo.findOne.mockResolvedValue(makeStory());
      pageRepo.findOne.mockResolvedValue(page);

      await expect(
        service.regeneratePage(ownerId, 'story-1', 'page-1'),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('rejects non-owners', async () => {
      storyRepo.findOne.mockResolvedValue(makeStory());
      await expect(
        service.regeneratePage(otherId, 'story-1', 'page-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks regeneration when the daily user limit is exhausted', async () => {
      const page = makePage({
        imageStatus: IllustrationPageStatus.COMPLETED,
        imageUrl: 'http://old',
      });
      storyRepo.findOne.mockResolvedValue(
        makeStory({ user: { role: UserRole.USER } as any }),
      );
      pageRepo.findOne.mockResolvedValue(page);
      redisService.getClient.mockReturnValue({
        eval: jest.fn().mockResolvedValue([0, 4]),
      });

      await expect(
        service.regeneratePage(ownerId, 'story-1', 'page-1'),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('rejects a page that does not belong to the story', async () => {
      storyRepo.findOne.mockResolvedValue(makeStory());
      pageRepo.findOne.mockResolvedValue(null);

      await expect(
        service.regeneratePage(ownerId, 'story-1', 'page-other'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
