import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { StoryPage } from '../../database/entities/story-page.entity';
import { Story } from '../../database/entities/story.entity';
import { AiUsageService } from '../../ai/ai-usage.service';
import {
  ILLUSTRATION_QUEUE,
  ILLUSTRATION_JOB_PREFIX,
  ILLUSTRATION_COVER_JOB_PREFIX,
} from '../../illustration/illustration.constants';
import { BULLMQ_CONNECTION } from '../../bullmq/bullmq.constants';
import { IllustrationStatusService } from '../../illustration/services/illustration-status.service';
import { IllustrationPageStatus } from '../../illustration/enums/illustration-page-status.enum';
import { GenerationQueryDto } from '../dto/admin-query.dto';

@Injectable()
export class AdminSystemService {
  private readonly logger = new Logger(AdminSystemService.name);

  constructor(
    @Inject(ILLUSTRATION_QUEUE)
    private readonly illustrationQueue: Queue,
    @Inject(BULLMQ_CONNECTION)
    private readonly bullConnection: Redis,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryPage)
    private readonly storyPageRepository: Repository<StoryPage>,
    private readonly usageService: AiUsageService,
    private readonly illustrationStatusService: IllustrationStatusService,
  ) {}

  async getQueueStats() {
    const [waiting, active, delayed, failed, completed] = await Promise.all([
      this.illustrationQueue.getWaitingCount(),
      this.illustrationQueue.getActiveCount(),
      this.illustrationQueue.getDelayedCount(),
      this.illustrationQueue.getFailedCount(),
      this.illustrationQueue.getCompletedCount(),
    ]);

    return {
      queue: ILLUSTRATION_QUEUE,
      counts: {
        waiting,
        active,
        delayed,
        failed,
        completed,
        total: waiting + active + delayed,
      },
    };
  }

  async getGenerationList(query: GenerationQueryDto) {
    const page = query.page > 0 ? query.page : 1;
    const limit = query.limit > 0 && query.limit <= 100 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.storyPageRepository
      .createQueryBuilder('page')
      .leftJoinAndMapOne('page.story', 'page.story', 'story')
      .leftJoinAndMapOne('story.user', 'story.user', 'user');

    if (query.storyId) {
      qb.andWhere('page.storyId = :storyId', { storyId: query.storyId });
    }
    if (query.imageStatus) {
      qb.andWhere('page.imageStatus = :imageStatus', {
        imageStatus: query.imageStatus,
      });
    }

    qb.orderBy('page.updatedAt', 'DESC');

    const [pages, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: pages.map((page: any) => ({
        pageId: page.id,
        pageNumber: page.pageNumber,
        imageStatus: page.imageStatus ?? null,
        imageUrl: page.imageUrl ?? null,
        imageError: page.imageError ?? null,
        imageGeneratedAt: page.imageGeneratedAt ?? null,
        updatedAt: page.updatedAt,
        story: page.story
          ? {
              id: page.story.id,
              title: page.story.title,
            }
          : null,
        owner: page.story?.user
          ? { id: page.story.user.id, email: page.story.user.email }
          : null,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async getAiUsage() {
    const status = await this.usageService.getUsageStatus();
    return {
      dailyLimit: Number(process.env.AI_DAILY_NEURON_LIMIT) || 10000,
      safetyLimit: status.limit,
      used: status.used,
      remaining: status.remaining,
      percentage: status.percentage,
      blocked: status.blocked,
      date: status.date,
    };
  }

  async resetAiUsage() {
    await this.usageService.resetDailyUsage();
    this.logger.log('[Admin] AI usage reset');
    return { success: true, message: 'Daily AI usage reset' };
  }

  async getHealth() {
    let redisOk = false;
    let queueOk = false;
    const redisLatencyMs: number | null = null;

    try {
      const pong = await this.bullConnection.ping();
      redisOk = pong === 'PONG';
    } catch (error: any) {
      this.logger.error(`[Admin] Redis health check failed: ${error?.message}`);
    }

    try {
      const info = await this.illustrationQueue.getJobCounts();
      queueOk = typeof info?.waiting === 'number';
    } catch (error: any) {
      this.logger.error(
        `[Admin] Queue health check failed: ${error?.message}`,
      );
    }

    let dbOk = false;
    try {
      await this.storyRepository.query('SELECT 1');
      dbOk = true;
    } catch (error: any) {
      this.logger.error(`[Admin] DB health check failed: ${error?.message}`);
    }

    const checks = {
      database: dbOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
      queue: queueOk ? 'up' : 'down',
    };

    const overall =
      dbOk && redisOk && queueOk ? 'ok' : dbOk ? 'degraded' : 'down';

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  async getQueueFailures() {
    const failedJobs = await this.illustrationQueue.getFailed(0, 50);
    return failedJobs.map((job: any) => ({
      id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? null,
      timestamp: job.finishedOn ? new Date(job.finishedOn) : null,
      processedOn: job.processedOn ? new Date(job.processedOn) : null,
      data: {
        storyId: job.data?.storyId ?? null,
        storyPageId: job.data?.storyPageId ?? null,
        userId: job.data?.userId ?? null,
      },
    }));
  }
}
