import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { Story } from '../database/entities/story.entity';
import { NotificationsService } from './notifications.service';
import { StoryProgressService } from './story-progress.service';
import { NotificationType } from './notification-type.enum';
import { StoryIllustrationStatus } from '../illustration/enums/story-illustration-status.enum';

describe('StoryProgressService', () => {
  let service: StoryProgressService;
  let storyRepo: { save: jest.Mock };
  let notifications: {
    create: jest.Mock;
    hasDailyLimitNotification: jest.Mock;
  };

  function makeStory(overrides: Partial<Story> = {}): Story {
    return Object.assign(new Story(), {
      id: 'story-1',
      userId: 'user-1',
      title: 'Story',
      illustrationGenerationNotifiedAt: null,
      ...overrides,
    });
  }

  function makeProgress(overrides: Partial<any> = {}): any {
    return {
      status: StoryIllustrationStatus.COMPLETED,
      progress: 1,
      totalPages: 1,
      completed: 1,
      failed: 0,
      ...overrides,
    };
  }

  beforeEach(async () => {
    storyRepo = {
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      findOne: jest.fn().mockResolvedValue(null),
    };
    notifications = {
      create: jest.fn().mockResolvedValue({}),
      hasDailyLimitNotification: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        StoryProgressService,
        { provide: getRepositoryToken(Story), useValue: storyRepo },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(StoryProgressService);
  });

  describe('storyRoom', () => {
    it('formats the room as story:<id>', () => {
      expect(StoryProgressService.storyRoom('abc')).toBe('story:abc');
    });
  });

  describe('onChangeStatus', () => {
    it('emits progress for a terminal status', async () => {
      const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      service.setServer(io as unknown as Server);

      const story = makeStory();
      await service.onChangeStatus(story, makeProgress());

      expect(io.to).toHaveBeenCalledWith('story:story-1');
      expect(io.to).toHaveBeenCalledWith('user:user-1');
      expect(io.emit).toHaveBeenCalledWith(
        'story.progress',
        expect.any(Object),
      );
    });

    it('sends a completion notification once per generation run', async () => {
      service.setServer({
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as unknown as Server);

      const story = makeStory();
      await service.onChangeStatus(story, makeProgress());

      expect(notifications.create).toHaveBeenCalledWith(
        'user-1',
        NotificationType.STORY_GENERATION_COMPLETED,
        'Story illustrated',
        expect.any(String),
        expect.objectContaining({ storyId: 'story-1' }),
      );
      expect(story.illustrationGenerationNotifiedAt).not.toBeNull();
      expect(storyRepo.save).toHaveBeenCalledWith(story);

      notifications.create.mockClear();
      await service.onChangeStatus(story, makeProgress());
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('sends a failure notification and emits story.failed', async () => {
      const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      service.setServer(io as unknown as Server);

      await service.onChangeStatus(
        makeStory(),
        makeProgress({ status: StoryIllustrationStatus.FAILED, failed: 1 }),
      );

      expect(notifications.create).toHaveBeenCalledWith(
        'user-1',
        NotificationType.STORY_GENERATION_FAILED,
        'Story illustration failed',
        expect.any(String),
        expect.any(Object),
      );
      expect(io.emit).toHaveBeenCalledWith('story.failed', expect.any(Object));
    });
  });

  describe('notifyPageCompleted', () => {
    it('creates a notification and emits page completed', async () => {
      const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      service.setServer(io as unknown as Server);

      await service.notifyPageCompleted(
        'story-1',
        'user-1',
        'page-1',
        1,
        'img',
      );

      expect(notifications.create).toHaveBeenCalledWith(
        'user-1',
        NotificationType.STORY_PAGE_COMPLETED,
        'Page 1 illustrated',
        expect.any(String),
        expect.objectContaining({ pageId: 'page-1', imageUrl: 'img' }),
      );
      expect(io.emit).toHaveBeenCalledWith(
        'story.pageCompleted',
        expect.any(Object),
      );
    });
  });

  describe('notifyGenerationStarted', () => {
    it('creates a started notification', async () => {
      // make the repository return a story with an active attempt claim
      (storyRepo.findOne as jest.Mock).mockResolvedValue(
        makeStory({ illustrationGenerationAttemptId: 'attempt-1' }),
      );

      await service.notifyGenerationStarted('user-1', 'story-1', 'Story', 3);

      expect(notifications.create).toHaveBeenCalledWith(
        'user-1',
        NotificationType.STORY_GENERATION_STARTED,
        'Story illustration started',
        expect.any(String),
        { storyId: 'story-1', totalPages: 3 },
      );
    });
  });

  describe('notifyDailyLimitReached', () => {
    it('skips when a daily-limit notification already exists', async () => {
      notifications.hasDailyLimitNotification.mockResolvedValue(true);
      await service.notifyDailyLimitReached('user-1', 'story-1');
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('creates a daily-limit notification when none exists', async () => {
      notifications.hasDailyLimitNotification.mockResolvedValue(false);
      await service.notifyDailyLimitReached('user-1', 'story-1');

      expect(notifications.create).toHaveBeenCalledWith(
        'user-1',
        NotificationType.AI_DAILY_LIMIT_REACHED,
        'Daily AI limit reached',
        expect.any(String),
        { storyId: 'story-1' },
      );
    });
  });
});
