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
import { Redis } from 'ioredis';

const CLOUDFLARE_MODEL_KEY = '@cf/black-forest-labs/flux-1-schnell';

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
  ) {}

  onApplicationBootstrap(): void {
    const concurrency = Number(
      process.env.AI_IMAGE_CONCURRENCY ? process.env.AI_IMAGE_CONCURRENCY : 2,
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

  async processJob(job: Job<IllustrationJobData>): Promise<void> {
    const { storyPageId, prompt, userId } = job.data;

    this.logger.log(
      `Illustration job started for page: ${storyPageId} (user: ${userId})`,
    );

    const page = await this.storyPageRepository.findOne({
      where: { id: storyPageId },
      relations: { story: true },
    });

    // Page no longer exists: nothing to do, avoid infinite retries.
    if (!page) {
      this.logger.warn(
        `Illustration job for missing page ${storyPageId} ignored (INVALID_STORY_PAGE)`,
      );
      return;
    }

    const story = page.story;
    if (!story) {
      this.logger.warn(
        `Illustration job for page ${storyPageId} has no story (INVALID_STORY_PAGE)`,
      );
      await this.markPageFailed(page, 'Story not found');
      return;
    }

    try {
      await this.setPageStatus(page, IllustrationPageStatus.GENERATING);

      // AI usage protection: authoritative application-level safety mechanism.
      const { allowed } = await this.usageService.canMakeRequest(
        CLOUDFLARE_MODEL_KEY,
        AI_MODEL_USAGE[CLOUDFLARE_MODEL_KEY]?.neuronsPerRequest ?? 100,
      );

      if (!allowed) {
        this.logger.warn(
          `AI daily limit reached. Not calling Cloudflare for page ${storyPageId}`,
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

      this.logger.log(`FLUX request started for page: ${storyPageId}`);

      const result = await this.cloudflareProvider.generateImage(prompt);

      this.logger.log(
        `FLUX request completed for page: ${storyPageId} (${result.buffer.length} bytes)`,
      );

      await this.setPageStatus(page, IllustrationPageStatus.UPLOADING);

      const oldPublicId = page.imagePublicId;

      this.logger.log(`Cloudinary upload started for page: ${storyPageId}`);

      const upload = await this.cloudinaryService.uploadImage(result.buffer, {
        folder: `storyforge/stories/${story.id}/pages`,
        publicId: page.id,
      });

      this.logger.log(`Cloudinary upload completed for page: ${storyPageId}`);

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

      this.logger.log(`Illustration completed for page: ${storyPageId}`);

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
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);

      if (isLastAttempt) {
        await this.markPageFailed(page, this.safeErrorMessage(error));
        const progress = await this.refreshStoryStatus(story);
        await this.storyProgressService.onChangeStatus(story, progress.result);
        await this.publicCacheService.bust();
      } else {
        // Transient failure: show QUEUED while a retry is scheduled.
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
