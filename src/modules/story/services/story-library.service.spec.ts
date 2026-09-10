import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Story } from '../../../database/entities/story.entity';
import { StoryPage } from '../../../database/entities/story-page.entity';
import { StoryShare } from '../../../database/entities/story-share.entity';
import { User } from '../../../database/entities/user.entity';
import { StoryVisibility } from '../../../common/enums/story-visibility.enum';
import { StoryStatus } from '../../../common/enums/story-status.enum';
import { SourceType } from '../../../common/enums/source-type.enum';
import { IllustrationPageStatus } from '../../../illustration/enums/illustration-page-status.enum';
import { PublicCacheService } from '../../../common/services/public-cache.service';
import { StoryFavorite } from '../../../database/entities/story-favorite.entity';
import { StoryLibraryService } from './story-library.service';

describe('StoryLibraryService', () => {
  let service: StoryLibraryService;
  let storyRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
  };
  let pageRepo: {
    createQueryBuilder: jest.Mock;
  };
  let favoriteRepo: {
    createQueryBuilder: jest.Mock;
  };
  let cache: { get: jest.Mock; set: jest.Mock };
  let userRepo: { find: jest.Mock };

  let qb: any;
  let pageQb: any;
  let favoriteQb: any;

  function makeQb(terminal: Record<string, unknown>): any {
    return {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      distinctOn: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
      ...terminal,
    };
  }

  function makeStory(overrides: Partial<Story> = {}): Story {
    const story = new Story();
    Object.assign(story, {
      id: 's-1',
      userId: 'u-1',
      title: 'The Magical Forest',
      description: 'A forest story',
      originalText: 'Once upon a time...',
      sourceType: SourceType.TEXT,
      status: StoryStatus.READY,
      visibility: StoryVisibility.PUBLIC,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    });
    Object.assign(story, overrides);
    return story;
  }

  beforeEach(async () => {
    qb = makeQb({});
    pageQb = makeQb({});
    favoriteQb = makeQb({});
    storyRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn(),
    };
    pageRepo = { createQueryBuilder: jest.fn().mockReturnValue(pageQb) };
    favoriteRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(favoriteQb),
    };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    userRepo = { find: jest.fn().mockResolvedValue([]) };

    const module = await Test.createTestingModule({
      providers: [
        StoryLibraryService,
        { provide: getRepositoryToken(Story), useValue: storyRepo },
        { provide: getRepositoryToken(StoryPage), useValue: pageRepo },
        { provide: getRepositoryToken(StoryShare), useValue: {} },
        { provide: getRepositoryToken(StoryFavorite), useValue: favoriteRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: PublicCacheService, useValue: cache },
      ],
    }).compile();

    service = module.get(StoryLibraryService);
  });

  describe('findOwned', () => {
    it('returns paginated owned stories with summaries', async () => {
      const stories = [
        makeStory({
          coverImageUrl: 'https://cdn/cover.jpg',
          coverImageStatus: IllustrationPageStatus.COMPLETED,
        }),
      ];
      qb.getManyAndCount.mockResolvedValue([stories, 1]);
      pageQb.getRawMany.mockResolvedValueOnce([
        { storyId: 's-1', total: '5', illustrated: '3' },
      ]);
      pageQb.getRawMany.mockResolvedValueOnce([
        { storyId: 's-1', imageUrl: 'https://cdn/cover.jpg' },
      ]);

      const result = await service.findOwned('u-1', {
        page: 1,
        limit: 10,
        search: 'forest',
        status: StoryStatus.READY,
        visibility: StoryVisibility.PUBLIC,
        sourceType: SourceType.TEXT,
        sort: 'latest',
      });

      expect(qb.where).toHaveBeenCalledWith('story.userId = :userId', {
        userId: 'u-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(story.title ILIKE :search OR story.description ILIKE :search)',
        { search: '%forest%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('story.status = :status', {
        status: StoryStatus.READY,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'story.visibility = :visibility',
        { visibility: StoryVisibility.PUBLIC },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'story.sourceType = :sourceType',
        { sourceType: SourceType.TEXT },
      );
      expect(qb.orderBy).toHaveBeenCalledWith('story.createdAt', 'DESC');

      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(result.data[0]).toMatchObject({
        id: 's-1',
        coverImageUrl: 'https://cdn/cover.jpg',
        totalPages: 5,
        illustratedPages: 3,
      });
    });
  });

  describe('findShared', () => {
    it('joins shares and excludes private stories', async () => {
      const shared = makeStory({
        visibility: StoryVisibility.SHARED,
        id: 's-shared',
      });
      qb.getManyAndCount.mockResolvedValue([[shared], 1]);

      const result = await service.findShared('u-2', { page: 1, limit: 10 });

      expect(qb.innerJoin).toHaveBeenCalledWith(
        StoryShare,
        'share',
        'share.storyId = story.id',
      );
      expect(qb.where).toHaveBeenCalledWith('share.userId = :userId', {
        userId: 'u-2',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'story.visibility != :privateVis',
        {
          privateVis: StoryVisibility.PRIVATE,
        },
      );
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findPublic', () => {
    it('queries only PUBLIC stories for guests and stores cache', async () => {
      const story = makeStory();
      qb.getManyAndCount.mockResolvedValue([[story], 1]);

      const result = await service.findPublic({
        page: 1,
        limit: 10,
        search: 'magic',
      });

      expect(qb.where).toHaveBeenCalledWith(
        'story.visibility IN (:...visibleVisibilities)',
        { visibleVisibilities: [StoryVisibility.PUBLIC] },
      );
      expect(result.data[0].id).toBe('s-1');
      expect(cache.set).toHaveBeenCalled();
    });

    it('queries PUBLIC + MEMBERS for authenticated viewers', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPublic({ page: 1, limit: 10 }, undefined, 'u-viewer');

      expect(qb.where).toHaveBeenCalledWith(
        'story.visibility IN (:...visibleVisibilities)',
        {
          visibleVisibilities: [
            StoryVisibility.PUBLIC,
            StoryVisibility.MEMBERS,
          ],
        },
      );
    });

    it('filters by author when authorId provided and does not filter private stories', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPublic({ page: 1, limit: 10 }, 'u-author');

      expect(qb.where).toHaveBeenCalledWith(
        'story.visibility IN (:...visibleVisibilities)',
        { visibleVisibilities: [StoryVisibility.PUBLIC] },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('story.userId = :authorId', {
        authorId: 'u-author',
      });
    });

    it('scopes the cache key by viewer (members vs guests)', async () => {
      cache.get.mockResolvedValueOnce(null);
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPublic({ page: 1, limit: 10 }, undefined, 'u-viewer');

      expect(cache.get).toHaveBeenCalledWith(
        'public-stories',
        expect.stringContaining('members|all|1|10||'),
      );
    });

    it('returns cached response without hitting the database', async () => {
      cache.get.mockResolvedValueOnce({
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      const result = await service.findPublic({ page: 1, limit: 10 });

      expect(result.meta.total).toBe(0);
      expect(qb.getManyAndCount).not.toHaveBeenCalled();
    });
  });

  describe('findFavorites', () => {
    it('returns stories in favorite order and paginates', async () => {
      const favorite = new StoryFavorite();
      Object.assign(favorite, {
        storyId: 's-2',
        createdAt: new Date('2026-02-01T00:00:00Z'),
      });
      favoriteQb.getManyAndCount.mockResolvedValue([[favorite], 1]);

      const story = makeStory({ id: 's-2' });
      qb.getMany.mockResolvedValueOnce([story]);
      pageQb.getRawMany.mockResolvedValueOnce([]);

      const result = await service.findFavorites('u-1', {
        page: 1,
        limit: 10,
      });

      expect(favoriteQb.where).toHaveBeenCalledWith(
        'favorite.userId = :userId',
        { userId: 'u-1' },
      );
      expect(favoriteQb.orderBy).toHaveBeenCalledWith(
        'favorite.createdAt',
        'DESC',
      );
      expect(qb.where).toHaveBeenCalledWith('story.id IN (:...storyIds)', {
        storyIds: ['s-2'],
      });
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(result.data[0].id).toBe('s-2');
    });

    it('returns empty result when there are no favorites', async () => {
      favoriteQb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findFavorites('u-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(qb.getMany).not.toHaveBeenCalled();
    });

    it('filters by search across story title and description', async () => {
      favoriteQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findFavorites('u-1', {
        page: 1,
        limit: 10,
        search: 'forest',
      });

      expect(favoriteQb.innerJoin).toHaveBeenCalledWith(
        Story,
        'story',
        'story.id = favorite.storyId',
      );
      expect(favoriteQb.andWhere).toHaveBeenCalledWith(
        '(story.title ILIKE :search OR story.description ILIKE :search)',
        { search: '%forest%' },
      );
    });
  });

  describe('findRecent', () => {
    it('orders by updatedAt desc and limits', async () => {
      qb.getMany.mockResolvedValueOnce([makeStory()]);
      pageQb.getRawMany.mockResolvedValueOnce([]);
      pageQb.getRawMany.mockResolvedValueOnce([]);

      const result = await service.findRecent('u-1', 5);

      expect(qb.orderBy).toHaveBeenCalledWith('story.updatedAt', 'DESC');
      expect(qb.take).toHaveBeenCalledWith(5);
      expect(result).toHaveLength(1);
    });
  });

  describe('attachSummaries', () => {
    it('returns empty array for empty stories', async () => {
      const result = await service.attachSummaries([]);
      expect(result).toEqual([]);
    });

    it('defaults counts and cover to safe values when no pages', async () => {
      pageQb.getRawMany.mockResolvedValueOnce([]);
      pageQb.getRawMany.mockResolvedValueOnce([]);

      const result = await service.attachSummaries([makeStory()]);

      expect(result[0]).toMatchObject({
        totalPages: 0,
        illustratedPages: 0,
        coverImageUrl: undefined,
      });
    });

    it('uses COMPLETED page counts without inventing a cover from page images', async () => {
      pageQb.getRawMany.mockResolvedValueOnce([
        { storyId: 's-1', total: '3', illustrated: '2' },
      ]);
      pageQb.getRawMany.mockResolvedValueOnce([
        { storyId: 's-1', imageUrl: 'https://cdn/cover.jpg' },
      ]);

      const result = await service.attachSummaries([makeStory()]);

      expect(result[0].totalPages).toBe(3);
      expect(result[0].illustratedPages).toBe(2);
      expect(result[0].coverImageUrl).toBeUndefined();
    });

    it('prefers the dedicated cover when its generation is COMPLETED', async () => {
      pageQb.getRawMany.mockResolvedValueOnce([]);
      pageQb.getRawMany.mockResolvedValueOnce([]);

      const result = await service.attachSummaries([
        makeStory({
          coverImageUrl: 'https://cdn/cover.png',
          coverImageStatus: IllustrationPageStatus.COMPLETED,
        }),
      ]);

      expect(result[0].coverImageUrl).toBe('https://cdn/cover.png');
    });

    it('does not fall back to the page cover when dedicated cover is not COMPLETED', async () => {
      pageQb.getRawMany.mockResolvedValueOnce([]);
      pageQb.getRawMany.mockResolvedValueOnce([]);

      const result = await service.attachSummaries([
        makeStory({
          coverImageUrl: 'https://cdn/stale.png',
          coverImageStatus: IllustrationPageStatus.FAILED,
        }),
      ]);

      expect(result[0].coverImageUrl).toBeUndefined();
    });
  });
});
