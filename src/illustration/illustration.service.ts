import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import { Story } from '../database/entities/story.entity';
import { StoryPage } from '../database/entities/story-page.entity';
import { StoryStatus } from '../common/enums/story-status.enum';
import { StoryLanguage } from '../common/enums/story-language.enum';
import {
  ILLUSTRATION_QUEUE,
  ILLUSTRATION_JOB_PREFIX,
  ILLUSTRATION_COVER_JOB_PREFIX,
} from './illustration.constants';
import { IllustrationPageStatus } from './enums/illustration-page-status.enum';
import { StoryIllustrationStatus } from './enums/story-illustration-status.enum';
import { GenerateIllustrationsDto } from './dto/generate-illustrations.dto';
import { ScenePromptService } from './services/scene-prompt.service';
import { IllustrationStatusService } from './services/illustration-status.service';
import { StoryProgressService } from '../notifications/story-progress.service';
import { RedisService } from '../config/redis.service';
import { UserRole } from '../database/entities/user.entity';
import { VisualContextOverrides } from './services/scene-prompt.service';
import { StoryTranslationService } from './services/story-translation.service';

export interface IllustrationJobData {
  storyId: string;
  storyPageId: string;
  userId: string;
  attemptId?: string | null;
  prompt: string;
}

const NON_REQUEUEABLE_STATUSES = [
  IllustrationPageStatus.QUEUED,
  IllustrationPageStatus.GENERATING,
  IllustrationPageStatus.UPLOADING,
];

const USER_DAILY_IMAGE_LIMIT = 4;
const USER_DAILY_IMAGE_LIMIT_TTL_SECONDS = 60 * 60 * 48;
const USER_DAILY_IMAGE_LIMIT_LUA = `
local key = KEYS[1]
local amount = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', key) or '0')
local nextValue = current + amount

if nextValue > limit then
  return {0, current}
end

redis.call('INCRBY', key, amount)
redis.call('EXPIRE', key, tonumber(ARGV[3]))
return {1, nextValue}
`;

@Injectable()
export class IllustrationService {
  private readonly logger = new Logger(IllustrationService.name);

  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryPage)
    private readonly storyPageRepository: Repository<StoryPage>,
    @Inject(ILLUSTRATION_QUEUE)
    private readonly illustrationQueue: Queue,
    private readonly scenePromptService: ScenePromptService,
    private readonly illustrationStatusService: IllustrationStatusService,
    private readonly storyProgressService: StoryProgressService,
    private readonly redisService: RedisService,
    private readonly storyTranslationService: StoryTranslationService,
  ) {}

  async queueStoryIllustrations(
    userId: string,
    storyId: string,
    dto: GenerateIllustrationsDto,
  ): Promise<{
    success: boolean;
    message: string;
    storyId: string;
    totalPages: number;
    queuedPages: number;
  }> {
    this.logger.log(`Queueing illustrations for story: ${storyId}`);

    const story = await this.storyRepository.findOne({
      where: { id: storyId },
      relations: { pages: true, user: true },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    this.validateStoryReady(story);

    // If a previous generation attempt is no longer actively processing,
    // clear the stale lock so the user can retry after a failure.
    const currentStatus = this.illustrationStatusService.computeStatus(
      story.pages || [],
    );
    if (currentStatus.status === StoryIllustrationStatus.COMPLETED) {
      throw new BadRequestException(
        'Illustration generation is already completed for this story',
      );
    }
    if (
      story.illustrationGenerationAttemptId &&
      currentStatus.status !== StoryIllustrationStatus.GENERATING &&
      currentStatus.status !== StoryIllustrationStatus.QUEUED
    ) {
      await this.storyRepository
        .createQueryBuilder()
        .update(Story)
        .set({ illustrationGenerationAttemptId: null })
        .where('id = :id AND illustrationGenerationAttemptId IS NOT NULL', {
          id: storyId,
        })
        .execute();
      story.illustrationGenerationAttemptId = null;
    }

    // Attempt to claim a generation attempt id atomically to prevent duplicates
    const attemptId = randomUUID();
    const claim = await this.storyRepository
      .createQueryBuilder()
      .update(Story)
      .set({ illustrationGenerationAttemptId: attemptId })
      .where('id = :id AND (illustrationGenerationAttemptId IS NULL)', {
        id: storyId,
      })
      .execute();

    if (!claim.affected || claim.affected === 0) {
      this.logger.log(
        `[StoryGeneration] Generation already active for story ${storyId}. Skipping duplicate request.`,
      );
      throw new BadRequestException(
        'Illustration generation already in progress for this story',
      );
    }

    // reflect claimed attempt locally
    story.illustrationGenerationAttemptId = attemptId;

    const pages = story.pages || [];
    const orderedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
    const eligiblePages = this.selectPagesForQueueing(
      orderedPages,
      dto?.regenerate === true,
    );
    await this.assertDailyImageAllowance(
      story.user?.role ?? UserRole.USER,
      story.userId,
      eligiblePages.length + 1,
    );

    let visualStory: Story;
    let visualPages: StoryPage[];
    try {
      visualStory = await this.toVisualStory(story);
      visualPages = await this.toVisualPages(story, orderedPages);
    } catch (error: any) {
      await this.releaseGenerationAttempt(storyId, attemptId);
      this.logger.error(
        `Failed to translate story ${storyId} for visual generation: ${error?.message ?? 'Unknown error'}`,
      );
      throw new BadRequestException(
        'Could not translate the story for illustration generation. Please try again.',
      );
    }

    let queuedPages = 0;

    // Queue cover job first (separate from story pages)
    try {
      // build cover prompt
      const coverPrompt = this.scenePromptService.buildCoverPrompt(visualStory);
      story.coverImagePrompt = coverPrompt;
      story.coverImageStatus = IllustrationPageStatus.QUEUED;
      await this.storyRepository.save(story);

      await this.addCoverJob({
        storyId,
        userId,
        prompt: coverPrompt,
        attemptId,
      });
      queuedPages++;
    } catch (error: any) {
      this.logger.error(
        `Failed to queue cover for story ${storyId}: ${error?.message ?? 'Unknown'}`,
      );
      // release claim so future attempts can proceed
      await this.storyRepository
        .createQueryBuilder()
        .update(Story)
        .set({ illustrationGenerationAttemptId: null })
        .where('id = :id AND illustrationGenerationAttemptId = :attemptId', {
          id: storyId,
          attemptId,
        })
        .execute()
        .catch(() => undefined);

      throw new BadRequestException(
        'Failed to queue cover job. Please try again.',
      );
    }

    for (const page of eligiblePages) {
      const previousStatus = page.imageStatus ?? IllustrationPageStatus.PENDING;

      try {
        const visualPage = visualPages.find((candidate) => candidate.id === page.id) ?? page;
        const prompt = this.scenePromptService.buildImagePrompt(
          visualStory,
          visualPage,
          visualPages,
        );
        // Set status + prompt together to persist in a single UPDATE.
        page.imageStatus = IllustrationPageStatus.QUEUED;
        page.imageError = null;
        page.imagePrompt = prompt;
        await this.storyPageRepository.save(page);

        await this.addJob({
          storyId,
          storyPageId: page.id,
          userId,
          prompt,
          attemptId,
        });
        queuedPages++;
      } catch (error: any) {
        this.logger.error(
          `Failed to queue illustration for page ${page.id}: ${
            (error as Error)?.message ?? 'Unknown error'
          }`,
        );
        page.imageStatus = previousStatus;
        await this.storyPageRepository.save(page).catch(() => undefined);
        // release claim if we failed during queueing so future attempts can proceed
        await this.storyRepository
          .createQueryBuilder()
          .update(Story)
          .set({ illustrationGenerationAttemptId: null })
          .where('id = :id AND illustrationGenerationAttemptId = :attemptId', {
            id: storyId,
            attemptId,
          })
          .execute()
          .catch(() => undefined);

        throw new BadRequestException(
          'Failed to queue some illustration jobs. Please try again.',
        );
      }
    }

    await this.refreshStoryStatus(story, pages);

    this.logger.log(
      `Queued ${queuedPages}/${pages.length} illustrations for story: ${storyId}`,
    );

    await this.resetGenerationNotified(story);
    // Only create a STARTED notification if the attempt is still claimed
    if (story.illustrationGenerationAttemptId) {
      const totalImages = pages.length + 1; // include cover
      await this.storyProgressService.notifyGenerationStarted(
        userId,
        story.id,
        story.title,
        totalImages,
      );
    } else {
      this.logger.log(
        `[StoryGeneration] Attempt ${storyId} no longer claimed; skipping STARTED notification.`,
      );
    }
    await this.storyProgressService.emitProgress({
      storyId,
      userId,
      status: story.illustrationStatus ?? StoryIllustrationStatus.QUEUED,
      progress: this.illustrationStatusService.computeStatus(pages),
    });

    return {
      success: true,
      message: 'Story illustration generation has been queued',
      storyId,
      totalPages: pages.length,
      queuedPages,
    };
  }

  async regeneratePage(
    userId: string,
    storyId: string,
    pageId: string,
    overrides?: VisualContextOverrides,
  ): Promise<{ success: boolean; message: string; pageId: string }> {
    this.logger.log(
      `Regenerating illustration for page: ${pageId} in story: ${storyId}`,
    );

    const story = await this.storyRepository.findOne({
      where: { id: storyId },
      relations: { user: true },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    this.validateStoryReady(story);
    await this.assertDailyImageAllowance(story.user?.role ?? UserRole.USER, story.userId, 1);

    const page = await this.storyPageRepository.findOne({
      where: { id: pageId, storyId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    if (this.isRequeueableBlocked(page.imageStatus)) {
      throw new BadRequestException(
        'This page illustration is already being processed',
      );
    }

    const previousStatus = page.imageStatus;

    try {
      const allPages = await this.storyPageRepository.find({
        where: { storyId },
        order: { pageNumber: 'ASC' },
      });
      const visualStory = await this.toVisualStory(story);
      const visualPages = await this.toVisualPages(story, allPages);
      const visualPage = visualPages.find((candidate) => candidate.id === page.id) ?? page;
      const prompt = this.scenePromptService.buildImagePrompt(
        visualStory,
        visualPage,
        visualPages,
        overrides,
      );
      page.imagePrompt = prompt;
      page.imageStatus = IllustrationPageStatus.QUEUED;
      page.imageError = null;
      await this.storyPageRepository.save(page);

      const regenAttemptId = randomUUID();
      await this.addJob({
        storyId,
        storyPageId: pageId,
        userId,
        prompt,
        attemptId: regenAttemptId,
      });

      await this.resetGenerationNotified(story);
      const pages = await this.storyPageRepository.find({
        where: { storyId },
        order: { pageNumber: 'ASC' },
      });
      const progress = this.illustrationStatusService.computeStatus(pages);
      await this.storyProgressService.emitProgress({
        storyId,
        userId,
        status: progress.status,
        progress,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to requeue illustration for page ${pageId}: ${
          (error as Error)?.message ?? 'Unknown error'
        }`,
      );
      page.imageStatus = previousStatus;
      await this.storyPageRepository.save(page).catch(() => undefined);
      throw new BadRequestException(
        'Failed to queue page regeneration. Please try again.',
      );
    }

    return {
      success: true,
      message: 'Page illustration regeneration queued',
      pageId,
    };
  }

  async regenerateCover(
    userId: string,
    storyId: string,
    overrides?: VisualContextOverrides,
  ): Promise<{ success: boolean; message: string; storyId: string }> {
    this.logger.log(`Regenerating cover for story: ${storyId}`);

    const story = await this.storyRepository.findOne({
      where: { id: storyId },
      relations: { user: true },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    this.validateStoryReady(story);
    await this.assertDailyImageAllowance(story.user?.role ?? UserRole.USER, story.userId, 1);

    if (this.isRequeueableBlocked(story.coverImageStatus)) {
      throw new BadRequestException(
        'Cover illustration is already being processed',
      );
    }

    const previousStatus = story.coverImageStatus;

    try {
      const visualStory = await this.toVisualStory(story);
      const coverPrompt = this.scenePromptService.buildCoverPrompt(
        visualStory,
        overrides,
      );
      story.coverImagePrompt = coverPrompt;
      story.coverImageStatus = IllustrationPageStatus.QUEUED;
      story.coverImageError = null;
      await this.storyRepository.save(story);

      const regenAttemptId = randomUUID();
      await this.addCoverJob({
        storyId,
        userId,
        prompt: coverPrompt,
        attemptId: regenAttemptId,
      });

      await this.resetGenerationNotified(story);
      const pages = await this.storyPageRepository.find({
        where: { storyId },
        order: { pageNumber: 'ASC' },
      });
      const progress = this.illustrationStatusService.computeStatus(pages);
      await this.storyProgressService.emitProgress({
        storyId,
        userId,
        status: progress.status,
        progress,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to requeue cover for story ${storyId}: ${
          (error as Error)?.message ?? 'Unknown error'
        }`,
      );
      story.coverImageStatus = previousStatus;
      await this.storyRepository.save(story).catch(() => undefined);
      throw new BadRequestException(
        'Failed to queue cover regeneration. Please try again.',
      );
    }

    return {
      success: true,
      message: 'Cover regeneration queued',
      storyId,
    };
  }

  private async addJob(data: IllustrationJobData): Promise<void> {
    const jobId = `${ILLUSTRATION_JOB_PREFIX}-${data.storyPageId}${
      data.attemptId ? `-${data.attemptId}` : ''
    }`;
    await this.illustrationQueue.add('illustrate-page', data, {
      jobId,
    });
  }

  private async addCoverJob(data: {
    storyId: string;
    userId: string;
    prompt: string;
    attemptId?: string | null;
  }): Promise<void> {
    const jobId = `${ILLUSTRATION_COVER_JOB_PREFIX}-${data.storyId}${data.attemptId ? `-${data.attemptId}` : ''}`;
    await this.illustrationQueue.add(
      'illustrate-cover',
      {
        storyId: data.storyId,
        userId: data.userId,
        prompt: data.prompt,
      },
      { jobId },
    );
  }

  private selectPagesForQueueing(
    pages: StoryPage[],
    regenerate: boolean,
  ): StoryPage[] {
    return pages.filter((page) => {
      if (this.isRequeueableBlocked(page.imageStatus)) {
        return false;
      }

      if (
        page.imageStatus === IllustrationPageStatus.COMPLETED &&
        !regenerate
      ) {
        return false;
      }

      return true;
    });
  }

  private async toVisualStory(story: Story): Promise<Story> {
    const visualStory = Object.assign(new Story(), story);
    visualStory.originalText = await this.storyTranslationService.translateForVisual(
      story.originalText ?? '',
      story.language,
      `story:${story.id}`,
    );
    return visualStory;
  }

  private async toVisualPages(
    story: Story,
    pages: StoryPage[],
  ): Promise<StoryPage[]> {
    return Promise.all(
      pages.map(async (page) => {
        if (story.language !== StoryLanguage.ARABIC) {
          return Object.assign(new StoryPage(), page);
        }

        const visualScene = [
          page.sceneDescription
            ? `Scene description: ${page.sceneDescription}`
            : '',
          `Story content: ${page.text ?? ''}`,
          page.characterDescriptions
            ? `Character descriptions: ${page.characterDescriptions}`
            : '',
        ]
          .filter(Boolean)
          .join('\n');

        const translatedScene =
          await this.storyTranslationService.translateForVisual(
            visualScene,
            story.language,
            `page:${page.id}:visual-scene`,
          );

        return Object.assign(new StoryPage(), page, {
          text: translatedScene,
          sceneDescription: null,
          characterDescriptions: null,
        });
      }),
    );
  }

  private async releaseGenerationAttempt(
    storyId: string,
    attemptId: string,
  ): Promise<void> {
    await this.storyRepository
      .createQueryBuilder()
      .update(Story)
      .set({ illustrationGenerationAttemptId: null })
      .where('id = :id AND illustrationGenerationAttemptId = :attemptId', {
        id: storyId,
        attemptId,
      })
      .execute()
      .catch(() => undefined);
  }

  private getDailyImageLimitKey(userId: string): string {
    const now = new Date();
    const utcDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const year = utcDate.getUTCFullYear();
    const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utcDate.getUTCDate()).padStart(2, '0');
    return `illustration:daily-limit:${userId}:${year}-${month}-${day}`;
  }

  private async assertDailyImageAllowance(
    role: UserRole | string | null | undefined,
    userId: string,
    amount: number,
  ): Promise<void> {
    if (role && role !== UserRole.USER) {
      return;
    }

    const client = this.redisService.getClient();
    const key = this.getDailyImageLimitKey(userId);

    const result: any = await client.eval(
      USER_DAILY_IMAGE_LIMIT_LUA,
      1,
      key,
      amount,
      USER_DAILY_IMAGE_LIMIT,
      USER_DAILY_IMAGE_LIMIT_TTL_SECONDS,
    );

    const allowed = Array.isArray(result) ? result[0] === 1 : false;
    const used = Array.isArray(result) ? Number(result[1] ?? 0) : 0;

    if (!allowed) {
      throw new HttpException(
        `Daily image limit reached. Users can generate up to ${USER_DAILY_IMAGE_LIMIT} images per day.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.logger.debug(
      `[IllustrationQuota] userId=${userId} role=${role ?? 'UNKNOWN'} reserved=${amount} used=${used}/${USER_DAILY_IMAGE_LIMIT}`,
    );
  }

  private isRequeueableBlocked(
    status: IllustrationPageStatus | null | undefined,
  ): boolean {
    if (!status) {
      return false;
    }
    return NON_REQUEUEABLE_STATUSES.includes(status);
  }

  private validateStoryReady(story: Story): void {
    if (story.status !== StoryStatus.READY) {
      throw new BadRequestException(
        'Story is not ready for illustration. Only READY stories can be illustrated.',
      );
    }
  }

  private async refreshStoryStatus(
    story: Story,
    pages: StoryPage[],
  ): Promise<void> {
    const result = this.illustrationStatusService.computeStatus(pages);
    story.illustrationStatus = result.status;
    await this.storyRepository.save(story);
  }

  private async resetGenerationNotified(story: Story): Promise<void> {
    if (!story.illustrationGenerationNotifiedAt) {
      return;
    }
    story.illustrationGenerationNotifiedAt = null;
    await this.storyRepository.save(story);
  }
}
