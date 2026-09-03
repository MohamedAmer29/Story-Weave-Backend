import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Story } from '../../../database/entities/story.entity';
import { StoryPage } from '../../../database/entities/story-page.entity';
import { StoryShare } from '../../../database/entities/story-share.entity';
import { StoryStatus } from '../../../common/enums/story-status.enum';
import { SourceType } from '../../../common/enums/source-type.enum';
import { StoryVisibility } from '../../../common/enums/story-visibility.enum';
import { IllustrationPageStatus } from '../../../illustration/enums/illustration-page-status.enum';
import {
  StoryLibraryItemDto,
  PaginatedLibraryResponseDto,
} from '../dto/story-library-response.dto';
import { StorySort } from '../dto/story-list-query.dto';
import { PublicCacheService } from '../../../common/services/public-cache.service';

export interface StoryListFilters {
  page: number;
  limit: number;
  search?: string;
  sort?: StorySort;
  status?: StoryStatus;
  visibility?: StoryVisibility;
  sourceType?: SourceType;
}

const DEFAULT_SORT: StorySort = 'latest';

@Injectable()
export class StoryLibraryService {
  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryPage)
    private readonly storyPageRepository: Repository<StoryPage>,
    private readonly publicCacheService: PublicCacheService,
  ) {}

  async findOwned(
    userId: string,
    filters: StoryListFilters,
  ): Promise<PaginatedLibraryResponseDto> {
    const qb = this.storyRepository
      .createQueryBuilder('story')
      .where('story.userId = :userId', { userId });

    this.applyFilters(qb, filters);

    return this.runPaginated(qb, filters);
  }

  async findShared(
    userId: string,
    filters: StoryListFilters,
  ): Promise<PaginatedLibraryResponseDto> {
    const qb = this.storyRepository
      .createQueryBuilder('story')
      .innerJoin(StoryShare, 'share', 'share.storyId = story.id')
      .where('share.userId = :userId', { userId })
      .andWhere('story.visibility != :privateVis', {
        privateVis: StoryVisibility.PRIVATE,
      });

    this.applyFilters(qb, filters);

    return this.runPaginated(qb, filters);
  }

  async findPublic(
    filters: StoryListFilters,
    authorId?: string,
  ): Promise<PaginatedLibraryResponseDto> {
    const cacheKey = `${authorId ?? 'all'}|${filters.page}|${filters.limit}|${
      filters.search ?? ''
    }|${filters.sort ?? DEFAULT_SORT}`;

    const cached =
      await this.publicCacheService.get<PaginatedLibraryResponseDto>(
        'public-stories',
        cacheKey,
      );
    if (cached) {
      return cached;
    }

    const qb = this.storyRepository
      .createQueryBuilder('story')
      .where('story.visibility = :vis', { vis: StoryVisibility.PUBLIC });

    if (authorId) {
      qb.andWhere('story.userId = :authorId', { authorId });
    }

    this.applySortAndSearch(qb, filters);

    const result = await this.runPaginated(qb, filters);

    await this.publicCacheService.set('public-stories', cacheKey, result);

    return result;
  }

  async findRecent(
    userId: string,
    limit: number,
  ): Promise<StoryLibraryItemDto[]> {
    const stories = await this.storyRepository
      .createQueryBuilder('story')
      .where('story.userId = :userId', { userId })
      .orderBy('story.updatedAt', 'DESC')
      .take(Math.min(limit, 20))
      .getMany();

    return this.attachSummaries(stories);
  }

  private applyFilters(
    qb: SelectQueryBuilder<Story>,
    filters: StoryListFilters,
  ): void {
    this.applySortAndSearch(qb, filters);

    if (filters.status) {
      qb.andWhere('story.status = :status', { status: filters.status });
    }

    if (filters.visibility) {
      qb.andWhere('story.visibility = :visibility', {
        visibility: filters.visibility,
      });
    }

    if (filters.sourceType) {
      qb.andWhere('story.sourceType = :sourceType', {
        sourceType: filters.sourceType,
      });
    }
  }

  private applySortAndSearch(
    qb: SelectQueryBuilder<Story>,
    filters: StoryListFilters,
  ): void {
    if (filters.search) {
      qb.andWhere(
        '(story.title ILIKE :search OR story.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const sort = filters.sort ?? DEFAULT_SORT;
    switch (sort) {
      case 'oldest':
        qb.orderBy('story.createdAt', 'ASC');
        break;
      case 'updated':
        qb.orderBy('story.updatedAt', 'DESC');
        break;
      default:
        qb.orderBy('story.createdAt', 'DESC');
        break;
    }
  }

  private async runPaginated(
    qb: SelectQueryBuilder<Story>,
    filters: StoryListFilters,
  ): Promise<PaginatedLibraryResponseDto> {
    const page = filters.page < 1 ? 1 : filters.page;
    const limit = filters.limit;
    const skip = (page - 1) * limit;

    const [stories, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const data = await this.attachSummaries(stories);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async attachSummaries(stories: Story[]): Promise<StoryLibraryItemDto[]> {
    if (stories.length === 0) {
      return [];
    }

    const ids = stories.map((s) => s.id);

    const [statsRaw, coversRaw] = await Promise.all([
      this.storyPageRepository
        .createQueryBuilder('page')
        .select('page.storyId', 'storyId')
        .addSelect('COUNT(*)', 'total')
        .addSelect(
          `COUNT(*) FILTER (WHERE page.imageStatus = '${IllustrationPageStatus.COMPLETED}')`,
          'illustrated',
        )
        .where('page.storyId IN (:...ids)', { ids })
        .groupBy('page.storyId')
        .getRawMany(),
      this.storyPageRepository
        .createQueryBuilder('page')
        .select('page.storyId', 'storyId')
        .addSelect('page.imageUrl', 'imageUrl')
        .distinctOn(['page.storyId'])
        .where('page.storyId IN (:...ids)', { ids })
        .andWhere('page.imageStatus = :completed', {
          completed: IllustrationPageStatus.COMPLETED,
        })
        .andWhere('page.imageUrl IS NOT NULL')
        .orderBy('page.storyId', 'ASC')
        .addOrderBy('page.pageNumber', 'ASC')
        .getRawMany(),
    ]);

    const stats = new Map<string, { total: number; illustrated: number }>();
    for (const row of statsRaw) {
      stats.set(row.storyId, {
        total: Number(row.total) || 0,
        illustrated: Number(row.illustrated) || 0,
      });
    }

    const covers = new Map<string, string>();
    for (const row of coversRaw) {
      if (!covers.has(row.storyId)) {
        covers.set(row.storyId, row.imageUrl);
      }
    }

    return stories.map((story) => {
      const pageStats = stats.get(story.id);
      return {
        id: story.id,
        title: story.title,
        description: story.description ?? undefined,
        visibility: story.visibility,
        status: story.status,
        sourceType: story.sourceType,
        coverImageUrl: covers.get(story.id) ?? undefined,
        totalPages: pageStats?.total ?? 0,
        illustratedPages: pageStats?.illustrated ?? 0,
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
      };
    });
  }
}
