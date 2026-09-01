import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getDashboard(userId: string) {
    const [profile, stats, recentStories, notifications] = await Promise.all([
      this.usersService.getProfile(userId),
      this.usersService.getStats(userId),
      this.usersService.getRecentStories(userId),
      this.notificationsService.getUserNotifications(userId, {
        page: 1,
        limit: 5,
      }),
    ]);

    return {
      user: {
        id: profile.id,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
      stats,
      recentStories,
      recentNotifications: notifications.data,
    };
  }
}