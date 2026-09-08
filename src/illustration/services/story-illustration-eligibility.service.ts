import { Injectable } from '@nestjs/common';
import { StoryPage } from '../../database/entities/story-page.entity';
import { IllustrationPageStatus } from '../enums/illustration-page-status.enum';
import { StoryIllustrationStatus } from '../enums/story-illustration-status.enum';

/**
 * Centralized source of truth for whether a StoryPage still needs an
 * illustration. Keeps the "does this page require generation?" conditions in
 * one place instead of scattering imageStatus/imageUrl checks across
 * controllers and services.
 *
 * A page requires illustration when it:
 *   - has never been generated (null / PENDING)
 *   - generation previously failed (FAILED)
 *   - generation was interrupted (stuck in a pre-COMPLETED state)
 *
 * A page must be skipped when it:
 *   - is COMPLETED with a valid image URL
 *   - is actively being generated (QUEUED / GENERATING / UPLOADING)
 */
export interface StoryPageEligibility {
  page: StoryPage;
  requiresIllustration: boolean;
  reason:
    | 'COMPLETED'
    | 'ACTIVE'
    | 'PENDING'
    | 'FAILED'
    | 'NEVER_GENERATED';
}

@Injectable()
export class StoryIllustrationEligibilityService {
  private static readonly ACTIVE_STATUSES = [
    IllustrationPageStatus.QUEUED,
    IllustrationPageStatus.GENERATING,
    IllustrationPageStatus.UPLOADING,
  ];

  /**
   * Whether the page is actively being generated and must not receive a new
   * BullMQ job.
   */
  isActive(page: StoryPage): boolean {
    return StoryIllustrationEligibilityService.ACTIVE_STATUSES.includes(
      page.imageStatus ?? IllustrationPageStatus.PENDING,
    );
  }

  /**
   * Whether the page already has a successful, valid illustration.
   */
  isComplete(page: StoryPage): boolean {
    return (
      page.imageStatus === IllustrationPageStatus.COMPLETED &&
      typeof page.imageUrl === 'string' &&
      page.imageUrl.trim().length > 0
    );
  }

  /**
   * Whether the page still requires an illustration.
   *
   * COMPLETED pages (with a valid image URL) and pages that are actively
   * being processed are never re-queued by the "illustrate remaining" flow.
   */
  requiresIllustration(page: StoryPage): boolean {
    if (this.isComplete(page)) {
      return false;
    }
    if (this.isActive(page)) {
      return false;
    }
    return true;
  }

  /**
   * Returns the pages that still require an illustration, preserving input
   * order. Pages that are COMPLETED or actively generating are excluded.
   */
  selectPagesRequiringIllustration(pages: StoryPage[]): StoryPage[] {
    return pages.filter((page) => this.requiresIllustration(page));
  }

  /**
   * Computes a per-page eligibility breakdown (primarily for auditing and
   * debugging). The caller should normally use selectPagesRequiringIllustration.
   */
  evaluate(pages: StoryPage[]): StoryPageEligibility[] {
    return pages.map((page) => {
      if (this.isComplete(page)) {
        return {
          page,
          requiresIllustration: false,
          reason: 'COMPLETED',
        };
      }
      if (this.isActive(page)) {
        return {
          page,
          requiresIllustration: false,
          reason: 'ACTIVE',
        };
      }
      if (page.imageStatus === IllustrationPageStatus.FAILED) {
        return {
          page,
          requiresIllustration: true,
          reason: 'FAILED',
        };
      }
      if (
        page.imageStatus === null ||
        page.imageStatus === undefined ||
        page.imageStatus === IllustrationPageStatus.PENDING
      ) {
        return {
          page,
          requiresIllustration: true,
          reason: 'NEVER_GENERATED',
        };
      }
      return {
        page,
        requiresIllustration: true,
        reason: 'PENDING',
      };
    });
  }
}