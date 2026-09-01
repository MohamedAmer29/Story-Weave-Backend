import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { Story } from '../database/entities/story.entity';
import { StoryPage } from '../database/entities/story-page.entity';
import { StoryStatus } from '../common/enums/story-status.enum';
import {
  ILLUSTRATION_QUEUE,
  ILLUSTRATION_JOB_PREFIX,
} from './illustration.constants';
import { IllustrationPageStatus } from './enums/illustration-page-status.enum';
import { StoryIllustrationStatus } from './enums/story-illustration-status.enum';
import { GenerateIllustrationsDto } from './dto/generate-illustrations.dto';
import { ScenePromptService } from './services/scene-prompt.service';
import { IllustrationStatusService } from './services/illustration-status.service';
import { StoryProgressService } from '../notifications/story-progress.service';

export interface IllustrationJobData {
  storyId: string;
  storyPageId: string;
  userId: string;
  prompt: string;
}

const NON_REQUEUEABLE_STATUSES = [
  IllustrationPageStatus.QUEUED,
  IllustrationPageStatus.GENERATING,
  IllustrationPageStatus.UPLOADING,
];

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
      relations: { pages: true },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    this.validateStoryReady(story);

    const pages = story.pages || [];
    const eligiblePages = this.selectPagesForQueueing(
      pages,
      dto?.regenerate === true,
    );

    let queuedPages = 0;

    for (const page of eligiblePages) {
      const previousStatus = page.imageStatus ?? IllustrationPageStatus.PENDING;

      try {
        page.imageStatus = IllustrationPageStatus.QUEUED;
        page.imageError = null;
        await this.storyPageRepository.save(page);

        const prompt = this.scenePromptService.buildImagePrompt(story, page);
        page.imagePrompt = prompt;
        await this.storyPageRepository.save(page);

        await this.addJob({ storyId, storyPageId: page.id, userId, prompt });
        queuedPages++;
      } catch (error: any) {
        this.logger.error(
          `Failed to queue illustration for page ${page.id}: ${
            (error as Error)?.message ?? 'Unknown error'
          }`,
        );
        page.imageStatus = previousStatus;
        await this.storyPageRepository.save(page).catch(() => undefined);
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
    await this.storyProgressService.notifyGenerationStarted(
      userId,
      story.id,
      story.title,
      pages.length,
    );
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
  ): Promise<{ success: boolean; message: string; pageId: string }> {
    this.logger.log(
      `Regenerating illustration for page: ${pageId} in story: ${storyId}`,
    );

    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    this.validateStoryReady(story);

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
      const prompt = this.scenePromptService.buildImagePrompt(story, page);
      page.imagePrompt = prompt;
      page.imageStatus = IllustrationPageStatus.QUEUED;
      page.imageError = null;
      await this.storyPageRepository.save(page);

      await this.addJob({ storyId, storyPageId: pageId, userId, prompt });

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

  private async addJob(data: IllustrationJobData): Promise<void> {
    const jobId = `${ILLUSTRATION_JOB_PREFIX}-${data.storyPageId}`;
    await this.illustrationQueue.add('illustrate-page', data, {
      jobId,
    });
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
