import { IllustrationController } from './illustration.controller';
import { IllustrationService } from './illustration.service';
import { IllustrationStatusService } from './services/illustration-status.service';
import { StoryService } from '../modules/story/story.service';

describe('IllustrationController', () => {
  let controller: IllustrationController;
  let illustrationService: {
    queueStoryIllustrations: jest.Mock;
    regeneratePage: jest.Mock;
    regenerateCover: jest.Mock;
  };
  let statusService: { computeStatus: jest.Mock };
  let storyService: { getPagesForUser: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    illustrationService = {
      queueStoryIllustrations: jest.fn(),
      regeneratePage: jest.fn(),
      regenerateCover: jest.fn(),
    };
    statusService = { computeStatus: jest.fn() };
    storyService = { getPagesForUser: jest.fn() };
    controller = new IllustrationController(
      illustrationService as unknown as IllustrationService,
      statusService as unknown as IllustrationStatusService,
      storyService as unknown as StoryService,
    );
  });

  describe('generateIllustrations', () => {
    it('queues story illustrations with userId, storyId, and dto', async () => {
      const dto = { pages: [1, 2], promptVersion: 'v2' };
      illustrationService.queueStoryIllustrations.mockResolvedValue({
        queued: 2,
      });
      const result = await controller.generateIllustrations(
        'u1',
        { storyId: 's-1' } as any,
        dto as any,
      );
      expect(illustrationService.queueStoryIllustrations).toHaveBeenCalledWith(
        'u1',
        's-1',
        dto,
      );
      expect(result).toEqual({ queued: 2 });
    });
  });

  describe('regeneratePage', () => {
    it('delegates to the service with story and page ids', async () => {
      illustrationService.regeneratePage.mockResolvedValue({ queued: true });
      await controller.regeneratePage(
        'u1',
        { storyId: 's-1', pageId: 'p-1' } as any,
      );
      expect(illustrationService.regeneratePage).toHaveBeenCalledWith(
        'u1',
        's-1',
        'p-1',
      );
    });
  });

  describe('regenerateCover', () => {
    it('delegates to the service', async () => {
      illustrationService.regenerateCover.mockResolvedValue({ queued: true });
      await controller.regenerateCover('u1', { storyId: 's-1' } as any);
      expect(illustrationService.regenerateCover).toHaveBeenCalledWith('u1', 's-1');
    });
  });

  describe('getIllustrationStatus', () => {
    it('computes and returns formatted status from pages', async () => {
      const pages = [{ pageNumber: 1 }, { pageNumber: 2 }];
      storyService.getPagesForUser.mockResolvedValue(pages);
      statusService.computeStatus.mockReturnValue({
        status: 'COMPLETED',
        totalPages: 2,
        queued: 0,
        generating: 0,
        uploading: 0,
        completed: 2,
        failed: 0,
        progress: 100,
      });

      const result = await controller.getIllustrationStatus('u1', {
        storyId: 's-1',
      } as any);

      expect(storyService.getPagesForUser).toHaveBeenCalledWith('s-1', 'u1');
      expect(statusService.computeStatus).toHaveBeenCalledWith(pages);
      expect(result.success).toBe(true);
      expect(result.data.storyId).toBe('s-1');
      expect(result.data.status).toBe('COMPLETED');
      expect(result.data.totalPages).toBe(2);
    });
  });
});
