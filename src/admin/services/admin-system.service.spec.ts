import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { AiUsageService } from '../../ai/ai-usage.service';
import { AdminSystemService } from './admin-system.service';
import { IllustrationStatusService } from '../../illustration/services/illustration-status.service';
import { ILLUSTRATION_QUEUE } from '../../illustration/illustration.constants';
import { BULLMQ_CONNECTION } from '../../bullmq/bullmq.constants';

describe('AdminSystemService', () => {
  let service: AdminSystemService;
  let queue: Record<string, jest.Mock>;
  let connection: { ping: jest.Mock };
  let storyRepo: { query: jest.Mock; createQueryBuilder: jest.Mock };
  let pageRepo: { createQueryBuilder: jest.Mock };
  let usageService: {
    getUsageStatus: jest.Mock;
    resetDailyUsage: jest.Mock;
  };
  let statusService: { computeStatus: jest.Mock };

  beforeEach(async () => {
    queue = {
      getWaitingCount: jest.fn().mockResolvedValue(5),
      getActiveCount: jest.fn().mockResolvedValue(2),
      getDelayedCount: jest.fn().mockResolvedValue(1),
      getFailedCount: jest.fn().mockResolvedValue(3),
      getCompletedCount: jest.fn().mockResolvedValue(100),
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 5 }),
      getFailed: jest.fn().mockResolvedValue([]),
    };
    connection = { ping: jest.fn().mockResolvedValue('PONG') };
    storyRepo = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      createQueryBuilder: jest.fn(),
    };
    pageRepo = { createQueryBuilder: jest.fn() };
    usageService = {
      getUsageStatus: jest.fn().mockResolvedValue({
        used: 100,
        limit: 9500,
        remaining: 9400,
        percentage: 1.05,
        blocked: false,
        date: 'ai:usage:neurons:2026-01-01',
      }),
      resetDailyUsage: jest.fn().mockResolvedValue(undefined),
    };
    statusService = { computeStatus: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AdminSystemService,
        { provide: ILLUSTRATION_QUEUE, useValue: queue },
        { provide: BULLMQ_CONNECTION, useValue: connection },
        { provide: getRepositoryToken(Story), useValue: storyRepo },
        { provide: getRepositoryToken(StoryPage), useValue: pageRepo },
        { provide: AiUsageService, useValue: usageService },
        { provide: IllustrationStatusService, useValue: statusService },
      ],
    }).compile();

    service = module.get(AdminSystemService);
  });

  describe('getQueueStats', () => {
    it('returns queue counts', async () => {
      const result = await service.getQueueStats();
      expect(result.queue).toBe('illustration');
      expect(result.counts.waiting).toBe(5);
      expect(result.counts.active).toBe(2);
      expect(result.counts.failed).toBe(3);
      expect(result.counts.total).toBe(8);
    });
  });

  describe('getAiUsage', () => {
    it('returns usage status', async () => {
      const result = await service.getAiUsage();
      expect(result.used).toBe(100);
      expect(result.blocked).toBe(false);
    });
  });

  describe('resetAiUsage', () => {
    it('resets the daily counter', async () => {
      const result = await service.resetAiUsage();
      expect(usageService.resetDailyUsage).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('getHealth', () => {
    it('reports up when DB, Redis and queue respond', async () => {
      const result = await service.getHealth();
      expect(result.status).toBe('ok');
      expect(result.checks.database).toBe('up');
      expect(result.checks.redis).toBe('up');
      expect(result.checks.queue).toBe('up');
    });

    it('reports degraded when Redis is down', async () => {
      connection.ping.mockRejectedValue(new Error('down'));
      const result = await service.getHealth();
      expect(result.status).toBe('degraded');
      expect(result.checks.redis).toBe('down');
    });
  });
});
