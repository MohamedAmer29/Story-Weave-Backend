import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Story } from '../database/entities/story.entity';
import { StoryPage } from '../database/entities/story-page.entity';
import { IllustrationPageStatus } from './enums/illustration-page-status.enum';
import { StoryIllustrationStatus } from './enums/story-illustration-status.enum';
import { BULLMQ_CONNECTION } from '../bullmq/bullmq.constants';
import { IllustrationProcessor } from './illustration.processor';
import { CloudflareProvider } from '../modules/ai/providers/cloudflare.provider';
import { AiUsageService } from '../ai/ai-usage.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { IllustrationStatusService } from './services/illustration-status.service';
import { StoryProgressService } from '../notifications/story-progress.service';
import { PublicCacheService } from '../common/services/public-cache.service';
import { PromptValidationService } from './services/prompt-validation.service';

function makeJob(overrides: Partial<any> = {}): any {
  const job: any = {
    id: 'job-1',
    data: {
      storyId: 'story-1',
      storyPageId: 'page-1',
      userId: 'user-1',
      prompt: 'prompt',
    },
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...overrides,
  };
  return job;
}

describe('IllustrationProcessor', () => {
  let processor: IllustrationProcessor;
  let pageRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let storyRepo: {
    update: jest.Mock;
  };
  let cloudflare: { generateImage: jest.Mock };
  let usage: { canMakeRequest: jest.Mock };
  let cloudinary: { uploadImage: jest.Mock; deleteImage: jest.Mock };

  beforeEach(async () => {
    pageRepo = { findOne: jest.fn(), save: jest.fn(), find: jest.fn() };
    storyRepo = { update: jest.fn() };
    cloudflare = { generateImage: jest.fn() };
    usage = { canMakeRequest: jest.fn() };
    cloudinary = { uploadImage: jest.fn(), deleteImage: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        IllustrationProcessor,
        {
          provide: getRepositoryToken(Story),
          useValue: storyRepo,
        },
        {
          provide: getRepositoryToken(StoryPage),
          useValue: pageRepo,
        },
        {
          provide: BULLMQ_CONNECTION,
          useValue: {},
        },
        {
          provide: CloudflareProvider,
          useValue: cloudflare,
        },
        {
          provide: AiUsageService,
          useValue: usage,
        },
        {
          provide: CloudinaryService,
          useValue: cloudinary,
        },
        {
          provide: IllustrationStatusService,
          useValue: {
            computeStatus: jest.fn(() => ({
              status: StoryIllustrationStatus.COMPLETED,
            })),
          },
        },
        {
          provide: StoryProgressService,
          useValue: {
            setServer: jest.fn(),
            onChangeStatus: jest.fn(),
            notifyPageCompleted: jest.fn(),
            notifyDailyLimitReached: jest.fn(),
          },
        },
        {
          provide: PublicCacheService,
          useValue: {
            bust: jest.fn(),
          },
        },
        {
          provide: PromptValidationService,
          useValue: {
            validateImagePrompt: jest.fn().mockImplementation((p: string) => p),
          },
        },
      ],
    }).compile();

    processor = module.get(IllustrationProcessor);
  });

  function mockPage(overrides?: Partial<StoryPage>): StoryPage {
    const page = Object.assign(new StoryPage(), {
      id: 'page-1',
      storyId: 'story-1',
      pageNumber: 1,
      text: 'text',
      imageStatus: IllustrationPageStatus.PENDING,
      imageUrl: null,
      imagePublicId: null,
      imagePrompt: null,
      imageError: null,
      imageGeneratedAt: null,
      story: Object.assign(new Story(), { id: 'story-1' }),
      ...overrides,
    });
    return page;
  }

  describe('processJob', () => {
    it('generates, uploads, and completes the page', async () => {
      const page = mockPage();
      pageRepo.findOne.mockResolvedValue(page);
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));
      pageRepo.find.mockResolvedValue([page]);
      usage.canMakeRequest.mockResolvedValue({ allowed: true });
      cloudflare.generateImage.mockResolvedValue({
        buffer: Buffer.from('image'),
        mimeType: 'image/jpeg',
      });
      cloudinary.uploadImage.mockResolvedValue({
        secureUrl: 'https://img',
        publicId: 'storyforge/stories/story-1/pages/page-1',
      });

      await processor.processJob(makeJob());

      expect(cloudflare.generateImage).toHaveBeenCalledWith('prompt');
      expect(cloudinary.uploadImage).toHaveBeenCalled();
      expect(page.imageStatus).toBe(IllustrationPageStatus.COMPLETED);
      expect(page.imageUrl).toBe('https://img');
      expect(page.imagePublicId).toBe(
        'storyforge/stories/story-1/pages/page-1',
      );
      expect(page.imageGeneratedAt).not.toBeNull();
    });

    it('does not call Cloudflare when the daily limit is reached', async () => {
      const page = mockPage();
      pageRepo.findOne.mockResolvedValue(page);
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));
      pageRepo.find.mockResolvedValue([page]);
      usage.canMakeRequest.mockResolvedValue({ allowed: false });

      await processor.processJob(makeJob());

      expect(cloudflare.generateImage).not.toHaveBeenCalled();
      expect(page.imageStatus).toBe(IllustrationPageStatus.FAILED);
      expect(page.imageError).toBe('AI_DAILY_LIMIT_REACHED');
    });

    it('marks the page FAILED on the last attempt after a Cloudflare failure', async () => {
      const page = mockPage();
      pageRepo.findOne.mockResolvedValue(page);
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));
      pageRepo.find.mockResolvedValue([page]);
      usage.canMakeRequest.mockResolvedValue({ allowed: true });
      cloudflare.generateImage.mockRejectedValue(
        new Error('Cloudflare API error: timeout'),
      );

      await expect(
        processor.processJob(makeJob({ attemptsMade: 2 })),
      ).rejects.toThrow();

      expect(page.imageStatus).toBe(IllustrationPageStatus.FAILED);
      expect(page.imageError).toContain('Cloudflare');
    });

    it('marks the page QUEUED on an early failure to wait for retry', async () => {
      const page = mockPage();
      pageRepo.findOne.mockResolvedValue(page);
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));
      usage.canMakeRequest.mockResolvedValue({ allowed: true });
      cloudflare.generateImage.mockRejectedValue(
        new Error('Cloudflare API error: timeout'),
      );

      await expect(processor.processJob(makeJob())).rejects.toThrow();

      expect(page.imageStatus).toBe(IllustrationPageStatus.QUEUED);
    });

    it('ignores a job for a missing page without retrying', async () => {
      pageRepo.findOne.mockResolvedValue(null);

      await processor.processJob(makeJob());

      expect(cloudflare.generateImage).not.toHaveBeenCalled();
    });

    it('deletes the old image after a successful regeneration upload', async () => {
      const page = mockPage({
        imagePublicId: 'old-public-id',
      });
      pageRepo.findOne.mockResolvedValue(page);
      pageRepo.save.mockImplementation((p) => Promise.resolve(p));
      pageRepo.find.mockResolvedValue([page]);
      usage.canMakeRequest.mockResolvedValue({ allowed: true });
      cloudflare.generateImage.mockResolvedValue({
        buffer: Buffer.from('image'),
        mimeType: 'image/jpeg',
      });
      cloudinary.uploadImage.mockResolvedValue({
        secureUrl: 'https://new',
        publicId: 'new-public-id',
      });

      await processor.processJob(makeJob());

      expect(cloudinary.deleteImage).toHaveBeenCalledWith('old-public-id');
    });
  });
});
