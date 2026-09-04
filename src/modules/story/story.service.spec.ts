import { Test } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { StoryShare } from '../../database/entities/story-share.entity';
import { User } from '../../database/entities/user.entity';
import { Notification } from '../../notifications/notification.entity';
import { NotificationType } from '../../notifications/notification-type.enum';
import { StoryVisibility } from '../../common/enums/story-visibility.enum';
import { StoryStatus } from '../../common/enums/story-status.enum';
import { SourceType } from '../../common/enums/source-type.enum';
import { StoryType } from '../../common/enums/story-type.enum';
import { StoryEra } from '../../common/enums/story-era.enum';
import { StoryCivilization } from '../../common/enums/story-civilization.enum';
import { StoryTheme } from '../../common/enums/story-theme.enum';
import { IllustrationPageStatus } from '../../illustration/enums/illustration-page-status.enum';
import { StoryService } from './story.service';
import { StoryParserService } from './services/story-parser.service';
import { StoryContextService } from './services/story-context.service';
import { PdfParserService } from './services/pdf-parser.service';
import { StoryAccessService } from './services/story-access.service';
import { IllustrationStatusService } from '../../illustration/services/illustration-status.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { PublicCacheService } from '../../common/services/public-cache.service';
import { NotificationsService } from '../../notifications/notifications.service';

describe('StoryService', () => {
  let service: StoryService;
  let storyRepo: any;
  let pageRepo: any;
  let userRepo: any;
  let dataSource: any;
  let accessService: any;
  let statusService: any;
  let cloudinary: any;
  let cache: any;
  let parser: any;
  let pdfParser: any;
  let manager: any;
  let notificationsService: any;
  let shareRepo: any;

  let qb: any;

  function makeQb(terminal: Record<string, unknown>): any {
    return {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getOne: jest.fn(),
      ...terminal,
    };
  }

  function makeStory(overrides: Partial<Story> = {}): Story {
    const s = new Story();
    Object.assign(s, {
      id: 's-1',
      userId: 'u-1',
      title: 'Test Story',
      description: 'desc',
      originalText: 'text',
      sourceType: SourceType.TEXT,
      status: StoryStatus.READY,
      visibility: StoryVisibility.PRIVATE,
      era: StoryEra.UNSPECIFIED,
      year: null,
      location: null,
      civilization: StoryCivilization.UNSPECIFIED,
      customCivilization: null,
      theme: StoryTheme.UNSPECIFIED,
      customTheme: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    });
    Object.assign(s, overrides);
    return s;
  }

  function makePage(overrides: Partial<StoryPage> = {}): StoryPage {
    const p = new StoryPage();
    Object.assign(p, {
      id: 'p-1',
      storyId: 's-1',
      pageNumber: 1,
      title: null,
      text: 'Once upon a time...',
      imageUrl: 'https://cdn/page.jpg',
      imagePublicId: 'pub-page-1',
      imageStatus: IllustrationPageStatus.COMPLETED,
      sceneDescription: null,
      location: null,
      imagePrompt: 'a prompt',
      imageError: null,
    });
    Object.assign(p, overrides);
    return p;
  }

  beforeEach(async () => {
    qb = makeQb({});
    storyRepo = {
      createQueryBuilder: jest.fn(() => qb),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    pageRepo = {
      find: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    shareRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    userRepo = { findOne: jest.fn() };
    manager = {
      delete: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      }),
    };
    dataSource = { transaction: jest.fn(async (cb) => cb(manager)) };
    accessService = {
      requireAccess: jest.fn(),
      requireOwnership: jest.fn(),
      canAccessStory: jest.fn(),
    };
    statusService = {
      computeStatus: jest.fn().mockReturnValue({
        status: 'COMPLETED',
        totalPages: 1,
        pending: 0,
        queued: 0,
        generating: 0,
        uploading: 0,
        completed: 1,
        failed: 0,
        progress: 100,
      }),
    };
    cloudinary = {
      deleteImage: jest.fn().mockResolvedValue(undefined),
      uploadImage: jest.fn(),
    };
    cache = { bust: jest.fn().mockResolvedValue(undefined) };
    parser = {
      parse: jest
        .fn()
        .mockReturnValue({ title: 'T', language: 'en', sections: [] }),
    };
    pdfParser = { extractText: jest.fn() };
    notificationsService = { create: jest.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        StoryService,
        { provide: getRepositoryToken(Story), useValue: storyRepo },
        { provide: getRepositoryToken(StoryPage), useValue: pageRepo },
        { provide: getRepositoryToken(StoryShare), useValue: shareRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Notification), useValue: {} },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: StoryParserService, useValue: parser },
        { provide: StoryContextService, useClass: StoryContextService },
        { provide: PdfParserService, useValue: pdfParser },
        { provide: StoryAccessService, useValue: accessService },
        { provide: IllustrationStatusService, useValue: statusService },
        { provide: CloudinaryService, useValue: cloudinary },
        { provide: PublicCacheService, useValue: cache },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
      ],
    }).compile();

    service = module.get(StoryService);
  });

  describe('findOne access control', () => {
    it('returns safe details for an owner', async () => {
      const story = makeStory();
      accessService.requireAccess.mockResolvedValue(story);
      pageRepo.find.mockResolvedValue([makePage()]);
      userRepo.findOne.mockResolvedValue({
        id: 'u-1',
        firstName: 'Ahmed',
        lastName: 'Ali',
        name: 'Ahmed Ali',
        avatarUrl: 'https://cdn/avatar.jpg',
      });

      const result = await service.findOne('u-1', 's-1');

      expect(accessService.requireAccess).toHaveBeenCalledWith('s-1', 'u-1');
      expect(result.author).toEqual({
        id: 'u-1',
        name: 'Ahmed Ali',
        avatarUrl: 'https://cdn/avatar.jpg',
      });
      expect(result.stats).toMatchObject({
        totalPages: 1,
        illustratedPages: 1,
        failedPages: 0,
        progress: 100,
      });
      expect(result.pages[0]).toMatchObject({
        id: 'p-1',
        pageNumber: 1,
        text: 'Once upon a time...',
        imageUrl: 'https://cdn/page.jpg',
      });
      // Sensitive internals must not leak
      expect(result.pages[0]).not.toHaveProperty('imagePrompt');
      expect(result.pages[0]).not.toHaveProperty('imageError');
      expect(result.pages[0]).not.toHaveProperty('imagePublicId');
      expect(result).not.toHaveProperty('originalText');
    });

    it('allows guest access to a PUBLIC story', async () => {
      accessService.requireAccess.mockResolvedValue(
        makeStory({ visibility: StoryVisibility.PUBLIC }),
      );
      pageRepo.find.mockResolvedValue([]);
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne(undefined, 's-1');

      expect(accessService.requireAccess).toHaveBeenCalledWith(
        's-1',
        undefined,
      );
      expect(result.author.id).toBe('u-1');
      expect(result.pages).toEqual([]);
    });

    it('rethrows Forbidden when access is denied', async () => {
      accessService.requireAccess.mockRejectedValue(
        new ForbiddenException('Access denied'),
      );

      await expect(service.findOne('u-2', 's-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('maps failed pages into stats', async () => {
      accessService.requireAccess.mockResolvedValue(makeStory());
      pageRepo.find.mockResolvedValue([
        makePage({ id: 'p-ok', imageStatus: IllustrationPageStatus.COMPLETED }),
        makePage({ id: 'p-fail', imageStatus: IllustrationPageStatus.FAILED }),
      ]);
      statusService.computeStatus.mockReturnValue({
        status: 'PARTIALLY_FAILED',
        totalPages: 2,
        pending: 0,
        queued: 0,
        generating: 0,
        uploading: 0,
        completed: 1,
        failed: 1,
        progress: 50,
      });
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne('u-1', 's-1');

      expect(result.stats.failedPages).toBe(1);
      expect(result.stats.illustratedPages).toBe(1);
    });
  });

  describe('remove cleanup', () => {
    it('deletes shares, story notifications, pages, story, then Cloudinary images', async () => {
      const story = makeStory();
      story.pages = [makePage(), makePage({ id: 'p-2', imagePublicId: null })];
      storyRepo.findOne.mockResolvedValue(story);

      await service.remove('u-1', 's-1');

      expect(storyRepo.findOne).toHaveBeenCalledWith({
        where: { id: 's-1' },
        relations: { pages: true },
      });
      expect(cloudinary.deleteImage).toHaveBeenCalledWith('pub-page-1');
      expect(cloudinary.deleteImage).not.toHaveBeenCalledWith(null);
      expect(cache.bust).toHaveBeenCalled();
    });

    it('throws Forbidden for non-owner deletion', async () => {
      storyRepo.findOne.mockResolvedValue(makeStory());
      await expect(service.remove('u-2', 's-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFound when story is missing', async () => {
      storyRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('u-1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('applies visibility filter and updated sort', async () => {
      qb.getManyAndCount.mockResolvedValue([[makeStory()], 1]);

      await service.findAll('u-1', {
        visibility: StoryVisibility.PUBLIC,
        sort: 'updated',
        page: 1,
        limit: 10,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'story.visibility = :visibility',
        {
          visibility: StoryVisibility.PUBLIC,
        },
      );
      expect(qb.orderBy).toHaveBeenCalledWith('story.updatedAt', 'DESC');
    });

    it('defaults to latest (createdAt desc) sort', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll('u-1', { page: 1, limit: 10 });

      expect(qb.orderBy).toHaveBeenCalledWith('story.createdAt', 'DESC');
    });
  });

  describe('create', () => {
    it('busts the public cache after creation', async () => {
      parser.parse.mockReturnValue({
        title: 'T',
        language: 'en',
        sections: [{ order: 1, text: 'x' }],
      });
      storyRepo.create.mockReturnValue(makeStory());
      storyRepo.save.mockResolvedValue(makeStory());
      pageRepo.save.mockResolvedValue([]);

      await service.create('u-1', { title: 'T', text: 'x' } as any);

      expect(cache.bust).toHaveBeenCalled();
    });

    it('normalizes and stores the Story Context separately from content', async () => {
      parser.parse.mockReturnValue({
        title: 'T',
        language: 'en',
        sections: [{ order: 1, text: 'x' }],
      });
      const fullStory = makeStory();
      storyRepo.create.mockReturnValue(fullStory);
      storyRepo.save.mockResolvedValue(fullStory);
      pageRepo.save.mockResolvedValue([]);

      await service.create('u-1', {
        title: 'T',
        text: 'raw content',
        era: StoryEra.BCE,
        year: 1250,
        location: '  Thebes, Egypt ',
        civilization: StoryCivilization.ANCIENT_EGYPTIAN,
        theme: StoryTheme.ADVENTURE,
      } as any);

      expect(storyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          era: StoryEra.BCE,
          year: 1250,
          location: 'Thebes, Egypt',
          civilization: StoryCivilization.ANCIENT_EGYPTIAN,
          theme: StoryTheme.ADVENTURE,
        }),
      );
      // The raw content remains untouched / separate.
      expect(storyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ originalText: 'raw content' }),
      );
    });

    it('stores custom civilization and theme when CUSTOM', async () => {
      parser.parse.mockReturnValue({
        title: 'T',
        language: 'en',
        sections: [{ order: 1, text: 'x' }],
      });
      const fullStory = makeStory();
      storyRepo.create.mockReturnValue(fullStory);
      storyRepo.save.mockResolvedValue(fullStory);
      pageRepo.save.mockResolvedValue([]);

      await service.create('u-1', {
        title: 'T',
        text: 'x',
        civilization: StoryCivilization.CUSTOM,
        customCivilization: 'Nubian Civilization',
        theme: StoryTheme.CUSTOM,
        customTheme: 'Political drama',
      } as any);

      expect(storyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          civilization: StoryCivilization.CUSTOM,
          customCivilization: 'Nubian Civilization',
          theme: StoryTheme.CUSTOM,
          customTheme: 'Political drama',
        }),
      );
    });
  });

  describe('story context update & security', () => {
    it('allows the owner to update the Story Context (normalizes values)', async () => {
      const story = makeStory();
      storyRepo.findOne.mockResolvedValue(story);
      storyRepo.save.mockResolvedValue(story);

      await service.update('u-1', 's-1', {
        location: ' Rome, Italy ',
        era: StoryEra.CE,
        year: 120,
      } as any);

      expect(story.era).toBe(StoryEra.CE);
      expect(story.year).toBe(120);
      expect(story.location).toBe('Rome, Italy');
      expect(storyRepo.save).toHaveBeenCalledWith(story);
    });

    it('treats custom civilization ignorable when not CUSTOM', async () => {
      const story = makeStory();
      storyRepo.findOne.mockResolvedValue(story);
      storyRepo.save.mockResolvedValue(story);

      await service.update('u-1', 's-1', {
        civilization: StoryCivilization.GREEK,
        customCivilization: 'should be ignored',
      } as any);

      expect(story.civilization).toBe(StoryCivilization.GREEK);
      expect(story.customCivilization).toBeNull();
    });

    it('requires custom civilization when CUSTOM (rejects)', async () => {
      const story = makeStory();
      storyRepo.findOne.mockResolvedValue(story);
      storyRepo.save.mockResolvedValue(story);

      await expect(
        service.update('u-1', 's-1', {
          civilization: StoryCivilization.CUSTOM,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storyRepo.save).not.toHaveBeenCalled();
    });

    it('prevents an unauthorized user from modifying the Story Context (IDOR)', async () => {
      const ownedByOther = makeStory({ userId: 'u-2' });
      storyRepo.findOne.mockResolvedValue(ownedByOther);
      storyRepo.save.mockResolvedValue(ownedByOther);

      await expect(
        service.update('u-1', 's-1', { era: StoryEra.BCE } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ownedByOther.era).not.toBe(StoryEra.BCE);
      expect(storyRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('createFromPdf story context', () => {
    it('normalizes and stores the Story Context on PDF-created stories', async () => {
      pdfParser.extractText.mockResolvedValue('Some extracted PDF text.');
      parser.parse.mockReturnValue({
        title: 'PDF Story',
        language: 'en',
        sections: [{ order: 1, text: 'x' }],
      });
      const pdfStory = makeStory();
      storyRepo.create.mockReturnValue(pdfStory);
      storyRepo.save.mockResolvedValue(pdfStory);
      pageRepo.save.mockResolvedValue([]);

      const file = {
        buffer: Buffer.from('%PDF-1.4 fake'),
        mimetype: 'application/pdf',
        originalname: 'story.pdf',
        size: 100,
      } as Express.Multer.File;

      await service.createFromPdf('u-1', file, {
        storyType: StoryType.HISTORICAL,
        era: StoryEra.CE,
        year: 120,
        location: ' Rome, Italy ',
        civilization: StoryCivilization.ROMAN,
        theme: StoryTheme.WAR,
      } as any);

      expect(storyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: SourceType.PDF,
          era: StoryEra.CE,
          year: 120,
          location: 'Rome, Italy',
          civilization: StoryCivilization.ROMAN,
          theme: StoryTheme.WAR,
        }),
      );
    });

    it('defaults Story Context to UNSPECIFIED/null when no context is sent', async () => {
      pdfParser.extractText.mockResolvedValue('text');
      parser.parse.mockReturnValue({
        title: 'PDF Story',
        language: 'en',
        sections: [],
      });
      const pdfStory = makeStory();
      storyRepo.create.mockReturnValue(pdfStory);
      storyRepo.save.mockResolvedValue(pdfStory);
      pageRepo.save.mockResolvedValue([]);

      const file = {
        buffer: Buffer.from('%PDF-1.4 fake'),
        mimetype: 'application/pdf',
        originalname: 'story.pdf',
        size: 100,
      } as Express.Multer.File;

      await service.createFromPdf('u-1', file, {
        storyType: StoryType.HISTORICAL,
      } as any);

      expect(storyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          era: StoryEra.UNSPECIFIED,
          year: null,
          location: null,
          civilization: StoryCivilization.UNSPECIFIED,
          theme: StoryTheme.UNSPECIFIED,
        }),
      );
    });
  });

  describe('shareStory', () => {
    it('creates a STORY_SHARED notification for the target user after saving the share', async () => {
      accessService.requireOwnership.mockResolvedValue(makeStory());
      userRepo.findOne.mockResolvedValue({ id: 'u-2', name: 'User B' });
      shareRepo.findOne.mockResolvedValue(null);
      shareRepo.create.mockReturnValue({ shareId: 'sh-1' });
      shareRepo.save.mockResolvedValue({});

      await service.shareStory('u-1', 's-1', 'u-2');

      expect(accessService.requireOwnership).toHaveBeenCalledWith('s-1', 'u-1');
      expect(shareRepo.save).toHaveBeenCalled();
      expect(notificationsService.create).toHaveBeenCalledWith(
        'u-2',
        NotificationType.STORY_SHARED,
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ storyId: 's-1' }),
      );
    });

    it('does not create a notification when the share already exists', async () => {
      accessService.requireOwnership.mockResolvedValue(makeStory());
      userRepo.findOne.mockResolvedValue({ id: 'u-2' });
      shareRepo.findOne.mockResolvedValue({ shareId: 'existing' });

      await expect(
        service.shareStory('u-1', 's-1', 'u-2'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe('removeShare', () => {
    it('creates a STORY_ACCESS_REMOVED notification after removing access', async () => {
      accessService.requireOwnership.mockResolvedValue(makeStory());
      shareRepo.findOne.mockResolvedValue({ shareId: 'sh-1' });
      shareRepo.remove.mockResolvedValue(undefined);

      await service.removeShare('u-1', 's-1', 'u-2');

      expect(shareRepo.remove).toHaveBeenCalled();
      expect(notificationsService.create).toHaveBeenCalledWith(
        'u-2',
        NotificationType.STORY_ACCESS_REMOVED,
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ storyId: 's-1' }),
      );
    });

    it('does not notify when the user never had access', async () => {
      accessService.requireOwnership.mockResolvedValue(makeStory());
      shareRepo.findOne.mockResolvedValue(null);

      await expect(
        service.removeShare('u-1', 's-1', 'u-2'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });
});
