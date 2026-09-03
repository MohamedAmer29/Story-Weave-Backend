import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '../../database/entities/user.entity';
import { Story } from '../../database/entities/story.entity';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let userRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
  };
  let storyRepo: {
    createQueryBuilder: jest.Mock;
    count: jest.Mock;
  };

  function makeUser(overrides: Partial<User> = {}): User {
    return Object.assign(new User(), {
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      name: 'Jane Doe',
      role: UserRole.USER,
      isActive: true,
      emailVerified: true,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
  }

  function mockQueryBuilder(result: any) {
    return {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue(result),
    };
  }

  beforeEach(async () => {
    userRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((u) => Promise.resolve(u)),
      count: jest.fn(),
    };
    storyRepo = {
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
        {
          provide: getRepositoryToken(Story),
          useValue: storyRepo,
        },
      ],
    }).compile();

    service = module.get(AdminUsersService);
  });

  describe('list', () => {
    it('returns paginated users with story counts', async () => {
      const users = [makeUser(), makeUser({ id: 'user-2' })];
      userRepo.createQueryBuilder.mockReturnValue(
        mockQueryBuilder([users, 2]),
      );
      storyRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([
            { userId: 'user-1', count: '3' },
            { userId: 'user-2', count: '1' },
          ]),
      });

      const result = await service.list({ page: 1, limit: 20 });

      expect(result.meta.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].storyCount).toBe(3);
      expect(result.data[0].__password).toBeUndefined();
    });
  });

  describe('getById', () => {
    it('returns user with story count', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      storyRepo.count.mockResolvedValue(5);
      const result = await service.getById('user-1');
      expect(result.id).toBe('user-1');
      expect(result.storyCount).toBe(5);
    });

    it('throws NotFoundException when user is missing', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getById('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateRole', () => {
    it('updates the role', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      const result = await service.updateRole(
        { id: 'admin-1' },
        'user-1',
        UserRole.MANAGER,
      );
      expect(result.role).toBe(UserRole.MANAGER);
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('prevents an ADMIN from revoking their own role', async () => {
      const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      userRepo.findOne.mockResolvedValue(admin);
      await expect(
        service.updateRole(
          { id: 'admin-1' },
          'admin-1',
          UserRole.USER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException for missing user', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateRole({ id: 'a' }, 'x', UserRole.USER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('setActive', () => {
    it('activates a user', async () => {
      const user = makeUser({ isActive: false });
      userRepo.findOne.mockResolvedValue(user);
      const result = await service.setActive({ id: 'admin-1' }, 'user-1', true);
      expect(result.isActive).toBe(true);
    });

    it('prevents deactivating your own admin account', async () => {
      const admin = makeUser({ id: 'admin-1', role: UserRole.ADMIN });
      userRepo.findOne.mockResolvedValue(admin);
      await expect(
        service.setActive({ id: 'admin-1' }, 'admin-1', false),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
