import {
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { StoryShare } from '../../database/entities/story-share.entity';
import { Notification } from '../../notifications/notification.entity';
import { User } from '../../database/entities/user.entity';
import { StoryStatus } from '../../common/enums/story-status.enum';
import { IllustrationPageStatus } from '../../illustration/enums/illustration-page-status.enum';
import {
  AdminStoryQueryDto,
  FailedStoriesQueryDto,
} from '../dto/admin-query.dto';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { PublicCacheService } from '../../common/services/public-cache.service';
import { IllustrationStatusService } from '../../illustration/services/illustration-status.service';
import { IllustrationService } from '../../illustration/illustration.service';
import { AiUsageService } from '../../ai/ai-usage.service';
import { AI_MODEL_USAGE } from '../../ai/config/ai-model-usage.config';

const CLOUDFLARE_MODEL_KEY = '@cf/black-forest-labs/flux-1-schnell';

@Injectable()
export class AdminStoriesService {
  private readonly logger = new Logger(AdminStoriesService.name);

  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryPage)
    private readonly storyPageRepository: Repository<StoryPage>,
    @InjectRepository(StoryShare)
    private readonly storyShareRepository: Repository<StoryShare>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly cloudinaryService: CloudinaryService,
    private readonly publicCacheService: PublicCacheService,
    private readonly illustrationStatusService: IllustrationStatusService,
    private readonly illustrationService: IllustrationService,
    private readonly usageService: AiUsageService,
  ) {}

  async list(query: AdminStoryQueryDto) {
    const page = query.page > 0 ? query.page : 1;
    const limit = query.limit > 0 && query.limit <= 100 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.storyRepository
      .createQueryBuilder('story')
      .leftJoinAndMapOne('story.user', 'story.user', 'user');

    if (query.search) {
      qb.andWhere(
        '(story.title ILIKE :search OR story.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.status) {
      qb.andWhere('story.status = :status', { status: query.status });
    }
    if (query.visibility) {
      qb.andWhere('story.visibility = :visibility', {
        visibility: query.visibility,
      });
    }
    if (query.sourceType) {
      qb.andWhere('story.sourceType = :sourceType', {
        sourceType: query.sourceType,
      });
    }
    if (query.userId) {
      qb.andWhere('story.userId = :userId', { userId: query.userId });
    }

    qb.orderBy('story.createdAt', 'DESC');

    const [stories, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const data = stories.map((story) => ({
      id: story.id,
      title: story.title,
      description: story.description ?? undefined,
      status: story.status,
      visibility: story.visibility,
      sourceType: story.sourceType,
      storyType: story.storyType ?? null,
      illustrationStatus: story.illustrationStatus ?? null,
      totalImages: story.totalImages ?? 0,
      completedImages: story.completedImages ?? 0,
      failedImages: story.failedImages ?? 0,
      errorMessage: story.errorMessage ?? undefined,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
      owner: story.user
        ? {
            id: story.user.id,
            name: story.user.name,
            email: story.user.email,
          }
        : undefined,
    }));

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

  async getById(storyId: string) {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
      relations: { user: true },
    });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const pages = await this.storyPageRepository.find({
      where: { storyId },
      order: { pageNumber: 'ASC' },
    });

    const status = this.illustrationStatusService.computeStatus(pages);

    return {
      id: story.id,
      title: story.title,
      description: story.description ?? null,
      status: story.status,
      visibility: story.visibility,
      sourceType: story.sourceType,
      storyType: story.storyType ?? null,
      language: story.language ?? null,
      visualStyle: story.visualStyle ?? null,
      errorMessage: story.errorMessage ?? null,
      illustrationStatus: story.illustrationStatus ?? null,
      illustrationGenerationNotifiedAt: story.illustrationGenerationNotifiedAt,
      owner: {
        id: story.user?.id,
        name: story.user?.name,
        email: story.user?.email,
      },
      stats: {
        totalPages: status.totalPages,
        illustratedPages: status.completed,
        failedPages: status.failed,
        pendingPages:
          status.pending + status.queued + status.generating + status.uploading,
        progress: status.progress,
      },
      cover: {
        imageUrl: story.coverImageUrl ?? null,
        imageStatus: story.coverImageStatus ?? null,
        imageError: story.coverImageError ?? null,
      },
      pages: pages.map((page) => ({
        id: page.id,
        pageNumber: page.pageNumber,
        title: page.title ?? null,
        wordCount: page.wordCount ?? null,
        imageUrl: page.imageUrl ?? null,
        imageStatus: page.imageStatus ?? null,
        imageError: page.imageError ?? null,
      })),
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }

  async delete(storyId: string) {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
      relations: { pages: true },
    });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const imagePublicIds = story.pages
      .map((page) => page.imagePublicId)
      .filter((pid): pid is string => Boolean(pid));
    if (story.coverImagePublicId) {
      imagePublicIds.push(story.coverImagePublicId);
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(StoryShare, { storyId });
      await manager
        .createQueryBuilder()
        .delete()
        .from(Notification)
        .where("data->>'storyId' = :storyId", { storyId })
        .execute();
      await manager.delete(StoryPage, { storyId });
      await manager.delete(Story, storyId);
    });

    await this.publicCacheService.bust();

    for (const publicId of imagePublicIds) {
      await this.cloudinaryService.deleteImage(publicId);
    }

    this.logger.log(`[Admin] Deleted story: ${storyId}`);

    return { success: true, message: 'Story deleted', storyId };
  }

  async listFailed(query: FailedStoriesQueryDto) {
    const page = query.page > 0 ? query.page : 1;
    const limit = query.limit > 0 && query.limit <= 100 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const qb = this.storyPageRepository
      .createQueryBuilder('page')
      .leftJoinAndMapOne('page.story', 'page.story', 'story')
      .leftJoinAndMapOne('story.user', 'story.user', 'user');

    qb.andWhere(
      'page.imageStatus = :failedStatus OR story.status = :storyFailed',
      {
        failedStatus: IllustrationPageStatus.FAILED,
        storyFailed: StoryStatus.FAILED,
      },
    );

    if (query.imageStatus) {
      qb.andWhere('page.imageStatus = :imageStatus', {
        imageStatus: query.imageStatus,
      });
    }

    qb.orderBy('page.updatedAt', 'DESC');

    const [pages, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: pages.map((page: any) => ({
        pageId: page.id,
        pageNumber: page.pageNumber,
        imageStatus: page.imageStatus ?? null,
        imageError: page.imageError ?? null,
        updatedAt: page.updatedAt,
        story: page.story
          ? {
              id: page.story.id,
              title: page.story.title,
              status: page.story.status,
              illustrationStatus: page.story.illustrationStatus ?? null,
            }
          : null,
        owner: page.story?.user
          ? { id: page.story.user.id, email: page.story.user.email }
          : null,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async retryFailed(storyId: string, scope: 'page' | 'cover') {
    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.status !== StoryStatus.READY) {
      throw new NotFoundException(
        'Only READY stories can have their illustrations retried',
      );
    }

    const userId = story.userId;

    // Fail-fast neuron safety check: an admin retry must still respect the
    // safety threshold before enqueueing jobs that would be rejected by the
    // worker. The worker remains the authoritative enforcement layer.
    const { allowed } = await this.usageService.canMakeRequest(
      CLOUDFLARE_MODEL_KEY,
      AI_MODEL_USAGE[CLOUDFLARE_MODEL_KEY]?.neuronsPerRequest ?? 100,
    );
    if (!allowed) {
      throw new HttpException(
        'AI generation is at capacity; retry is not available right now.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (scope === 'cover') {
      await this.illustrationService.regenerateCover(userId, storyId);
    } else {
      const failedPage = await this.storyPageRepository.findOne({
        where: { storyId, imageStatus: IllustrationPageStatus.FAILED },
      });
      if (!failedPage) {
        throw new NotFoundException('No failed pages found to retry');
      }
      await this.illustrationService.regeneratePage(
        userId,
        storyId,
        failedPage.id,
      );
    }

    this.logger.log(`[Admin] Retried ${scope} for story: ${storyId}`);
    return { success: true, message: `${scope} generation retried`, storyId };
  }
}
