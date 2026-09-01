import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { User } from '../database/entities/user.entity';
import { Story } from '../database/entities/story.entity';
import { StoryVisibility } from '../common/enums/story-visibility.enum';
import { StoryStatus } from '../common/enums/story-status.enum';
import { IllustrationPageStatus } from '../illustration/enums/illustration-page-status.enum';
import { StoryLibraryService } from '../modules/story/services/story-library.service';
import { PublicCacheService } from '../common/services/public-cache.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: any;
  let storyRepo: any;
  let library: any;
  let cache: any;
  let cloudinary: any;

  let qb: any;

  function makeQb(): any {
    return {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      getRawOne: jest.fn(),
    };
  }

  function makeUser(overrides: Partial<User> = {}): User {
    const u = new User();
    Object.assign(u, {
      id: 'u-1',
      email: 'ahmed@example.com',
      password: 'HASHED_PASSWORD',
      firstName: 'Ahmed',
      lastName: 'Ali',
      name: 'Ahmed Ali',
      role: 'USER',
      isActive: true,
      emailVerified: true,
      avatarUrl: null,
      avatarPublicId: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    Object.assign(u, overrides);
    return u;
  }

  beforeEach(async () => {
    qb = makeQb();
    userRepo = { findOne: jest.fn(), save: jest.fn(), count: jest.fn() };
    storyRepo = { createQueryBuilder: jest.fn(() => qb), count: jest.fn() };
    library = {
      findOwned: jest.fn(),
      findShared: jest.fn(),
      findRecent: jest.fn(),
      findPublic: jest.fn(),
    };
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), bust: jest.fn().mockResolvedValue(undefined) };
    cloudinary = { uploadImage: jest.fn(), deleteImage: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Story), useValue: storyRepo },
        { provide: StoryLibraryService, useValue: library },
        { provide: PublicCacheService, useValue: cache },
        { provide: CloudinaryService, useValue: cloudinary },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('getProfile', () => {
    it('returns a safe profile without sensitive fields', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      const profile = await service.getProfile('u-1');

      expect(profile).toEqual({
        id: 'u-1',
        firstName: 'Ahmed',
        lastName: 'Ali',
        name: 'Ahmed Ali',
        email: 'ahmed@example.com',
        role: 'USER',
        emailVerified: true,
        avatarUrl: null,
        createdAt: expect.any(Date),
      });
      expect(profile).not.toHaveProperty('password');
      expect(profile).not.toHaveProperty('refreshTokens');
      expect(profile).not.toHaveProperty('tokenVersion');
    });

    it('throws NotFound for unknown user', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getProfile('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates allowed fields and keeps protected fields unchanged', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation(async (u) => u);

      const result = await service.updateProfile('u-1', {
        firstName: 'Omar',
        lastName: 'Hassan',
      });

      expect(user.firstName).toBe('Omar');
      expect(user.lastName).toBe('Hassan');
      expect(user.name).toBe('Omar Hassan');
      expect(user.email).toBe('ahmed@example.com');
      expect(user.role).toBe('USER');
      expect(user.emailVerified).toBe(true);
      expect(result.firstName).toBe('Omar');
      expect(cache.bust).toHaveBeenCalled();
    });

    it('throws NotFound when updating a missing user', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.updateProfile('nope', { firstName: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateAvatar', () => {
    const validFile = {
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('png'),
    } as Express.Multer.File;

    it('rejects when no file provided', async () => {
      await expect(service.updateAvatar('u-1', undefined)).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid MIME types', async () => {
      await expect(
        service.updateAvatar('u-1', { ...validFile, mimetype: 'text/plain' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects oversized images', async () => {
      const big = { ...validFile, size: 6 * 1024 * 1024 } as any;
      await expect(service.updateAvatar('u-1', big)).rejects.toThrow(BadRequestException);
    });

    it('uploads to Cloudinary folder, saves URL and deletes the old avatar', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ avatarUrl: 'https://cdn/old.jpg', avatarPublicId: 'storyforge/users/u-1/avatar/old' }),
      );
      cloudinary.uploadImage.mockResolvedValue({
        secureUrl: 'https://cdn/new.jpg',
        publicId: 'storyforge/users/u-1/avatar/new',
      });
      userRepo.save.mockImplementation(async (u) => u);

      const result = await service.updateAvatar('u-1', validFile);

      expect(cloudinary.uploadImage).toHaveBeenCalledWith(validFile.buffer, {
        folder: 'storyforge/users/u-1/avatar',
        publicId: 'avatar',
      });
      expect(cloudinary.deleteImage).toHaveBeenCalledWith('storyforge/users/u-1/avatar/old');
      expect(result).toEqual({
        avatarUrl: 'https://cdn/new.jpg',
        avatarPublicId: 'storyforge/users/u-1/avatar/new',
      });
      expect(cache.bust).toHaveBeenCalled();
    });

    it('does not delete the old avatar when public id is unchanged', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ avatarPublicId: 'storyforge/users/u-1/avatar/avatar' }),
      );
      cloudinary.uploadImage.mockResolvedValue({
        secureUrl: 'https://cdn/new.jpg',
        publicId: 'storyforge/users/u-1/avatar/avatar',
      });
      userRepo.save.mockImplementation(async (u) => u);

      await service.updateAvatar('u-1', validFile);

      expect(cloudinary.deleteImage).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('aggregates counts efficiently without loading entities', async () => {
      qb.getRawMany
        .mockResolvedValueOnce([
          { status: StoryStatus.READY, count: '8' },
          { status: StoryStatus.PROCESSING, count: '2' },
          { status: StoryStatus.FAILED, count: '2' },
        ])
        .mockResolvedValueOnce([
          { visibility: StoryVisibility.PUBLIC, count: '5' },
          { visibility: StoryVisibility.PRIVATE, count: '4' },
          { visibility: StoryVisibility.SHARED, count: '3' },
        ]);
      qb.getRawOne
        .mockResolvedValueOnce({ count: '120' })
        .mockResolvedValueOnce({ count: '95' });

      const stats = await service.getStats('u-1');

      expect(stats).toEqual({
        totalStories: 12,
        publicStories: 5,
        privateStories: 4,
        sharedStories: 3,
        completedStories: 8,
        processingStories: 2,
        failedStories: 2,
        draftStories: 0,
        totalPages: 120,
        illustratedPages: 95,
      });
      // Ensure the illustrated count filters by COMPLETED image status
      const calls = storyRepo.createQueryBuilder.mock.results;
      const illustratedQb = calls[3].value;
      expect(illustratedQb.innerJoin).toHaveBeenCalledWith(
        'story.pages',
        'page',
        'page.imageStatus = :completed',
        { completed: IllustrationPageStatus.COMPLETED },
      );
    });
  });

  describe('library delegation', () => {
    it('delegates to the shared library service for owned stories', async () => {
      library.findOwned.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });

      await service.getStoryLibrary('u-1', { page: 1, limit: 10 });

      expect(library.findOwned).toHaveBeenCalledWith('u-1', { page: 1, limit: 10 });
    });

    it('delegates for shared stories and recent stories', async () => {
      library.findShared.mockResolvedValue({ data: [], meta: {} });
      library.findRecent.mockResolvedValue([]);

      await service.getSharedStories('u-1', { page: 1, limit: 10 });
      await service.getRecentStories('u-1', 5);

      expect(library.findShared).toHaveBeenCalledWith('u-1', { page: 1, limit: 10 });
      expect(library.findRecent).toHaveBeenCalledWith('u-1', 5);
    });
  });

  describe('public author endpoints', () => {
    it('returns public profile with only the public story count', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      storyRepo.count.mockResolvedValue(8);

      const result = await service.getPublicProfile('u-1');

      expect(result).toEqual({
        id: 'u-1',
        name: 'Ahmed Ali',
        avatarUrl: null,
        stats: { publicStories: 8 },
      });
      expect(storyRepo.count).toHaveBeenCalledWith({
        where: { userId: 'u-1', visibility: StoryVisibility.PUBLIC },
      });
      expect(cache.set).toHaveBeenCalled();
      expect(result).not.toHaveProperty('email');
    });

    it('throws NotFound for a missing author', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getPublicProfile('nope')).rejects.toThrow(NotFoundException);
    });

    it('allows guests to list only public stories of an author', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ isActive: true }));
      library.findPublic.mockResolvedValue({ data: [], meta: {} });

      await service.getPublicStories('u-1', { page: 1, limit: 10 });

      expect(library.findPublic).toHaveBeenCalledWith({ page: 1, limit: 10 }, 'u-1');
    });

    it('rejects inactive authors', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ isActive: false }));
      await expect(service.getPublicStories('u-1', { page: 1, limit: 10 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});