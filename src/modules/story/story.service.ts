import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { StoryShare } from '../../database/entities/story-share.entity';
import { User } from '../../database/entities/user.entity';
import { Notification } from '../../notifications/notification.entity';
import { StoryStatus } from '../../common/enums/story-status.enum';
import { SourceType } from '../../common/enums/source-type.enum';
import { PageStatus } from '../../common/enums/page-status.enum';
import { StoryVisibility } from '../../common/enums/story-visibility.enum';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { StoryQueryDto } from './dto/story-query.dto';
import {
  StoryResponseDto,
  PaginatedStoriesResponseDto,
} from './dto/story-response.dto';
import { StoryDetailsResponseDto } from './dto/story-details-response.dto';
import {
  StoryParserService,
  ParsedStory,
} from './services/story-parser.service';
import { PdfParserService } from './services/pdf-parser.service';
import { StoryAccessService } from './services/story-access.service';
import { IllustrationStatusService } from '../../illustration/services/illustration-status.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { PublicCacheService } from '../../common/services/public-cache.service';

@Injectable()
export class StoryService {
  private readonly logger = new Logger(StoryService.name);

  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryPage)
    private readonly storyPageRepository: Repository<StoryPage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly storyParserService: StoryParserService,
    private readonly pdfParserService: PdfParserService,
    private readonly storyAccessService: StoryAccessService,
    private readonly illustrationStatusService: IllustrationStatusService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly publicCacheService: PublicCacheService,
  ) {}

  async create(
    userId: string,
    createStoryDto: CreateStoryDto,
  ): Promise<StoryResponseDto> {
    this.logger.log(`Creating story for user: ${userId}`);

    const parsedStory = this.storyParserService.parse(
      createStoryDto.text,
      createStoryDto.title,
    );

    const story = this.storyRepository.create({
      userId,
      title: parsedStory.title,
      description: createStoryDto.description,
      originalText: createStoryDto.text,
      sourceType: createStoryDto.sourceType || SourceType.TEXT,
      status: StoryStatus.PROCESSING,
      visibility: createStoryDto.visibility || StoryVisibility.PRIVATE,
      language: createStoryDto.language || parsedStory.language,
      visualStyle: createStoryDto.visualStyle,
    });

    await this.storyRepository.save(story);

    try {
      await this.createStoryPages(story.id, parsedStory.sections);

      story.status = StoryStatus.READY;
      await this.storyRepository.save(story);

      this.logger.log(`Story created successfully: ${story.id}`);
    } catch (error) {
      this.logger.error(`Failed to create story pages: ${error.message}`);
      story.status = StoryStatus.FAILED;
      story.errorMessage = 'Failed to process story content';
      await this.storyRepository.save(story);
    }

    await this.publicCacheService.bust();

    return this.toResponseDto(story);
  }

  async findAll(
    userId: string,
    queryDto: StoryQueryDto,
  ): Promise<PaginatedStoriesResponseDto> {
    this.logger.log(`Finding stories for user: ${userId}`);

    const {
      page = 1,
      limit = 10,
      search,
      status,
      sourceType,
      visibility,
      sort = 'latest',
    } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.storyRepository
      .createQueryBuilder('story')
      .where('story.userId = :userId', { userId });

    if (search) {
      queryBuilder.andWhere(
        '(story.title ILIKE :search OR story.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('story.status = :status', { status });
    }

    if (sourceType) {
      queryBuilder.andWhere('story.sourceType = :sourceType', { sourceType });
    }

    if (visibility) {
      queryBuilder.andWhere('story.visibility = :visibility', { visibility });
    }

    switch (sort) {
      case 'oldest':
        queryBuilder.orderBy('story.createdAt', 'ASC');
        break;
      case 'updated':
        queryBuilder.orderBy('story.updatedAt', 'DESC');
        break;
      default:
        queryBuilder.orderBy('story.createdAt', 'DESC');
        break;
    }

    const [stories, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: stories.map((s) => this.toResponseDto(s)),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findOne(
    userId: string | undefined,
    id: string,
  ): Promise<StoryDetailsResponseDto> {
    this.logger.log(`Finding story: ${id}`);

    // Enforces PUBLIC / PRIVATE (owner) / SHARED (explicit grant) access rules.
    const story = await this.storyAccessService.requireAccess(id, userId);

    const pages = await this.storyPageRepository.find({
      where: { storyId: id },
      order: { pageNumber: 'ASC' },
    });

    let author: StoryDetailsResponseDto['author'] = {
      id: story.userId,
      name: 'Unknown author',
      avatarUrl: null,
    };
    const user = await this.userRepository.findOne({
      where: { id: story.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        avatarUrl: true,
      },
    });
    if (user) {
      author = {
        id: user.id,
        name: user.name || `${user.firstName} ${user.lastName}`.trim(),
        avatarUrl: user.avatarUrl ?? null,
      };
    }

    const status = this.illustrationStatusService.computeStatus(pages);

    return {
      id: story.id,
      title: story.title,
      description: story.description ?? null,
      visibility: story.visibility,
      status: story.status,
      sourceType: story.sourceType,
      language: story.language ?? null,
      author,
      stats: {
        totalPages: status.totalPages,
        illustratedPages: status.completed,
        failedPages: status.failed,
        pendingPages:
          status.pending + status.queued + status.generating + status.uploading,
        progress: status.progress,
      },
      pages: pages.map((page) => ({
        id: page.id,
        pageNumber: page.pageNumber,
        title: page.title ?? null,
        text: page.text,
        sceneDescription: page.sceneDescription ?? null,
        location: page.location ?? null,
        imageUrl: page.imageUrl ?? null,
        imageStatus: page.imageStatus ?? null,
      })),
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }

  async update(
    userId: string,
    id: string,
    updateStoryDto: UpdateStoryDto,
  ): Promise<StoryResponseDto> {
    this.logger.log(`Updating story: ${id} for user: ${userId}`);

    const story = await this.storyRepository.findOne({ where: { id } });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    Object.assign(story, updateStoryDto);
    await this.storyRepository.save(story);

    await this.publicCacheService.bust();

    return this.toResponseDto(story);
  }

  async remove(userId: string, id: string): Promise<void> {
    this.logger.log(`Deleting story: ${id} for user: ${userId}`);

    const story = await this.storyRepository.findOne({
      where: { id },
      relations: { pages: true },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const imagePublicIds = story.pages
      .map((page) => page.imagePublicId)
      .filter((pid): pid is string => Boolean(pid));

    // Database consistency first: shares, notifications, pages, then the story.
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(StoryShare, { storyId: id });
      await manager
        .createQueryBuilder()
        .delete()
        .from(Notification)
        .where("data->>'storyId' = :storyId", { storyId: id })
        .execute();
      await manager.delete(StoryPage, { storyId: id });
      await manager.delete(Story, id);
    });

    await this.publicCacheService.bust();

    // Best-effort Cloudinary cleanup AFTER the DB operation committed.
    for (const publicId of imagePublicIds) {
      await this.cloudinaryService.deleteImage(publicId);
    }

    this.logger.log(`Story deleted: ${id}`);
  }

  async getPagesForUser(storyId: string, userId: string): Promise<StoryPage[]> {
    this.logger.log(`Getting pages for story: ${storyId} for user: ${userId}`);

    const story = await this.storyRepository.findOne({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.storyPageRepository.find({
      where: { storyId },
      order: { pageNumber: 'ASC' },
    });
  }

  async createFromPdf(
    userId: string,
    file: Express.Multer.File,
  ): Promise<StoryResponseDto> {
    this.logger.log(`Creating story from PDF for user: ${userId}`);

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        'Invalid file type. Only PDF files are allowed',
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    try {
      const extractedText = await this.pdfParserService.extractText(
        file.buffer,
      );

      const parsedStory = this.storyParserService.parse(extractedText);

      const story = this.storyRepository.create({
        userId,
        title: parsedStory.title,
        description: `Created from PDF: ${file.originalname}`,
        originalText: extractedText,
        sourceType: SourceType.PDF,
        status: StoryStatus.PROCESSING,
        visibility: StoryVisibility.PRIVATE,
        language: parsedStory.language,
      });

      await this.storyRepository.save(story);

      try {
        await this.createStoryPages(story.id, parsedStory.sections);

        story.status = StoryStatus.READY;
        await this.storyRepository.save(story);

        this.logger.log(`Story created from PDF successfully: ${story.id}`);
      } catch (error) {
        this.logger.error(`Failed to create story pages: ${error.message}`);
        story.status = StoryStatus.FAILED;
        story.errorMessage = 'Failed to process story content';
        await this.storyRepository.save(story);
      }

      await this.publicCacheService.bust();

      return this.toResponseDto(story);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to process PDF: ${error.message}`);
      throw new BadRequestException('Failed to process PDF file');
    }
  }

  private async createStoryPages(
    storyId: string,
    sections: Array<{ order: number; text: string }>,
  ): Promise<void> {
    const pages = sections.map((section) =>
      this.storyPageRepository.create({
        storyId,
        pageNumber: section.order,
        text: section.text,
        status: PageStatus.READY,
      }),
    );

    await this.storyPageRepository.save(pages);
  }

  private toResponseDto(story: Story): StoryResponseDto {
    return {
      id: story.id,
      userId: story.userId,
      title: story.title,
      description: story.description,
      originalText: story.originalText,
      sourceType: story.sourceType,
      status: story.status,
      visibility: story.visibility,
      language: story.language,
      errorMessage: story.errorMessage,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }
}