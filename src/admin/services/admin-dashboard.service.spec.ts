import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { AiUsageService } from '../../ai/ai-usage.service';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;
  let usageService: { getUsageStatus: jest.Mock };
  let userRepo: { createQueryBuilder: jest.Mock };
  let storyRepo: { createQueryBuilder: jest.Mock; count: jest.Mock };
  let pageRepo: {
    createQueryBuilder: jest.Mock;
    count: jest.Mock;
  };

  beforeEach(async () => {
    usageService = {
      getUsageStatus: jest.fn().mockResolvedValue({
        used: 500,
        limit: 9500,
        remaining: 9000,
        percentage: 5.26,
        blocked: false,
        date: 'ai:usage:neurons:2026-01-01',
      }),
    };
    userRepo = { createQueryBuilder: jest.fn() };
    storyRepo = { createQueryBuilder: jest.fn(), count: jest.fn() };
    pageRepo = { createQueryBuilder: jest.fn(), count: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Story), useValue: storyRepo },
        { provide: getRepositoryToken(StoryPage), useValue: pageRepo },
        { provide: AiUsageService, useValue: usageService },
      ],
    }).compile();

    service = module.get(AdminDashboardService);
  });

  it('aggregates users, stories and AI usage', async () => {
    userRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { role: 'USER', count: '8', active: '6' },
        { role: 'ADMIN', count: '1', active: '1' },
      ]),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });

    storyRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { status: 'READY', count: '4' },
        { status: 'PROCESSING', count: '1' },
      ]),
    });
    storyRepo.count.mockResolvedValue(1);

    pageRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        total: '30',
        completed: '20',
        failed: '2',
        inFlight: '3',
      }),
    });
    pageRepo.count.mockResolvedValue(2);

    const result = await service.getSummary();

    expect(result.users.total).toBe(9);
    expect(result.users.active).toBe(7);
    expect(result.stories.total).toBe(5);
    expect(result.stories.byStatus.ready).toBe(4);
    expect(result.generations.pageCounts.failed).toBe(2);
    expect(result.aiUsage.used).toBe(500);
    expect(result.aiUsage.blocked).toBe(false);
  });
});
