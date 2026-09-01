import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Story } from '../database/entities/story.entity';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './notification-type.enum';
import { IllustrationStatusResult } from '../illustration/services/illustration-status.service';
import { StoryIllustrationStatus } from '../illustration/enums/story-illustration-status.enum';

export enum StoryProgressEvent {
  PageCompleted = 'story.pageCompleted',
  StoryCompleted = 'story.completed',
  StoryFailed = 'story.failed',
}

@Injectable()
export class StoryProgressService {
  private io: Server | null = null;

  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Register the Socket.IO server after the gateway initializes. */
  setServer(server: Server): void {
    this.io = server;
  }

  static storyRoom(storyId: string): string {
    return `story:${storyId}`;
  }

  /** Emit to both the story room and the owner's user room. */
  private notify(
    storyId: string,
    userId: string,
    event: string,
    payload: unknown,
  ): void {
    if (!this.io) {
      return;
    }
    this.io
      .to(StoryProgressService.storyRoom(storyId))
      .to(`user:${userId}`)
      .emit(event, payload);
  }

  emitProgress(payload: {
    storyId: string;
    userId: string;
    status: StoryIllustrationStatus;
    progress: IllustrationStatusResult;
  }): void {
    this.notify(payload.storyId, payload.userId, 'story.progress', {
      storyId: payload.storyId,
      status: payload.status,
      totalPages: payload.progress.totalPages,
      completed: payload.progress.completed,
      failed: payload.progress.failed,
      progress: payload.progress.progress,
    });
  }

  emitPageCompleted(payload: {
    storyId: string;
    userId: string;
    pageId: string;
    pageNumber: number;
    imageUrl: string;
  }): void {
    this.notify(
      payload.storyId,
      payload.userId,
      StoryProgressEvent.PageCompleted,
      {
        storyId: payload.storyId,
        pageId: payload.pageId,
        pageNumber: payload.pageNumber,
        imageUrl: payload.imageUrl,
      },
    );
  }

  emitStoryCompleted(payload: {
    storyId: string;
    userId: string;
    status: StoryIllustrationStatus;
  }): void {
    this.notify(
      payload.storyId,
      payload.userId,
      payload.status === StoryIllustrationStatus.COMPLETED
        ? StoryProgressEvent.StoryCompleted
        : StoryProgressEvent.StoryFailed,
      { storyId: payload.storyId, status: payload.status },
    );
  }

  /** Emit real-time progress and send one terminal notification per generation run. */
  async onChangeStatus(
    story: Story,
    progress: IllustrationStatusResult,
  ): Promise<void> {
    this.emitProgress({
      storyId: story.id,
      userId: story.userId,
      status: progress.status,
      progress,
    });

    if (
      progress.status === StoryIllustrationStatus.COMPLETED ||
      progress.status === StoryIllustrationStatus.PARTIALLY_FAILED ||
      progress.status === StoryIllustrationStatus.FAILED
    ) {
      await this.notifyStoryTerminal(story, progress);
      this.emitStoryCompleted({
        storyId: story.id,
        userId: story.userId,
        status: progress.status,
      });
    }
  }

  private async notifyStoryTerminal(
    story: Story,
    progress: IllustrationStatusResult,
  ): Promise<void> {
    if (story.illustrationGenerationNotifiedAt) {
      return;
    }

    const { type, title, message } = this.buildTerminalNotification(
      story,
      progress,
    );

    await this.notificationsService.create(story.userId, type, title, message, {
      storyId: story.id,
      status: progress.status,
      totalPages: progress.totalPages,
      completed: progress.completed,
      failed: progress.failed,
    });

    story.illustrationGenerationNotifiedAt = new Date();
    await this.storyRepository.save(story).catch(() => undefined);
  }

  private buildTerminalNotification(
    story: Story,
    progress: IllustrationStatusResult,
  ): { type: NotificationType; title: string; message: string } {
    if (progress.status === StoryIllustrationStatus.COMPLETED) {
      return {
        type: NotificationType.STORY_GENERATION_COMPLETED,
        title: 'Story illustrated',
        message: `All ${progress.completed} illustrations for "${story.title}" are ready.`,
      };
    }

    if (progress.status === StoryIllustrationStatus.FAILED) {
      return {
        type: NotificationType.STORY_GENERATION_FAILED,
        title: 'Story illustration failed',
        message: `Illustrations for "${story.title}" could not be generated.`,
      };
    }

    return {
      type: NotificationType.STORY_GENERATION_PARTIALLY_FAILED,
      title: 'Story partially illustrated',
      message: `${progress.completed} of ${progress.totalPages} illustrations for "${story.title}" are ready; ${progress.failed} failed.`,
    };
  }

  async notifyPageCompleted(
    storyId: string,
    userId: string,
    pageId: string,
    pageNumber: number,
    imageUrl: string,
  ): Promise<void> {
    await this.notificationsService.create(
      userId,
      NotificationType.STORY_PAGE_COMPLETED,
      `Page ${pageNumber} illustrated`,
      `Illustration for page ${pageNumber} is ready.`,
      { storyId, pageId, pageNumber, imageUrl },
    );
    this.emitPageCompleted({
      storyId,
      userId,
      pageId,
      pageNumber,
      imageUrl,
    });
  }

  async notifyGenerationStarted(
    userId: string,
    storyId: string,
    title: string,
    totalPages: number,
  ): Promise<void> {
    await this.notificationsService.create(
      userId,
      NotificationType.STORY_GENERATION_STARTED,
      'Story illustration started',
      `Generating illustrations for "${title}" (${totalPages} pages).`,
      { storyId, totalPages },
    );
  }

  async notifyDailyLimitReached(
    userId: string,
    storyId: string,
  ): Promise<void> {
    if (
      await this.notificationsService.hasDailyLimitNotification(userId, storyId)
    ) {
      return;
    }
    await this.notificationsService.create(
      userId,
      NotificationType.AI_DAILY_LIMIT_REACHED,
      'Daily AI limit reached',
      'The daily illustration budget has been reached. Generation will resume tomorrow.',
      { storyId },
    );
  }
}
