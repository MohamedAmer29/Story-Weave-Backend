import { Injectable } from '@nestjs/common';
import { StoryPage } from '../../database/entities/story-page.entity';
import { IllustrationPageStatus } from '../enums/illustration-page-status.enum';
import { StoryIllustrationStatus } from '../enums/story-illustration-status.enum';

export interface IllustrationStatusResult {
  status: StoryIllustrationStatus;
  totalPages: number;
  pending: number;
  queued: number;
  generating: number;
  uploading: number;
  completed: number;
  failed: number;
  progress: number;
}

@Injectable()
export class IllustrationStatusService {
  computeStatus(pages: StoryPage[]): IllustrationStatusResult {
    if (!pages || pages.length === 0) {
      return {
        status: StoryIllustrationStatus.NOT_STARTED,
        totalPages: 0,
        pending: 0,
        queued: 0,
        generating: 0,
        uploading: 0,
        completed: 0,
        failed: 0,
        progress: 0,
      };
    }

    let pending = 0;
    let queued = 0;
    let generating = 0;
    let uploading = 0;
    let completed = 0;
    let failed = 0;

    for (const page of pages) {
      switch (page.imageStatus) {
        case IllustrationPageStatus.QUEUED:
          queued++;
          break;
        case IllustrationPageStatus.GENERATING:
          generating++;
          break;
        case IllustrationPageStatus.UPLOADING:
          uploading++;
          break;
        case IllustrationPageStatus.COMPLETED:
          completed++;
          break;
        case IllustrationPageStatus.FAILED:
          failed++;
          break;
        case IllustrationPageStatus.PENDING:
        case null:
        case undefined:
        default:
          pending++;
          break;
      }
    }

    const totalPages = pages.length;
    const progress =
      totalPages > 0 ? Math.round((completed / totalPages) * 100) : 0;

    let status: StoryIllustrationStatus;

    if (completed === totalPages && totalPages > 0) {
      status = StoryIllustrationStatus.COMPLETED;
    } else if (failed === totalPages) {
      status = StoryIllustrationStatus.FAILED;
    } else if (failed > 0) {
      status = StoryIllustrationStatus.PARTIALLY_FAILED;
    } else if (queued > 0) {
      status = StoryIllustrationStatus.GENERATING;
    } else {
      status = StoryIllustrationStatus.NOT_STARTED;
    }

    return {
      status,
      totalPages,
      pending,
      queued,
      generating,
      uploading,
      completed,
      failed,
      progress,
    };
  }
}
