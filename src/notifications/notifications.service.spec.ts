import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Notification } from './notification.entity';
import { NotificationType } from './notification-type.enum';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const userId = 'user-1';

  function makeQueryBuilder(terminal: Record<string, jest.Mock>): any {
    return {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      ...terminal,
    };
  }

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: repo },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  function makeNotification(
    overrides: Partial<Notification> = {},
  ): Notification {
    return Object.assign(new Notification(), {
      id: 'notif-1',
      userId,
      type: NotificationType.STORY_PAGE_COMPLETED,
      title: 'Title',
      isRead: false,
      data: null,
      ...overrides,
    });
  }

  describe('create', () => {
    it('creates and saves a notification', async () => {
      const entity = makeNotification();
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create(
        userId,
        NotificationType.STORY_PAGE_COMPLETED,
        'Página completada',
        'Illustration for page 1 is ready.',
        { storyId: 'story-1' },
      );

      expect(repo.create).toHaveBeenCalledWith({
        userId,
        type: NotificationType.STORY_PAGE_COMPLETED,
        title: 'Página completada',
        message: 'Illustration for page 1 is ready.',
        data: { storyId: 'story-1' },
        isRead: false,
      });
      expect(repo.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
    });
  });

  describe('getUserNotifications', () => {
    it('returns paginated notifications with unread count', async () => {
      const notifs = [makeNotification()];
      const qb = makeQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([notifs, 1]),
      });
      repo.createQueryBuilder.mockReturnValue(qb);
      repo.count.mockResolvedValue(0);

      const result = await service.getUserNotifications(
        userId,
        new NotificationQueryDto(),
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('notification');
      expect(qb.where).toHaveBeenCalled();
    });

    it('filters unread only when requested', async () => {
      const qb = makeQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      repo.createQueryBuilder.mockReturnValue(qb);
      repo.count.mockResolvedValue(0);

      await service.getUserNotifications(
        userId,
        Object.assign(new NotificationQueryDto(), { unreadOnly: true }),
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        'notification.isRead = :unread',
        { unread: false },
      );
    });

    it('returns hasNext/hasPrevious pagination flags', async () => {
      const qb = makeQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([[makeNotification()], 50]),
      });
      repo.createQueryBuilder.mockReturnValue(qb);
      repo.count.mockResolvedValue(3);

      const result = await service.getUserNotifications(
        userId,
        Object.assign(new NotificationQueryDto(), { page: 2, limit: 20 }),
      );

      expect(result.meta.total).toBe(50);
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(true);
      expect(result.unreadCount).toBe(3);
    });
  });

  describe('getUnreadCount', () => {
    it('returns the unread count', async () => {
      repo.count.mockResolvedValue(3);
      const result = await service.getUnreadCount(userId);
      expect(result).toBe(3);
      expect(repo.count).toHaveBeenCalledWith({
        where: { userId, isRead: false },
      });
    });
  });

  describe('markAsRead', () => {
    it('marks a read notification as read', async () => {
      const entity = makeNotification();
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.markAsRead(userId, 'notif-1');

      expect(repo.save).toHaveBeenCalled();
      expect(result.isRead).toBe(true);
    });

    it('throws when the notification belongs to another user', async () => {
      repo.findOne.mockResolvedValue(makeNotification({ userId: 'user-2' }));
      await expect(
        service.markAsRead(userId, 'notif-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('updates all unread notifications for the user', async () => {
      repo.update.mockResolvedValue({ affected: 2 });
      const result = await service.markAllAsRead(userId);
      expect(result).toEqual({ updated: 2 });
      expect(repo.update).toHaveBeenCalledWith(
        { userId, isRead: false },
        { isRead: true, readAt: expect.any(Date) },
      );
    });
  });

  describe('delete', () => {
    it('deletes a notification', async () => {
      repo.findOne.mockResolvedValue(makeNotification());
      repo.delete.mockResolvedValue({ affected: 1 });

      await service.delete(userId, 'notif-1');

      expect(repo.delete).toHaveBeenCalledWith('notif-1');
    });

    it('throws when the notification belongs to another user', async () => {
      repo.findOne.mockResolvedValue(makeNotification({ userId: 'user-2' }));
      await expect(service.delete(userId, 'notif-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('hasDailyLimitNotification', () => {
    it('detects an existing daily-limit notification for the story', async () => {
      const qb = makeQueryBuilder({ getCount: jest.fn().mockResolvedValue(1) });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.hasDailyLimitNotification(userId, 'story-1');

      expect(result).toBe(true);
      expect(qb.andWhere).toHaveBeenCalledWith(
        "(notification.data->>'storyId') = :storyId",
        { storyId: 'story-1' },
      );
    });

    it('returns false when no notification exists', async () => {
      const qb = makeQueryBuilder({ getCount: jest.fn().mockResolvedValue(0) });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.hasDailyLimitNotification(userId, 'story-1');

      expect(result).toBe(false);
    });
  });

  describe('purgeOlderThan', () => {
    it('deletes notifications older than the threshold', async () => {
      const qb = makeQueryBuilder({
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      });
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.purgeOlderThan(90);

      expect(result).toBe(5);
      expect(qb.delete).toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalled();
    });
  });

  describe('toResponseDto', () => {
    it('maps the entity to the DTO shape', () => {
      const entity = makeNotification({ id: 'n1' });
      const dto = service.toResponseDto(entity);
      expect(dto.id).toBe('n1');
      expect(dto.isRead).toBe(false);
    });
  });
});
