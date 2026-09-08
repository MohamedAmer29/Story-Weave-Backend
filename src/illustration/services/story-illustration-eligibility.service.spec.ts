import { StoryPage } from '../../database/entities/story-page.entity';
import { IllustrationPageStatus } from '../enums/illustration-page-status.enum';
import { StoryIllustrationEligibilityService } from './story-illustration-eligibility.service';

describe('StoryIllustrationEligibilityService', () => {
  let service: StoryIllustrationEligibilityService;

  beforeEach(() => {
    service = new StoryIllustrationEligibilityService();
  });

  function makePage(overrides: Partial<StoryPage> = {}): StoryPage {
    return Object.assign(new StoryPage(), {
      id: 'page-1',
      storyId: 'story-1',
      pageNumber: 1,
      text: 'text',
      imageStatus: IllustrationPageStatus.PENDING,
      imagePrompt: null,
      imageUrl: null,
      imageError: null,
      ...overrides,
    });
  }

  describe('isActive', () => {
    it('is false for a page that has never been generated', () => {
      expect(service.isActive(makePage())).toBe(false);
    });

    it('is true for QUEUED, GENERATING and UPLOADING pages', () => {
      for (const status of [
        IllustrationPageStatus.QUEUED,
        IllustrationPageStatus.GENERATING,
        IllustrationPageStatus.UPLOADING,
      ]) {
        expect(service.isActive(makePage({ imageStatus: status }))).toBe(true);
      }
    });

    it('is false for COMPLETED and FAILED pages', () => {
      expect(
        service.isActive(makePage({ imageStatus: IllustrationPageStatus.COMPLETED })),
      ).toBe(false);
      expect(
        service.isActive(makePage({ imageStatus: IllustrationPageStatus.FAILED })),
      ).toBe(false);
    });

    it('treats a null imageStatus as inactive', () => {
      expect(service.isActive(makePage({ imageStatus: null }))).toBe(false);
    });
  });

  describe('isComplete', () => {
    it('is false when imageStatus is not COMPLETED', () => {
      expect(
        service.isComplete(
          makePage({
            imageStatus: IllustrationPageStatus.FAILED,
            imageUrl: 'http://img',
          }),
        ),
      ).toBe(false);
    });

    it('is false when imageUrl is missing', () => {
      expect(
        service.isComplete(
          makePage({ imageStatus: IllustrationPageStatus.COMPLETED }),
        ),
      ).toBe(false);
    });

    it('is false when imageUrl is blank or whitespace', () => {
      expect(
        service.isComplete(
          makePage({ imageStatus: IllustrationPageStatus.COMPLETED, imageUrl: '  ' }),
        ),
      ).toBe(false);
    });

    it('is true when COMPLETED with a valid URL', () => {
      expect(
        service.isComplete(
          makePage({
            imageStatus: IllustrationPageStatus.COMPLETED,
            imageUrl: 'https://img.example.com/a.png',
          }),
        ),
      ).toBe(true);
    });
  });

  describe('requiresIllustration', () => {
    it('returns false for COMPLETED pages with a valid URL', () => {
      expect(
        service.requiresIllustration(
          makePage({
            imageStatus: IllustrationPageStatus.COMPLETED,
            imageUrl: 'https://img.example.com/a.png',
          }),
        ),
      ).toBe(false);
    });

    it('returns false for active pages', () => {
      expect(
        service.requiresIllustration(
          makePage({ imageStatus: IllustrationPageStatus.GENERATING }),
        ),
      ).toBe(false);
    });

    it('returns true for PENDING pages', () => {
      expect(service.requiresIllustration(makePage())).toBe(true);
    });

    it('returns true for FAILED pages', () => {
      expect(
        service.requiresIllustration(
          makePage({ imageStatus: IllustrationPageStatus.FAILED }),
        ),
      ).toBe(true);
    });

    it('returns true for a null imageStatus (stale/interrupted)', () => {
      expect(service.requiresIllustration(makePage({ imageStatus: null }))).toBe(
        true,
      );
    });

    it('returns true for COMPLETED pages lacking an image URL', () => {
      expect(
        service.requiresIllustration(
          makePage({ imageStatus: IllustrationPageStatus.COMPLETED }),
        ),
      ).toBe(true);
    });
  });

  describe('selectPagesRequiringIllustration', () => {
    it('returns only eligible pages, preserving order', () => {
      const pages = [
        makePage({ id: 'p-1' }),
        makePage({
          id: 'p-2',
          imageStatus: IllustrationPageStatus.COMPLETED,
          imageUrl: 'https://img.example.com/a.png',
        }),
        makePage({ id: 'p-3', imageStatus: IllustrationPageStatus.FAILED }),
        makePage({ id: 'p-4', imageStatus: IllustrationPageStatus.GENERATING }),
        makePage({ id: 'p-5', imageStatus: null }),
      ];

      const result = service.selectPagesRequiringIllustration(pages);

      expect(result.map((p) => p.id)).toEqual(['p-1', 'p-3', 'p-5']);
    });
  });

  describe('evaluate', () => {
    it('returns the correct reason per page', () => {
      const pages = [
        makePage({ id: 'p-1' }),
        makePage({
          id: 'p-2',
          imageStatus: IllustrationPageStatus.COMPLETED,
          imageUrl: 'https://img.example.com/a.png',
        }),
        makePage({
          id: 'p-3',
          imageStatus: IllustrationPageStatus.UPLOADING,
        }),
        makePage({ id: 'p-4', imageStatus: IllustrationPageStatus.FAILED }),
        makePage({ id: 'p-5', imageStatus: null }),
      ];

      const breakdown = service.evaluate(pages);

      expect(breakdown).toEqual([
        { page: pages[0], requiresIllustration: true, reason: 'NEVER_GENERATED' },
        { page: pages[1], requiresIllustration: false, reason: 'COMPLETED' },
        { page: pages[2], requiresIllustration: false, reason: 'ACTIVE' },
        { page: pages[3], requiresIllustration: true, reason: 'FAILED' },
        { page: pages[4], requiresIllustration: true, reason: 'NEVER_GENERATED' },
      ]);
    });
  });
});