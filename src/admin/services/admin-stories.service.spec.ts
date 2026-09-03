import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { StoryShare } from '../../database/entities/story-share.entity';
import { Notification } from '../../notifications/notification.entity';
import { StoryStatus } from '../../common/enums/story-status.enum';
import { IllustrationPageStatus } from '../../illustration/enums/illustration-page-status.enum';
import { AdminStoriesService } from './admin-stories.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { PublicCacheService } from '../../common/services/public-cache.service';
import { IllustrationStatusService } from '../../illustration/services/illustration-status.service';
import { IllustrationService } from '../../illustration/illustration.service';

describe('AdminStoriesService', () => {
  let service: AdminStoriesService;
  let storyRepo: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let pageRepo: { createQueryBuilder: jest.Mock; find: jest.Mock; findOne: jest.Mock };
  let shareRepo: { createQueryBuilder: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let cloudinary: { deleteImage: jest.Mock };
  let cache: { bust: jest.Mock };
  let statusService: { computeStatus: jest.Mock };
  let illustrationService: {
    regenerateCover: jest.Mock;
    regeneratePage: jest.Mock;
  };

  function makeStory(overrides: Partial<Story> = {}): Story {
    return Object.assign(new Story(), {
      id: 'story-1',
      userId: 'user-1',
      title: 'Story',
      status: StoryStatus.READY,
      pages: [],
      ...overrides,
    });
  }

  function mockListQueryBuilder(result: any) {
    return {
      leftJoinAndMapOne: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue(result),
    };
  }

  beforeEach(async () => {
    storyRepo = { createQueryBuilder: jest.fn(), findOne: jest.fn() };
    pageRepo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    shareRepo = { createQueryBuilder: jest.fn() };
    dataSource = {
      transaction: jest.fn((cb) => cb({ delete: jest.fn(), createQueryBuilder: jest.fn() })),
    };
    cloudinary = { deleteImage: jest.fn().mockResolvedValue(undefined) };
    cache = { bust: jest.fn().mockResolvedValue(undefined) };
    statusService = {
      computeStatus: jest.fn().mockReturnValue({
        status: 'COMPLETED',
        totalPages: 3,
        pending: 0,
        queued: 0,
        generating: 0,
        uploading: 0,
        completed: 3,
        failed: 0,
        progress: 100,
      }),
    };
    illustrationService = {
      regenerateCover: jest.fn().mockResolvedValue(undefined),
      regeneratePage: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        AdminStoriesService,
        { provide: getRepositoryToken(Story), useValue: storyRepo },
        { provide: getRepositoryToken(StoryPage), useValue: pageRepo },
        { provide: getRepositoryToken(StoryShare), useValue: shareRepo },
        {
          provide: getRepositoryToken(Notification),
          useValue: {},
        },
        { provide: DataSource, useValue: dataSource },
        { provide: CloudinaryService, useValue: cloudinary },
        { provide: PublicCacheService, useValue: cache },
        { provide: IllustrationStatusService, useValue: statusService },
        { provide: IllustrationService, useValue: illustrationService },
      ],
    }).compile();

    service = module.get(AdminStoriesService);
  });

  describe('list', () => {
    it('returns paginated stories', async () => {
      storyRepo.createQueryBuilder.mockReturnValue(
        mockListQueryBuilder([[], 0]),
      );
      const result = await service.list({ page: 1, limit: 20 });
      expect(result.meta.total).toBe(0);
      expect(result.data).toEqual([]);
    });
  });

  describe('getById', () => {
    it('returns story with pages and stats', async () => {
      storyRepo.findOne.mockResolvedValue(makeStory());
      pageRepo.find.mockResolvedValue([
        { id: 'p1', pageNumber: 1, imageStatus: IllustrationPageStatus.COMPLETED },
      ]);
      const result = await service.getById('story-1');
      expect(result.id).toBe('story-1');
      expect(result.stats.totalPages).toBe(3);
      expect(result.stats.illustratedPages).toBe(3);
    });

    it('throws NotFound when story is missing', async () => {
      storyRepo.findOne.mockResolvedValue(null);
      await expect(service.getById('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('retryFailed', () => {
    it('retries cover generation', async () => {
      storyRepo.findOne.mockResolvedValue(makeStory());
      const result = await service.retryFailed('story-1', 'cover');
      expect(illustrationService.regenerateCover).toHaveBeenCalledWith(
        'user-1',
        'story-1',
      );
      expect(result.success).toBe(true);
    });

    it('retries a failed page', async () => {
      storyRepo.findOne.mockResolvedValue(makeStory());
      pageRepo.findOne.mockResolvedValue({
        id: 'page-1',
        imageStatus: IllustrationPageStatus.FAILED,
      });
      const result = await service.retryFailed('story-1', 'page');
      expect(illustrationService.regeneratePage).toHaveBeenCalledWith(
        'user-1',
        'story-1',
        'page-1',
      );
      expect(result.success).toBe(true);
    });

    it('throws NotFound when there are no failed pages', async () => {
      storyRepo.findOne.mockResolvedValue(makeStory());
      pageRepo.findOne.mockResolvedValue(null);
      await expect(service.retryFailed('story-1', 'page')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFound if story is missing', async () => {
      storyRepo.findOne.mockResolvedValue(null);
      await expect(service.retryFailed('nope', 'page')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
