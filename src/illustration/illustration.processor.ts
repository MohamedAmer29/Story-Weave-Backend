import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Worker, Job } from 'bullmq';
import { Story } from '../database/entities/story.entity';
import { StoryPage } from '../database/entities/story-page.entity';
import { ILLUSTRATION_QUEUE } from './illustration.constants';
import { IllustrationPageStatus } from './enums/illustration-page-status.enum';
import { BULLMQ_CONNECTION } from '../bullmq/bullmq.constants';
import { CloudflareProvider } from '../modules/ai/providers/cloudflare.provider';
import { AiUsageService } from '../ai/ai-usage.service';
import { AI_MODEL_USAGE } from '../ai/config/ai-model-usage.config';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { IllustrationStatusService } from './services/illustration-status.service';
import { IllustrationStatusResult } from './services/illustration-status.service';
import { IllustrationJobData } from './illustration.service';
import { StoryProgressService } from '../notifications/story-progress.service';
import { PublicCacheService } from '../common/services/public-cache.service';
import { PromptValidationService } from './services/prompt-validation.service';
import { Redis } from 'ioredis';

const CLOUDFLARE_MODEL_KEY = '@cf/black-forest-labs/flux-1-schnell';

// Non-retryable error patterns (message-based)
const NON_RETRYABLE_ERROR_PATTERNS = [
  'Invalid prompt',
  'prompt too long',
  'invalid API credentials',
  'invalid request parameters',
  'authentication failed',
  'unauthorized',
  'forbidden',
  'not found',
  'Invalid Cloudflare',
];

// Non-retryable HTTP status codes
const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404];

// Retryable HTTP status codes (with backoff)
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

@Injectable()
export class IllustrationProcessor
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(IllustrationProcessor.name);
  private worker: Worker | null = null;

  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryPage)
    private readonly storyPageRepository: Repository<StoryPage>,
    @Inject(BULLMQ_CONNECTION)
    private readonly bullConnection: Redis,
    private readonly cloudflareProvider: CloudflareProvider,
    private readonly usageService: AiUsageService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly illustrationStatusService: IllustrationStatusService,
    private readonly storyProgressService: StoryProgressService,
    private readonly publicCacheService: PublicCacheService,
    private readonly promptValidationService: PromptValidationService,
  ) {}

  onApplicationBootstrap(): void {
    const concurrency = Number(
      process.env.ILLUSTRATION_WORKER_CONCURRENCY ??
        process.env.AI_IMAGE_CONCURRENCY ??
        2,
    );

    this.worker = new Worker(
      ILLUSTRATION_QUEUE,
      async (job) => this.processJob(job as Job<IllustrationJobData>),
      {
        connection: this.bullConnection,
        concurrency,
        limiter: {
          max: concurrency * 2,
          duration: 1000,
        },
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Illustration job ${job?.id} failed: ${error.message}`);
    });

    this.logger.log('Illustration worker started');
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }

  private isRetryableError(error: unknown): boolean {
    const errorMessage =
      error instanceof Error
        ? error.message.toLowerCase()
        : typeof error === 'string'
          ? error.toLowerCase()
          : '';

    // Check message-based patterns first
    const isMessageRetryable = !NON_RETRYABLE_ERROR_PATTERNS.some((pattern) =>
      errorMessage.includes(pattern.toLowerCase()),
    );

    // Check HTTP status codes if available in error
    let isStatusCodeRetryable = true;
    if (error instanceof Error && 'response' in error) {
      const response = (error as any).response;
      if (response && response.status) {
        const statusCode = response.status;

        if (NON_RETRYABLE_STATUS_CODES.includes(statusCode)) {
          this.logger.warn(
            `[IllustrationProcessor] HTTP status ${statusCode} is non-retryable`,
          );
          isStatusCodeRetryable = false;
        } else if (RETRYABLE_STATUS_CODES.includes(statusCode)) {
          this.logger.log(
            `[IllustrationProcessor] HTTP status ${statusCode} is retryable`,
          );
          isStatusCodeRetryable = true;
        }
      }
    }

    // Error is retryable only if both message and status code allow it
    return isMessageRetryable && isStatusCodeRetryable;
  }

  async processJob(job: Job<IllustrationJobData>): Promise<void> {
    const { storyPageId, prompt, userId } = job.data as any;
    const jobId = job.id;

    this.logger.log(
      `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} userId=${userId} attempt=${job.attemptsMade + 1}/${job.opts.attempts || 3}`,
    );

    // Handle cover jobs
    if (job.name === 'illustrate-cover') {
      const { storyId } = job.data as any;

      this.logger.log(
        `[IllustrationJob] jobId=${jobId} storyId=${storyId} type=COVER userId=${userId} attempt=${job.attemptsMade + 1}/${job.opts.attempts || 3}`,
      );

      const story = await this.storyRepository.findOne({
        where: { id: storyId },
      });
      if (!story) {
        this.logger.warn(
          `[IllustrationJob] jobId=${jobId} storyId=${storyId} Cover job for missing story ignored`,
        );
        return;
      }

      try {
        // neuron protection
        const { allowed } = await this.usageService.canMakeRequest(
          CLOUDFLARE_MODEL_KEY,
          AI_MODEL_USAGE[CLOUDFLARE_MODEL_KEY]?.neuronsPerRequest ?? 100,
        );

        if (!allowed) {
          this.logger.warn(
            `[IllustrationJob] jobId=${jobId} storyId=${storyId} AI daily limit reached. Not calling Cloudflare for cover`,
          );
          story.coverImageStatus = IllustrationPageStatus.FAILED;
          story.coverImageError = 'AI_DAILY_LIMIT_REACHED';
          await this.storyRepository.save(story);
          await this.storyProgressService.notifyDailyLimitReached(
            userId,
            story.id,
          );
          return;
        }

        const promptToUse = prompt || story.coverImagePrompt || '';

        try {
          const validatedPrompt =
            this.promptValidationService.validateImagePrompt(promptToUse);
        } catch (error) {
          this.logger.error(
            `[IllustrationJob] jobId=${jobId} storyId=${storyId} Prompt validation failed: ${error}`,
          );
          story.coverImageStatus = IllustrationPageStatus.FAILED;
          story.coverImageError = 'Invalid prompt';
          await this.storyRepository.save(story);
          return;
        }

        if (
          typeof promptToUse !== 'string' ||
          promptToUse.trim().length === 0
        ) {
          this.logger.error(
            `[IllustrationJob] jobId=${jobId} storyId=${storyId} Invalid cover prompt`,
          );
          story.coverImageStatus = IllustrationPageStatus.FAILED;
          story.coverImageError = 'Invalid prompt';
          await this.storyRepository.save(story);
          return;
        }

        story.coverImageStatus = IllustrationPageStatus.GENERATING;
        await this.storyRepository.save(story);

        this.logger.log(
          `[IllustrationJob] jobId=${jobId} storyId=${storyId} status=GENERATING Calling Cloudflare`,
        );
        const result = await this.cloudflareProvider.generateImage(promptToUse);

        story.coverImageStatus = IllustrationPageStatus.UPLOADING;
        await this.storyRepository.save(story);

        this.logger.log(
          `[IllustrationJob] jobId=${jobId} storyId=${storyId} status=UPLOADING Uploading to Cloudinary`,
        );
        const upload = await this.cloudinaryService.uploadImage(result.buffer, {
          folder: `storyforge/stories/${story.id}/cover`,
          publicId: `${story.id}-cover`,
        });

        story.coverImageUrl = upload.secureUrl;
        story.coverImagePublicId = upload.publicId;
        story.coverImageStatus = IllustrationPageStatus.COMPLETED;
        story.coverImageError = null;
        story.coverImageGeneratedAt = new Date();
        await this.storyRepository.save(story);

        this.logger.log(
          `[IllustrationJob] jobId=${jobId} storyId=${storyId} status=COMPLETED Cover generation completed`,
        );
        // notify page completed for cover? Emit a dedicated notification if needed
        await this.publicCacheService.bust();
      } catch (error: any) {
        this.logger.error(
          `[IllustrationJob] jobId=${jobId} storyId=${storyId} Cover job failed: ${error?.message}`,
        );
        story.coverImageStatus = IllustrationPageStatus.FAILED;
        story.coverImageError = (error as Error)?.message ?? 'Unknown error';
        await this.storyRepository.save(story).catch(() => undefined);

        // Don't retry non-retryable errors
        if (!this.isRetryableError(error)) {
          this.logger.log(
            `[IllustrationJob] jobId=${jobId} storyId=${storyId} Failed with non-retryable error, not retrying`,
          );
          throw new Error('Non-retryable error');
        }

        throw error;
      }

      return;
    }

    this.logger.log(
      `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} type=STORY_PAGE userId=${userId} attempt=${job.attemptsMade + 1}/${job.opts.attempts || 3}`,
    );

    const page = await this.storyPageRepository.findOne({
      where: { id: storyPageId },
      relations: { story: true },
    });

    // Page no longer exists: nothing to do, avoid infinite retries.
    if (!page) {
      this.logger.warn(
        `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} Illustration job for missing page ignored (INVALID_STORY_PAGE)`,
      );
      return;
    }

    const story = page.story;
    if (!story) {
      this.logger.warn(
        `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} Illustration job for page has no story (INVALID_STORY_PAGE)`,
      );
      await this.markPageFailed(page, 'Story not found');
      return;
    }

    try {
      await this.setPageStatus(page, IllustrationPageStatus.GENERATING);
      this.logger.log(
        `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} status=GENERATING`,
      );

      // AI usage protection: authoritative application-level safety mechanism.
      const { allowed } = await this.usageService.canMakeRequest(
        CLOUDFLARE_MODEL_KEY,
        AI_MODEL_USAGE[CLOUDFLARE_MODEL_KEY]?.neuronsPerRequest ?? 100,
      );

      if (!allowed) {
        this.logger.warn(
          `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} AI daily limit reached. Not calling Cloudflare`,
        );
        await this.markPageFailed(page, 'AI_DAILY_LIMIT_REACHED');
        await this.storyProgressService.notifyDailyLimitReached(
          userId,
          story.id,
        );
        const progress = await this.refreshStoryStatus(story);
        await this.storyProgressService.onChangeStatus(story, progress.result);
        await this.publicCacheService.bust();
        return;
      }

      this.logger.log(
        `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} Calling Cloudflare promptLength=${prompt.length}`,
      );

      try {
        const validatedPrompt =
          this.promptValidationService.validateImagePrompt(prompt);
      } catch (error) {
        this.logger.error(
          `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} Prompt validation failed: ${error}`,
        );
        await this.markPageFailed(page, 'Invalid prompt');
        const progress = await this.refreshStoryStatus(story);
        await this.storyProgressService.onChangeStatus(story, progress.result);
        await this.publicCacheService.bust();
        return;
      }

      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        this.logger.error(
          `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} Invalid prompt; aborting Cloudflare request`,
        );
        await this.markPageFailed(page, 'Invalid prompt');
        const progress = await this.refreshStoryStatus(story);
        await this.storyProgressService.onChangeStatus(story, progress.result);
        await this.publicCacheService.bust();
        return;
      }

      this.logger.debug(
        `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} model=${CLOUDFLARE_MODEL_KEY} promptLength=${prompt.length}`,
      );

      const result = await this.cloudflareProvider.generateImage(prompt);

      this.logger.log(
        `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} Cloudflare request completed imageSize=${result.buffer.length} bytes`,
      );

      await this.setPageStatus(page, IllustrationPageStatus.UPLOADING);
      this.logger.log(
        `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} status=UPLOADING Uploading to Cloudinary`,
      );

      const oldPublicId = page.imagePublicId;

      this.logger.log(
        `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} Cloudinary upload started`,
      );

      const upload = await this.cloudinaryService.uploadImage(result.buffer, {
        folder: `storyforge/stories/${story.id}/pages`,
        publicId: page.id,
      });

      this.logger.log(
        `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} Cloudinary upload completed publicId=${upload.publicId}`,
      );

      // Only remove the previous image after the replacement succeeded.
      if (oldPublicId && oldPublicId !== upload.publicId) {
        await this.cloudinaryService.deleteImage(oldPublicId);
      }

      page.imageUrl = upload.secureUrl;
      page.imagePublicId = upload.publicId;
      page.imageStatus = IllustrationPageStatus.COMPLETED;
      page.imageError = null;
      page.imageGeneratedAt = new Date();
      await this.storyPageRepository.save(page);

      this.logger.log(
        `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} status=COMPLETED pageNumber=${page.pageNumber}`,
      );

      await this.storyProgressService.notifyPageCompleted(
        story.id,
        userId,
        page.id,
        page.pageNumber,
        page.imageUrl,
      );
      const progress = await this.refreshStoryStatus(story);
      await this.storyProgressService.onChangeStatus(story, progress.result);
      await this.publicCacheService.bust();
    } catch (error: any) {
      this.logger.error(
        `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} Error: ${error?.message}`,
      );
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);

      if (isLastAttempt || !this.isRetryableError(error)) {
        this.logger.log(
          `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} Marking as failed (attempt=${job.attemptsMade + 1}, retryable=${this.isRetryableError(error)})`,
        );
        await this.markPageFailed(page, this.safeErrorMessage(error));
        const progress = await this.refreshStoryStatus(story);
        await this.storyProgressService.onChangeStatus(story, progress.result);
        await this.publicCacheService.bust();
      } else {
        // Transient failure: show QUEUED while a retry is scheduled.
        this.logger.log(
          `[IllustrationJob] jobId=${jobId} storyPageId=${storyPageId} Transient failure, retrying (attempt=${job.attemptsMade + 1})`,
        );
        await this.setPageStatus(page, IllustrationPageStatus.QUEUED);
      }

      throw error;
    }
  }

  private async setPageStatus(
    page: StoryPage,
    status: IllustrationPageStatus,
  ): Promise<void> {
    page.imageStatus = status;
    await this.storyPageRepository.save(page);
  }

  private async markPageFailed(
    page: StoryPage,
    message: string,
  ): Promise<void> {
    page.imageStatus = IllustrationPageStatus.FAILED;
    page.imageError = message;
    await this.storyPageRepository.save(page);
  }

  private async refreshStoryStatus(
    story: Story,
  ): Promise<{ pages: StoryPage[]; result: IllustrationStatusResult }> {
    const pages = await this.storyPageRepository.find({
      where: { storyId: story.id },
    });

    const result = this.illustrationStatusService.computeStatus(pages);

    await this.storyRepository.update(story.id, {
      illustrationStatus: result.status,
    });

    return { pages, result };
  }

  private safeErrorMessage(error: unknown): string {
    const raw =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown error';

    const allowedPrefixes = [
      'Cloudflare',
      'Invalid Cloudflare',
      'Cloudinary',
      'AI',
    ];

    if (allowedPrefixes.some((prefix) => raw.startsWith(prefix))) {
      return raw.length > 200 ? raw.substring(0, 200) : raw;
    }

    return 'Illustration generation failed';
  }
}
