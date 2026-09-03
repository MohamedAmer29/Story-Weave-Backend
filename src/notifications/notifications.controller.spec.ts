import { Test } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: {
    getUserNotifications: jest.Mock;
    getUnreadCount: jest.Mock;
    markAsRead: jest.Mock;
    markAllAsRead: jest.Mock;
    delete: jest.Mock;
  };

  const userId = 'user-1';

  beforeEach(async () => {
    service = {
      getUserNotifications: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      delete: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: service },
        { provide: 'JwtAuthGuard', useValue: { canActivate: () => true } },
      ],
    }).compile();

    controller = module.get(NotificationsController);
  });

  describe('getNotifications', () => {
    it('lists notifications for the user', async () => {
      service.getUserNotifications.mockResolvedValue({
        data: [],
        unreadCount: 0,
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const result = await controller.getNotifications(
        userId,
        new NotificationQueryDto(),
      );

      expect(service.getUserNotifications).toHaveBeenCalledWith(
        'user-1',
        expect.any(NotificationQueryDto),
      );
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getUnreadCount', () => {
    it('returns the unread count', async () => {
      service.getUnreadCount.mockResolvedValue(2);
      const result = await controller.getUnreadCount(userId);
      expect(result).toEqual({ unreadCount: 2 });
    });
  });

  describe('markAsRead', () => {
    it('marks a notification read', async () => {
      service.markAsRead.mockResolvedValue({ id: 'n1', isRead: true });

      const result = await controller.markAsRead(userId, 'n1');

      expect(service.markAsRead).toHaveBeenCalledWith('user-1', 'n1');
      expect(result.isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications read', async () => {
      service.markAllAsRead.mockResolvedValue({ updated: 3 });
      const result = await controller.markAllAsRead(userId);
      expect(result).toEqual({ updated: 3 });
    });
  });

  describe('delete', () => {
    it('deletes a notification', async () => {
      service.delete.mockResolvedValue(undefined);
      await controller.delete(userId, 'n1');
      expect(service.delete).toHaveBeenCalledWith('user-1', 'n1');
    });
  });
});
