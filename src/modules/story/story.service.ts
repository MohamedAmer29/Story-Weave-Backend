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
import { UploadPdfDto } from './dto/upload-pdf.dto';
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
import { StoryLanguage } from '../../common/enums/story-language.enum';
import { StoryAccessService } from './services/story-access.service';
import {
  StoryContextService,
  NormalizedStoryContext,
} from './services/story-context.service';
import { IllustrationStatusService } from '../../illustration/services/illustration-status.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { PublicCacheService } from '../../common/services/public-cache.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/notification-type.enum';

@Injectable()
export class StoryService {
  private readonly logger = new Logger(StoryService.name);

  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryPage)
    private readonly storyPageRepository: Repository<StoryPage>,
    @InjectRepository(StoryShare)
    private readonly storyShareRepository: Repository<StoryShare>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly storyParserService: StoryParserService,
    private readonly pdfParserService: PdfParserService,
    private readonly storyAccessService: StoryAccessService,
    private readonly storyContextService: StoryContextService,
    private readonly illustrationStatusService: IllustrationStatusService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly publicCacheService: PublicCacheService,
    private readonly notificationsService: NotificationsService,
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

    const context = this.storyContextService.normalize(createStoryDto);

    const story = this.storyRepository.create({
      userId,
      title: parsedStory.title,
      description: createStoryDto.description,
      storyType: createStoryDto.storyType,
      originalText: createStoryDto.text,
      sourceType: createStoryDto.sourceType || SourceType.TEXT,
      status: StoryStatus.PROCESSING,
      visibility: createStoryDto.visibility || StoryVisibility.PRIVATE,
      language:
        (createStoryDto.language as StoryLanguage) ??
        parsedStory.language ??
        undefined,
      visualStyle: createStoryDto.visualStyle,
      ...this.contextToEntity(context),
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

    // Access check via EXISTS avoids joining the shares table, which would
    // multiply story rows (and inflate both the count and the result set).
    const queryBuilder = this.storyRepository
      .createQueryBuilder('story')
      .where(
        '(story.userId = :userId OR story.visibility = :public OR EXISTS (SELECT 1 FROM story_shares ss WHERE ss."storyId" = story."id" AND ss."userId" = :userId))',
        { userId, public: StoryVisibility.PUBLIC },
      );

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

  async findMyStories(
    userId: string,
    queryDto: StoryQueryDto,
  ): Promise<PaginatedStoriesResponseDto> {
    this.logger.log(`Finding owned stories for user: ${userId}`);

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

  async findSharedStories(
    userId: string,
    queryDto: StoryQueryDto,
  ): Promise<PaginatedStoriesResponseDto> {
    this.logger.log(`Finding shared stories for user: ${userId}`);

    const {
      page = 1,
      limit = 10,
      search,
      status,
      sourceType,
      sort = 'latest',
    } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.storyRepository
      .createQueryBuilder('story')
      .innerJoin('story.shares', 'share')
      .where('share.userId = :userId', { userId })
      .andWhere('story.userId != :userId', { userId }); // Exclude own stories

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

    // Fetch pages with ordering using the new composite index
    const pages = await this.storyPageRepository.find({
      where: { storyId: id },
      order: { pageNumber: 'ASC' },
    });

    // Fetch author data in a single query with projection
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

    const author: StoryDetailsResponseDto['author'] = user
      ? {
          id: user.id,
          name: user.name || `${user.firstName} ${user.lastName}`.trim(),
          avatarUrl: user.avatarUrl ?? null,
        }
      : {
          id: story.userId,
          name: 'Unknown author',
          avatarUrl: null,
        };

    const status = this.illustrationStatusService.computeStatus(pages);

    return {
      id: story.id,
      title: story.title,
      storyType: story.storyType ?? null,
      description: story.description ?? null,
      visibility: story.visibility,
      status: story.status,
      sourceType: story.sourceType,
      language: story.language ?? null,
      era: story.era ?? null,
      year: story.year ?? null,
      location: story.location ?? null,
      civilization: story.civilization ?? null,
      customCivilization: story.customCivilization ?? null,
      theme: story.theme ?? null,
      customTheme: story.customTheme ?? null,
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
        wordCount: page.wordCount ?? null,
        sceneDescription: page.sceneDescription ?? null,
        location: page.location ?? null,
        imageUrl: page.imageUrl ?? null,
        imageStatus: page.imageStatus ?? null,
      })),
      cover: {
        imageUrl: story.coverImageUrl ?? null,
        imageStatus: (story.coverImageStatus as any) ?? null,
      },
      sections: pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
        wordCount: page.wordCount ?? 0,
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

    // Normalize the Story Context portion of the update before persisting.
    if (this.hasStoryContext(updateStoryDto)) {
      const context = this.storyContextService.normalize(updateStoryDto);
      // Merge the normalized context over the entity, then apply the rest of
      // the DTO, being careful not to let raw context values leak through.
      delete (updateStoryDto as any).era;
      delete (updateStoryDto as any).year;
      delete (updateStoryDto as any).location;
      delete (updateStoryDto as any).civilization;
      delete (updateStoryDto as any).customCivilization;
      delete (updateStoryDto as any).theme;
      delete (updateStoryDto as any).customTheme;
      Object.assign(story, this.contextToEntity(context));
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
    body?: UploadPdfDto,
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

    this.logger.log(
      `Received PDF upload: name=${file.originalname}, mime=${file.mimetype}, size=${file.size}`,
    );

    // Basic buffer validation
    if (!file.buffer || file.buffer.length === 0) {
      this.logger.error('Uploaded PDF buffer is empty');
      throw new BadRequestException('Uploaded PDF is empty');
    }

    // Check PDF signature
    const signature = file.buffer.slice(0, 5).toString('utf8');
    if (!signature.startsWith('%PDF')) {
      this.logger.error(
        `Uploaded file does not appear to be a PDF (signature=${signature})`,
      );
      throw new BadRequestException('Uploaded file is not a valid PDF');
    }

    try {
      const extractedText = await this.pdfParserService.extractText(
        file.buffer,
      );

      const parsedStory = this.storyParserService.parse(extractedText);

      const context = this.storyContextService.normalize(body ?? {});

      const story = this.storyRepository.create({
        userId,
        title: parsedStory.title,
        description: `Created from PDF: ${file.originalname}`,
        originalText: extractedText,
        sourceType: SourceType.PDF,
        status: StoryStatus.PROCESSING,
        visibility: StoryVisibility.PRIVATE,
        language:
          (body?.language as StoryLanguage) ??
          parsedStory.language ??
          undefined,
        storyType: body?.storyType ?? undefined,
        visualStyle: body?.visualStyle ?? undefined,
        ...this.contextToEntity(context),
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
    const pages = sections.map((section) => {
      const normalized = section.text.replace(/\s+/g, ' ').trim();
      const wordCount =
        normalized.length === 0 ? 0 : normalized.split(' ').length;
      return this.storyPageRepository.create({
        storyId,
        pageNumber: section.order,
        text: section.text,
        wordCount,
        status: PageStatus.READY,
      });
    });

    await this.storyPageRepository.save(pages);
  }

  private toResponseDto(story: Story): StoryResponseDto {
    return {
      id: story.id,
      userId: story.userId,
      title: story.title,
      description: story.description ?? undefined,
      storyType: story.storyType ?? null,
      originalText: story.originalText,
      sourceType: story.sourceType,
      status: story.status,
      visibility: story.visibility,
      language: story.language ?? undefined,
      era: story.era ?? undefined,
      year: story.year ?? undefined,
      location: story.location ?? undefined,
      civilization: story.civilization ?? undefined,
      customCivilization: story.customCivilization ?? undefined,
      theme: story.theme ?? undefined,
      customTheme: story.customTheme ?? undefined,
      errorMessage: story.errorMessage ?? undefined,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }

  private contextToEntity(context: NormalizedStoryContext): Partial<Story> {
    return {
      era: context.era,
      year: context.year,
      location: context.location,
      civilization: context.civilization,
      customCivilization: context.customCivilization,
      theme: context.theme,
      customTheme: context.customTheme,
    };
  }

  private hasStoryContext(dto: object): boolean {
    return (
      'era' in dto ||
      'year' in dto ||
      'location' in dto ||
      'civilization' in dto ||
      'customCivilization' in dto ||
      'theme' in dto ||
      'customTheme' in dto
    );
  }

  async updateVisibility(
    userId: string,
    storyId: string,
    visibility: StoryVisibility,
  ): Promise<StoryResponseDto> {
    this.logger.log(
      `Updating visibility for story: ${storyId} to: ${visibility}`,
    );

    const story = await this.storyAccessService.requireOwnership(
      storyId,
      userId,
    );

    story.visibility = visibility;
    await this.storyRepository.save(story);

    await this.publicCacheService.bust();

    return this.toResponseDto(story);
  }

  async shareStory(
    userId: string,
    storyId: string,
    targetUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Sharing story: ${storyId} with user: ${targetUserId}`);

    const story = await this.storyAccessService.requireOwnership(
      storyId,
      userId,
    );

    // Verify target user exists
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Prevent sharing with yourself
    if (targetUserId === userId) {
      throw new BadRequestException('Cannot share story with yourself');
    }

    // Check for existing share
    const existingShare = await this.storyShareRepository.findOne({
      where: { storyId, userId: targetUserId },
    });
    if (existingShare) {
      throw new BadRequestException('Story already shared with this user');
    }

    // Create share
    const share = this.storyShareRepository.create({
      storyId,
      userId: targetUserId,
    });
    await this.storyShareRepository.save(share);

    // Create notification
    const sharer = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
      },
    });
    const sharerName =
      sharer?.name ||
      `${sharer?.firstName} ${sharer?.lastName}`.trim() ||
      'Someone';

    await this.notificationsService.create(
      targetUserId,
      NotificationType.STORY_SHARED,
      'Story shared with you',
      `"${story.title}" has been shared with you by ${sharerName}.`,
      { storyId, sharedBy: userId },
    );

    return {
      success: true,
      message: 'Story shared successfully',
    };
  }

  async removeShare(
    userId: string,
    storyId: string,
    targetUserId: string,
  ): Promise<void> {
    this.logger.log(
      `Removing share for story: ${storyId} from user: ${targetUserId}`,
    );

    const story = await this.storyAccessService.requireOwnership(
      storyId,
      userId,
    );

    // Prevent removing owner's own access
    if (targetUserId === userId) {
      throw new BadRequestException('Cannot remove your own access');
    }

    const share = await this.storyShareRepository.findOne({
      where: { storyId, userId: targetUserId },
    });
    if (!share) {
      throw new NotFoundException('Share not found');
    }

    await this.storyShareRepository.remove(share);

    // Optionally notify the user that access was removed
    await this.notificationsService.create(
      targetUserId,
      NotificationType.STORY_ACCESS_REMOVED,
      'Story access removed',
      `Your access to "${story.title}" has been removed by the owner.`,
      { storyId },
    );
  }

  async listShares(
    userId: string,
    storyId: string,
  ): Promise<{
    success: boolean;
    data: Array<{
      userId: string;
      name: string;
      email: string;
      sharedAt: Date;
    }>;
  }> {
    this.logger.log(`Listing shares for story: ${storyId}`);

    const story = await this.storyAccessService.requireOwnership(
      storyId,
      userId,
    );

    const shares = await this.storyShareRepository.find({
      where: { storyId },
      relations: {
        user: true,
      },
      order: { createdAt: 'ASC' },
    });

    const data = shares.map((share) => ({
      userId: share.userId,
      name:
        share.user?.name ||
        `${share.user?.firstName} ${share.user?.lastName}`.trim() ||
        'Unknown',
      email: share.user?.email || '',
      sharedAt: share.createdAt,
    }));

    return {
      success: true,
      data,
    };
  }
}
