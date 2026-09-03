import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StoryAccessService } from './story-access.service';
import { StoryVisibility } from '../../../common/enums/story-visibility.enum';

describe('StoryAccessService', () => {
  let service: StoryAccessService;
  let storyRepo: { findOne: jest.Mock };
  let shareRepo: { findOne: jest.Mock };

  const makeStory = (overrides: Partial<any> = {}) => ({
    id: 'story-1',
    userId: 'owner-1',
    visibility: StoryVisibility.PRIVATE,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    storyRepo = { findOne: jest.fn() };
    shareRepo = { findOne: jest.fn() };
    service = new StoryAccessService(storyRepo as any, shareRepo as any);
  });

  describe('canAccessStory', () => {
    it('throws NotFoundException when story missing', async () => {
      storyRepo.findOne.mockResolvedValue(null);
      await expect(
        service.canAccessStory('story-1', 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('grants guest access only for PUBLIC stories', async () => {
      storyRepo.findOne.mockResolvedValue(
        makeStory({ visibility: StoryVisibility.PUBLIC }),
      );
      const { canAccess } = await service.canAccessStory('story-1');
      expect(canAccess).toBe(true);

      storyRepo.findOne.mockResolvedValue(
        makeStory({ visibility: StoryVisibility.PRIVATE }),
      );
      const denied = await service.canAccessStory('story-1');
      expect(denied.canAccess).toBe(false);
    });

    it('always grants the owner access', async () => {
      storyRepo.findOne.mockResolvedValue(
        makeStory({ userId: 'owner-1', visibility: StoryVisibility.PRIVATE }),
      );
      const { canAccess } = await service.canAccessStory('story-1', 'owner-1');
      expect(canAccess).toBe(true);
    });

    it('grants access to PUBLIC for any authenticated user', async () => {
      storyRepo.findOne.mockResolvedValue(
        makeStory({ visibility: StoryVisibility.PUBLIC }),
      );
      const { canAccess } = await service.canAccessStory('story-1', 'stranger');
      expect(canAccess).toBe(true);
    });

    it('denies PRIVATE stories to non-owners', async () => {
      storyRepo.findOne.mockResolvedValue(
        makeStory({ visibility: StoryVisibility.PRIVATE }),
      );
      const { canAccess } = await service.canAccessStory('story-1', 'stranger');
      expect(canAccess).toBe(false);
    });

    it('grants SHARED access only when a share record exists', async () => {
      storyRepo.findOne.mockResolvedValue(
        makeStory({ visibility: StoryVisibility.SHARED }),
      );
      shareRepo.findOne.mockResolvedValue({ id: 'share-1' });
      const shared = await service.canAccessStory('story-1', 'friend');
      expect(shared.canAccess).toBe(true);

      shareRepo.findOne.mockResolvedValue(null);
      const notShared = await service.canAccessStory('story-1', 'other');
      expect(notShared.canAccess).toBe(false);
    });

    it('denies unknown visibility values', async () => {
      storyRepo.findOne.mockResolvedValue(makeStory({ visibility: 'WEIRD' }));
      const { canAccess } = await service.canAccessStory('story-1', 'u1');
      expect(canAccess).toBe(false);
    });
  });

  describe('requireAccess', () => {
    it('returns the story when access allowed', async () => {
      storyRepo.findOne.mockResolvedValue(
        makeStory({ visibility: StoryVisibility.PUBLIC }),
      );
      const story = await service.requireAccess('story-1');
      expect(story.id).toBe('story-1');
    });

    it('throws ForbiddenException when access denied', async () => {
      storyRepo.findOne.mockResolvedValue(
        makeStory({ visibility: StoryVisibility.PRIVATE }),
      );
      await expect(
        service.requireAccess('story-1', 'stranger'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('requireOwnership', () => {
    it('throws NotFoundException when story missing', async () => {
      storyRepo.findOne.mockResolvedValue(null);
      await expect(
        service.requireOwnership('story-1', 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException for non-owners', async () => {
      storyRepo.findOne.mockResolvedValue(makeStory({ userId: 'owner-1' }));
      await expect(
        service.requireOwnership('story-1', 'intruder'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns the story for the owner', async () => {
      storyRepo.findOne.mockResolvedValue(makeStory({ userId: 'owner-1' }));
      const story = await service.requireOwnership('story-1', 'owner-1');
      expect(story.id).toBe('story-1');
    });
  });
});
