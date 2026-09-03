import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let mockUsers: any;
  let mockNotifications: any;

  beforeEach(async () => {
    mockUsers = {
      getProfile: jest.fn(),
      getStats: jest.fn(),
      getRecentStories: jest.fn(),
    };
    mockNotifications = {
      getUserNotifications: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: UsersService, useValue: mockUsers },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  it('aggregates profile, stats, recent stories and notifications', async () => {
    mockUsers.getProfile.mockResolvedValue({
      id: 'u-1',
      name: 'Ahmed Ali',
      avatarUrl: 'https://cdn/a.jpg',
    });
    mockUsers.getStats.mockResolvedValue({
      totalStories: 12,
      completedStories: 8,
      processingStories: 2,
      sharedStories: 3,
      illustratedPages: 95,
    });
    mockUsers.getRecentStories.mockResolvedValue([
      { id: 's-1', title: 'Forest' },
    ]);
    mockNotifications.getUserNotifications.mockResolvedValue({
      data: [
        {
          id: 'n-1',
          title: 'Story ready',
          message: 'Your story is ready',
          type: 'STORY_GENERATION_COMPLETED',
          isRead: false,
          createdAt: new Date(),
        },
      ],
      meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
    });

    const result = await service.getDashboard('u-1');

    expect(mockUsers.getRecentStories).toHaveBeenCalledWith('u-1');
    expect(mockNotifications.getUserNotifications).toHaveBeenCalledWith('u-1', {
      page: 1,
      limit: 5,
    });

    expect(result).toEqual({
      user: { id: 'u-1', name: 'Ahmed Ali', avatarUrl: 'https://cdn/a.jpg' },
      stats: expect.objectContaining({ totalStories: 12 }),
      recentStories: [{ id: 's-1', title: 'Forest' }],
      recentNotifications: [
        expect.objectContaining({ id: 'n-1', isRead: false }),
      ],
    });
  });

  it('returns empty collections when the user has no data', async () => {
    mockUsers.getProfile.mockResolvedValue({
      id: 'u-1',
      name: 'Ahmed',
      avatarUrl: null,
    });
    mockUsers.getStats.mockResolvedValue({ totalStories: 0 });
    mockUsers.getRecentStories.mockResolvedValue([]);
    mockNotifications.getUserNotifications.mockResolvedValue({ data: [] });

    const result = await service.getDashboard('u-1');

    expect(result.recentStories).toEqual([]);
    expect(result.recentNotifications).toEqual([]);
    expect(result.stats).toEqual({ totalStories: 0 });
  });
});
