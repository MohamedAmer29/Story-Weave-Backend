import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
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
  StoryContextInput,
} from './services/story-context.service';
import { IllustrationStatusService } from '../../illustration/services/illustration-status.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { PublicCacheService } from '../../common/services/public-cache.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/notification-type.enum';
import { AuditLogService } from '../../admin/audit/audit-log.service';
import { AuditAction } from '../../admin/audit/audit-actions';
import { IllustrationPageStatus } from '../../illustration/enums/illustration-page-status.enum';
import { IllustrationService } from '../../illustration/illustration.service';
import { AppendStoryResponseDto } from './dto/append-story-response.dto';
import { StoryOptionsService } from '../story-options/story-options.service';

const MAX_STORY_PAGE_CHARACTERS = 1000;

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
    private readonly auditService: AuditLogService,
    private readonly moduleRef: ModuleRef,
    private readonly storyOptionsService: StoryOptionsService,
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
      genreId: createStoryDto.genreId || null,
      eraId: createStoryDto.eraId || null,
      civilizationId: createStoryDto.civilizationId || null,
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

    await this.auditService.record({
      adminId: userId,
      action: AuditAction.STORY_CREATED,
      targetType: 'STORY',
      targetId: story.id,
      description: `Story "${story.title}" created`,
      metadata: {
        title: story.title,
        visibility: story.visibility,
        storyType: story.storyType,
      },
      ...(await this.actorInfo(userId)),
    });

    return this.toResponseDto(story);
  }

  private async actorInfo(userId: string): Promise<{
    adminEmail: string | null;
    actorName: string | null;
    actorRole: string | null;
  }> {
    try {
      const actor = await this.userRepository.findOne({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });
      if (!actor) {
        return { adminEmail: null, actorName: null, actorRole: null };
      }
      const actorName =
        actor.name || `${actor.firstName} ${actor.lastName}`.trim() || null;
      return {
        adminEmail: actor.email,
        actorName,
        actorRole: actor.role,
      };
    } catch {
      return { adminEmail: null, actorName: null, actorRole: null };
    }
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
    // PRIVATE stories are owner-only (matching canAccessStory); SHARED stories
    // are accessible to explicitly granted users via story_shares.
    const queryBuilder = this.storyRepository
      .createQueryBuilder('story')
      .where(
        '(story.userId = :userId OR story.visibility = :public OR (story.visibility = :shared AND EXISTS (SELECT 1 FROM story_shares ss WHERE ss."storyId" = story."id" AND ss."userId" = :userId)))',
        {
          userId,
          public: StoryVisibility.PUBLIC,
          shared: StoryVisibility.SHARED,
        },
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
      .andWhere('story.visibility = :shared', {
        shared: StoryVisibility.SHARED,
      })
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
      const context = this.storyContextService.normalize(
        this.pickContextFields(updateStoryDto),
      );
      // Apply only the context fields that were explicitly provided in the
      // update; untouched context columns are preserved instead of being reset
      // to their defaults.
      Object.assign(story, this.contextPatch(updateStoryDto, context));
      // Strip raw context fields so they don't leak through Object.assign below.
      this.deleteContextFields(updateStoryDto as any);
    }

    Object.assign(story, updateStoryDto);
    await this.storyRepository.save(story);

    await this.publicCacheService.bust();

    void this.auditService.record({
      adminId: userId,
      action: AuditAction.STORY_UPDATED,
      targetType: 'STORY',
      targetId: story.id,
      description: `Story "${story.title}" updated`,
      metadata: {
        title: story.title,
        changedFields: Object.keys(updateStoryDto),
      },
      ...(await this.actorInfo(userId)),
    });

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
    if (story.coverImagePublicId) {
      imagePublicIds.push(story.coverImagePublicId);
    }

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
    await Promise.allSettled(
      imagePublicIds.map((publicId) =>
        this.cloudinaryService.deleteImage(publicId),
      ),
    );

    this.logger.log(`Story deleted: ${id}`);

    void this.auditService.record({
      adminId: userId,
      action: AuditAction.STORY_DELETED,
      targetType: 'STORY',
      targetId: story.id,
      description: `Story "${story.title}" deleted`,
      metadata: {
        title: story.title,
        visibility: story.visibility,
      },
      ...(await this.actorInfo(userId)),
    });
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

  async getPages(storyId: string, userId?: string) {
    await this.storyAccessService.requireAccess(storyId, userId);
    const pages = await this.storyPageRepository.find({ where: { storyId }, order: { pageNumber: 'ASC' } });
    return pages.map((page) => ({
      id: page.id,
      pageNumber: page.pageNumber,
      content: page.text,
      imageUrl: page.imageUrl ?? null,
      imageStatus: page.imageStatus ?? null,
      generationError: page.imageError ?? null,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    }));
  }

  async append(
    userId: string,
    storyId: string,
    content?: string,
    file?: Express.Multer.File,
  ): Promise<AppendStoryResponseDto> {
    await this.storyAccessService.requireOwnership(storyId, userId);

    if (content !== undefined && file) {
      throw new BadRequestException(
        'Provide continuation text or a PDF, not both',
      );
    }
    if (content === undefined && !file) {
      throw new BadRequestException(
        'Provide continuation text or a PDF file',
      );
    }

    let continuation: string;
    const source = file ? SourceType.PDF : SourceType.TEXT;
    if (file) {
      this.validateAppendPdf(file);
      continuation = await this.pdfParserService.extractText(file.buffer);
    } else {
      continuation = content?.trim() ?? '';
    }

    if (!continuation.trim()) {
      throw new BadRequestException('Continuation content cannot be empty');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const story = await manager.findOne(Story, {
        where: { id: storyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!story) throw new NotFoundException('Story not found');
      if (story.userId !== userId) {
        throw new ForbiddenException('Access denied');
      }

      const current = await manager.find(StoryPage, {
        where: { storyId },
        order: { pageNumber: 'ASC' },
      });
      const appendedSource = `${story.originalText}\n\n${continuation.trim()}`;
      const affectedIndexes: number[] = [];
      let pagesCreated = 0;
      let pagesUpdated = 0;
      let next: StoryPage[];

      if (current.length > 0) {
        const continuationSections = this.storyParserService.splitIntoSections(
          continuation.trim(),
        );
        const startIndex = current.length;
        const newPages = continuationSections.map((section, idx) => {
          const index = startIndex + idx;
          const normalized = section.text.replace(/\s+/g, ' ').trim();
          pagesCreated++;
          affectedIndexes.push(index);
          return manager.create(StoryPage, {
            storyId,
            pageNumber: index + 1,
            text: section.text,
            wordCount: normalized ? normalized.split(' ').length : 0,
            status: PageStatus.READY,
            imageStatus: IllustrationPageStatus.PENDING,
            imageUrl: null,
            imagePublicId: null,
            imagePrompt: null,
            imageError: null,
            imageGeneratedAt: null,
          } as any);
        });
        next = [...current, ...newPages];
      } else {
        const sections = this.storyParserService.splitIntoSections(appendedSource);
        next = sections.map((section, index) => {
          const existing = current[index];
          const changed = !existing || existing.text !== section.text;
          const normalized = section.text.replace(/\s+/g, ' ').trim();
          if (changed) {
            if (existing) {
              pagesUpdated++;
            } else {
              pagesCreated++;
            }
            affectedIndexes.push(index);
          }

          return manager.create(StoryPage, {
            ...(existing ?? {}),
            storyId,
            pageNumber: index + 1,
            text: section.text,
            wordCount: normalized ? normalized.split(' ').length : 0,
            status: PageStatus.READY,
            imageStatus: changed
              ? IllustrationPageStatus.PENDING
              : existing.imageStatus,
            imageUrl: changed ? null : existing.imageUrl,
            imagePublicId: changed ? null : existing.imagePublicId,
            imagePrompt: changed ? null : existing.imagePrompt,
            imageError: changed ? null : existing.imageError,
            imageGeneratedAt: changed ? null : existing.imageGeneratedAt,
          } as any);
        });
        const removed = current.slice(sections.length).map((page) => page.id);
        if (removed.length > 0) await manager.delete(StoryPage, removed);
      }

      const savedPages = await manager.save(StoryPage, next);
      story.originalText = appendedSource;
      await manager.save(Story, story);

      return {
        storyId,
        pagesCreated,
        pagesUpdated,
        affectedPageIds: savedPages
          .filter((_page, index) => affectedIndexes.includes(index))
          .map((page) => page.id),
      };
    });

    let generationQueued = false;
    if (result.affectedPageIds.length > 0) {
      try {
        const illustrationService = this.moduleRef.get(IllustrationService, {
          strict: false,
        });
        await illustrationService.queueAffectedPages(
          userId,
          storyId,
          result.affectedPageIds,
        );
        generationQueued = true;
      } catch (error: any) {
        // The continuation is already persisted and can be retried through the
        // normal illustration UI if quota or queue protection blocks it.
        this.logger.warn(
          `Could not queue continuation illustrations for ${storyId}: ${error?.message ?? 'Unknown error'}`,
        );
      }
    }

    await this.publicCacheService.bust();
    void this.auditService.record({
      adminId: userId,
      action: AuditAction.STORY_TEXT_APPENDED,
      targetType: 'STORY',
      targetId: storyId,
      description: 'Story continuation appended',
      metadata: {
        storyId,
        source,
        pagesCreated: result.pagesCreated,
        pagesUpdated: result.pagesUpdated,
      },
      ...(await this.actorInfo(userId)),
    });

    return {
      success: true,
      message: 'Story continuation added successfully',
      storyId,
      pagesCreated: result.pagesCreated,
      pagesUpdated: result.pagesUpdated,
      pagesRegenerationRequired: result.affectedPageIds.length,
      generationQueued,
    };
  }

  private validateAppendPdf(file: Express.Multer.File): void {
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Uploaded PDF is empty');
    }
    if (
      file.mimetype !== 'application/pdf' ||
      !file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      throw new BadRequestException(
        'Invalid file type. Only PDF files are allowed',
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }
    if (!file.buffer.slice(0, 5).toString('utf8').startsWith('%PDF')) {
      throw new BadRequestException('Uploaded file is not a valid PDF');
    }
  }

  async updatePage(userId: string, storyId: string, pageId: string, content: string) {
    await this.storyAccessService.requireOwnership(storyId, userId);
    const page = await this.storyPageRepository.findOne({ where: { id: pageId, storyId } });
    if (!page) throw new NotFoundException('Page not found');
    const trimmed = content.trim();
    if (!trimmed) throw new BadRequestException('Content cannot be empty');
    if (trimmed.length > MAX_STORY_PAGE_CHARACTERS) {
      throw new BadRequestException('A page cannot contain more than 1000 characters');
    }
    const pages = await this.storyPageRepository.find({ where: { storyId }, order: { pageNumber: 'ASC' } });
    const source = pages.map((item) => item.id === pageId ? trimmed : item.text).join('\n\n');
    const result = await this.replaceStoryPages(userId, storyId, source, 'update');
    void this.auditService.record({ adminId: userId, action: AuditAction.STORY_PAGE_UPDATED, targetType: 'STORY_PAGE', targetId: pageId, description: 'Story page updated', metadata: { storyId }, ...(await this.actorInfo(userId)) });
    return result;
  }

  async deletePage(userId: string, storyId: string, pageId: string): Promise<void> {
    await this.storyAccessService.requireOwnership(storyId, userId);
    const pages = await this.storyPageRepository.find({ where: { storyId }, order: { pageNumber: 'ASC' } });
    const page = pages.find((item) => item.id === pageId);
    if (!page) throw new NotFoundException('Page not found');
    if (pages.length === 1) throw new BadRequestException('A story must contain at least one page');
    await this.replaceStoryPages(userId, storyId, pages.filter((item) => item.id !== pageId).map((item) => item.text).join('\n\n'), 'delete');
    if (page.imagePublicId) void this.cloudinaryService.deleteImage(page.imagePublicId);
    void this.auditService.record({ adminId: userId, action: AuditAction.STORY_PAGE_DELETED, targetType: 'STORY_PAGE', targetId: pageId, description: 'Story page deleted', metadata: { storyId }, ...(await this.actorInfo(userId)) });
  }

  async reorderPages(userId: string, storyId: string, pageIds: string[]) {
    await this.storyAccessService.requireOwnership(storyId, userId);
    const pages = await this.storyPageRepository.find({ where: { storyId }, order: { pageNumber: 'ASC' } });
    if (pages.length !== pageIds.length || new Set(pageIds).size !== pageIds.length || pages.some((page) => !pageIds.includes(page.id))) {
      throw new BadRequestException('pageIds must contain every page exactly once');
    }
    await this.dataSource.transaction(async (manager) => {
      for (let index = 0; index < pageIds.length; index++) {
        await manager.update(StoryPage, pageIds[index], { pageNumber: index + 1 });
      }
    });
    return this.getPages(storyId, userId);
  }

  private async replaceStoryPages(userId: string, storyId: string, source: string, _operation: string) {
    const sections = this.storyParserService.splitIntoSections(source);
    await this.dataSource.transaction(async (manager) => {
      const current = await manager.find(StoryPage, { where: { storyId }, order: { pageNumber: 'ASC' } });
      const next = sections.map((section, index) => {
        const existing = current[index];
        const changed = !existing || existing.text !== section.text;
        const normalized = section.text.replace(/\s+/g, ' ').trim();
        return manager.create(StoryPage, {
          ...(existing ?? {}), storyId, pageNumber: index + 1, text: section.text,
          wordCount: normalized ? normalized.split(' ').length : 0,
          status: PageStatus.READY,
          imageStatus: changed ? IllustrationPageStatus.PENDING : existing.imageStatus,
          imageUrl: changed ? null : existing.imageUrl,
          imagePublicId: changed ? null : existing.imagePublicId,
          imageError: changed ? null : existing.imageError,
        });
      });
      await manager.delete(StoryPage, current.slice(sections.length).map((page) => page.id));
      await manager.save(StoryPage, next);
      await manager.update(Story, storyId, { originalText: source });
    });
    return this.getPages(storyId, userId);
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
        language: body?.language ?? parsedStory.language ?? undefined,
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
      genreId: story.genreId ?? undefined,
      eraId: story.eraId ?? undefined,
      civilizationId: story.civilizationId ?? undefined,
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

  private static readonly CONTEXT_FIELDS = [
    'era',
    'year',
    'location',
    'civilization',
    'customCivilization',
    'theme',
    'customTheme',
  ] as const;

  private pickContextFields(dto: object): StoryContextInput {
    const picked: Record<string, unknown> = {};
    for (const field of StoryService.CONTEXT_FIELDS) {
      if (field in dto) {
        picked[field] = (dto as Record<string, unknown>)[field];
      }
    }
    return picked;
  }

  private contextPatch(
    dto: object,
    context: NormalizedStoryContext,
  ): Partial<Story> {
    const patch: Partial<Story> = {};
    const mapping: Record<string, keyof NormalizedStoryContext> = {
      era: 'era',
      year: 'year',
      location: 'location',
      civilization: 'civilization',
      customCivilization: 'customCivilization',
      theme: 'theme',
      customTheme: 'customTheme',
    };
    for (const field of StoryService.CONTEXT_FIELDS) {
      if (field in dto) {
        (patch as Record<string, unknown>)[field] = context[mapping[field]];
      }
    }
    return patch;
  }

  private deleteContextFields(dto: Record<string, unknown>): void {
    for (const field of StoryService.CONTEXT_FIELDS) {
      delete dto[field];
    }
  }

  private hasStoryContext(dto: object): boolean {
    return StoryService.CONTEXT_FIELDS.some((field) => field in dto);
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

    const previousVisibility = story.visibility;
    story.visibility = visibility;
    await this.storyRepository.save(story);

    await this.publicCacheService.bust();

    void this.auditService.record({
      adminId: userId,
      action: AuditAction.STORY_VISIBILITY_CHANGED,
      targetType: 'STORY',
      targetId: story.id,
      description: `Story "${story.title}" visibility changed`,
      metadata: {
        title: story.title,
        from: previousVisibility,
        to: visibility,
      },
      ...(await this.actorInfo(userId)),
    });

    return this.toResponseDto(story);
  }

  async shareStory(
    userId: string,
    storyId: string,
    targetUserEmail: string,
  ): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = targetUserEmail.toLowerCase().trim();
    this.logger.log(
      `Sharing story: ${storyId} with user email: ${normalizedEmail}`,
    );

    const story = await this.storyAccessService.requireOwnership(
      storyId,
      userId,
    );

    // Resolve the email to an internal user ID before creating the share.
    const targetUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Prevent sharing with yourself
    if (targetUser.id === userId) {
      throw new BadRequestException('Cannot share story with yourself');
    }

    // Check for existing share
    const existingShare = await this.storyShareRepository.findOne({
      where: { storyId, userId: targetUser.id },
    });
    if (existingShare) {
      throw new BadRequestException('Story already shared with this user');
    }

    // Create share
    const share = this.storyShareRepository.create({
      storyId,
      userId: targetUser.id,
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
      targetUser.id,
      NotificationType.STORY_SHARED,
      'Story shared with you',
      `"${story.title}" has been shared with you by ${sharerName}.`,
      { storyId, sharedBy: userId },
    );

    void this.auditService.record({
      adminId: userId,
      action: AuditAction.STORY_SHARED,
      targetType: 'STORY',
      targetId: story.id,
      description: `Story "${story.title}" shared`,
      metadata: {
        title: story.title,
        sharedWith: targetUser.id,
        sharedWithName: targetUser.name ?? null,
        sharerName,
        permission: 'VIEW',
      },
      ...(await this.actorInfo(userId)),
    });

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

    void this.auditService.record({
      adminId: userId,
      action: AuditAction.STORY_ACCESS_REMOVED,
      targetType: 'STORY',
      targetId: story.id,
      description: `Story "${story.title}" access removed`,
      metadata: {
        title: story.title,
        targetUserId,
      },
      ...(await this.actorInfo(userId)),
    });
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
