import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { StoryLibraryService } from './services/story-library.service';
import { StoryType } from '../../common/enums/story-type.enum';
import { StoryVisibility } from '../../common/enums/story-visibility.enum';
import { SourceType } from '../../common/enums/source-type.enum';

describe('StoryController', () => {
  let controller: StoryController;
  let storyService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findMyStories: jest.Mock;
    findSharedStories: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    updateVisibility: jest.Mock;
    shareStory: jest.Mock;
    removeShare: jest.Mock;
    listShares: jest.Mock;
    createFromPdf: jest.Mock;
    append: jest.Mock;
  };
  let libraryService: {
    findPublic: jest.Mock;
  };

  const storyDto = {
    title: 'A New Story',
    storyType: StoryType.FANTASY,
    text: 'Once upon a time...',
    sourceType: SourceType.TEXT,
    visibility: StoryVisibility.PRIVATE,
    language: 'ENGLISH',
    visualStyle: 'watercolor',
    description: 'A short description',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    storyService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findMyStories: jest.fn(),
      findSharedStories: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
      updateVisibility: jest.fn(),
      shareStory: jest.fn(),
      removeShare: jest.fn().mockResolvedValue(undefined),
      listShares: jest.fn(),
      createFromPdf: jest.fn(),
      append: jest.fn(),
    };
    libraryService = { findPublic: jest.fn() };
    controller = new StoryController(
      storyService as unknown as StoryService,
      libraryService as unknown as StoryLibraryService,
    );
  });

  describe('create', () => {
    it('delegates to service with userId and dto', async () => {
      storyService.create.mockResolvedValue({ id: 's1' });
      await controller.create('u1', storyDto);
      expect(storyService.create).toHaveBeenCalledWith('u1', storyDto);
    });
  });

  describe('findAll / findMyStories / findSharedStories', () => {
    it('delegates findAll with pagination query', async () => {
      const query = { page: 1, limit: 10 };
      storyService.findAll.mockResolvedValue({ data: [] });
      await controller.findAll('u1', query);
      expect(storyService.findAll).toHaveBeenCalledWith('u1', query);
    });

    it('delegates findMyStories', async () => {
      storyService.findMyStories.mockResolvedValue({ data: [] });
      await controller.findMyStories('u1', { page: 2 });
      expect(storyService.findMyStories).toHaveBeenCalledWith('u1', {
        page: 2,
      });
    });

    it('delegates findSharedStories', async () => {
      storyService.findSharedStories.mockResolvedValue({ data: [] });
      await controller.findSharedStories('u1', {});
      expect(storyService.findSharedStories).toHaveBeenCalledWith('u1', {});
    });
  });

  describe('public endpoints', () => {
    it('listPublicStories returns wrapped library result for guests', async () => {
      libraryService.findPublic.mockResolvedValue({ data: [], meta: {} });
      const result = await controller.listPublicStories({ page: 1 } as any, undefined);
      expect(libraryService.findPublic).toHaveBeenCalledWith(
        { page: 1 },
        undefined,
        undefined,
      );
      expect(result).toEqual({ success: true, data: [], meta: {} });
    });

    it('listPublicStories forwards the viewer id when authenticated', async () => {
      libraryService.findPublic.mockResolvedValue({ data: [], meta: {} });
      await controller.listPublicStories({ page: 1 } as any, 'u-viewer');
      expect(libraryService.findPublic).toHaveBeenCalledWith(
        { page: 1 },
        undefined,
        'u-viewer',
      );
    });

    it('searchPublicStories forwards search query', async () => {
      libraryService.findPublic.mockResolvedValue({ data: [] });
      await controller.searchPublicStories({ search: 'dragon' } as any, undefined);
      expect(libraryService.findPublic).toHaveBeenCalledWith(
        { search: 'dragon' },
        undefined,
        undefined,
      );
    });
  });

  describe('findOne', () => {
    it('delegates with the current user id and uuid param', async () => {
      storyService.findOne.mockResolvedValue({ id: 's1' });
      const result = await controller.findOne('u1', { id: 'story-123' });
      expect(storyService.findOne).toHaveBeenCalledWith('u1', 'story-123');
      expect(result).toEqual({ id: 's1' });
    });

    it('allows anonymous reads by passing an undefined user id', async () => {
      storyService.findOne.mockResolvedValue({
        id: 's1',
        visibility: 'PUBLIC',
      });
      await controller.findOne(undefined, { id: 'story-123' });
      expect(storyService.findOne).toHaveBeenCalledWith(undefined, 'story-123');
    });
  });

  describe('update / remove', () => {
    it('delegates update', async () => {
      storyService.update.mockResolvedValue({ id: 's1' });
      await controller.update('u1', { id: 's1' }, { title: 'x' });
      expect(storyService.update).toHaveBeenCalledWith('u1', 's1', {
        title: 'x',
      });
    });

    it('delegates remove', async () => {
      await controller.remove('u1', { id: 's1' });
      expect(storyService.remove).toHaveBeenCalledWith('u1', 's1');
    });
  });

  describe('visibility / sharing', () => {
    it('delegates updateVisibility', async () => {
      storyService.updateVisibility.mockResolvedValue({ id: 's1' });
      await controller.updateVisibility(
        'u1',
        { id: 's1' },
        {
          visibility: StoryVisibility.PUBLIC,
        },
      );
      expect(storyService.updateVisibility).toHaveBeenCalledWith(
        'u1',
        's1',
        StoryVisibility.PUBLIC,
      );
    });

    it('delegates shareStory', async () => {
      storyService.shareStory.mockResolvedValue({});
      await controller.shareStory(
        'u1',
        { id: 's1' },
        {
          email: 'reader@example.com',
        },
      );
      expect(storyService.shareStory).toHaveBeenCalledWith(
        'u1',
        's1',
        'reader@example.com',
      );
    });

    it('delegates removeShare with target user id', async () => {
      await controller.removeShare('u1', {
        id: 's1',
        targetUserId: 'target-1',
      });
      expect(storyService.removeShare).toHaveBeenCalledWith(
        'u1',
        's1',
        'target-1',
      );
    });

    it('delegates listShares', async () => {
      storyService.listShares.mockResolvedValue([]);
      await controller.listShares('u1', { id: 's1' });
      expect(storyService.listShares).toHaveBeenCalledWith('u1', 's1');
    });
  });

  describe('uploadPdf', () => {
    it('delegates createFromPdf with file and body', async () => {
      storyService.createFromPdf.mockResolvedValue({ id: 's1' });
      const file = { originalname: 'book.pdf', buffer: Buffer.from('x') };
      const body = { storyType: StoryType.ADVENTURE, language: 'ENGLISH' };
      await controller.uploadPdf('u1', file as any, body as any);
      expect(storyService.createFromPdf).toHaveBeenCalledWith('u1', file, body);
    });
  });

  describe('append', () => {
    it('delegates text continuation with the optional file', async () => {
      storyService.append.mockResolvedValue({
        success: true,
        storyId: 's1',
      });
      const file = {
        originalname: 'continuation.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7'),
      };

      await controller.appendText(
        'u1',
        { id: 's1' },
        { content: undefined },
        file as any,
      );

      expect(storyService.append).toHaveBeenCalledWith(
        'u1',
        's1',
        undefined,
        file,
      );
    });
  });

  describe('getTypes', () => {
    it('returns formatted story type options', async () => {
      const result = await controller.getTypes();
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data).toHaveLength(Object.values(StoryType).length);
      expect(result.data).toContainEqual({ value: 'SCI_FI', label: 'Sci Fi' });
    });
  });

  describe('getCivilizationsMeta', () => {
    it('returns civilizations grouped by region in canonical order', async () => {
      const result = await controller.getCivilizationsMeta();
      const { data } = result;
      expect(data[0].id).toBe('Unspecified');
      const africa = data.find((r) => r.id === 'Africa');
      expect(africa).toBeDefined();
      expect(africa!.options[0].value).toBe('ANCIENT_EGYPTIAN');
      const custom = africa!.options.find((o) => o.kind === 'custom');
      expect(custom).toBeDefined();
      const fantasy = data.find((r) => r.id === 'Fantasy');
      expect(fantasy).toBeDefined();
      expect(fantasy!.options.map((o) => o.value)).toContain('MIDDLE_EARTH');
      const meCustom = fantasy!.options.find(
        (o) => o.value === 'CUSTOM_MIDDLE_EARTH',
      );
      expect(meCustom?.kind).toBe('custom');
      expect(meCustom?.label).toBe('Custom Middle-earth');
    });
  });
});
