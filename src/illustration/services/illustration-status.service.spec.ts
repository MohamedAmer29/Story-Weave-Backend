import { IllustrationStatusService } from './illustration-status.service';
import { StoryPage } from '../../database/entities/story-page.entity';
import { IllustrationPageStatus } from '../enums/illustration-page-status.enum';
import { StoryIllustrationStatus } from '../enums/story-illustration-status.enum';

function makePage(imageStatus: IllustrationPageStatus | null): StoryPage {
  const page = Object.assign(new StoryPage(), { id: 'page-id' });
  page.imageStatus = imageStatus;
  return page;
}

describe('IllustrationStatusService', () => {
  let service: IllustrationStatusService;

  beforeEach(() => {
    service = new IllustrationStatusService();
  });

  it('returns NOT_STARTED for an empty story', () => {
    const result = service.computeStatus([]);
    expect(result.status).toBe(StoryIllustrationStatus.NOT_STARTED);
    expect(result.totalPages).toBe(0);
    expect(result.progress).toBe(0);
  });

  it('returns COMPLETED when all pages are completed', () => {
    const pages = [
      makePage(IllustrationPageStatus.COMPLETED),
      makePage(IllustrationPageStatus.COMPLETED),
    ];
    const result = service.computeStatus(pages);
    expect(result.status).toBe(StoryIllustrationStatus.COMPLETED);
    expect(result.completed).toBe(2);
    expect(result.progress).toBe(100);
  });

  it('returns GENERATING when some pages are queued/generating/uploading', () => {
    const pages = [
      makePage(IllustrationPageStatus.COMPLETED),
      makePage(IllustrationPageStatus.GENERATING),
      makePage(IllustrationPageStatus.QUEUED),
    ];
    const result = service.computeStatus(pages);
    expect(result.status).toBe(StoryIllustrationStatus.GENERATING);
    expect(result.completed).toBe(1);
    expect(result.generating).toBe(1);
    expect(result.queued).toBe(1);
  });

  it('returns PARTIALLY_FAILED when some pages fail', () => {
    const pages = [
      makePage(IllustrationPageStatus.COMPLETED),
      makePage(IllustrationPageStatus.FAILED),
    ];
    const result = service.computeStatus(pages);
    expect(result.status).toBe(StoryIllustrationStatus.PARTIALLY_FAILED);
    expect(result.failed).toBe(1);
  });

  it('returns FAILED when all pages fail', () => {
    const pages = [
      makePage(IllustrationPageStatus.FAILED),
      makePage(IllustrationPageStatus.FAILED),
    ];
    const result = service.computeStatus(pages);
    expect(result.status).toBe(StoryIllustrationStatus.FAILED);
  });

  it('treats null status as pending', () => {
    const pages = [makePage(null)];
    const result = service.computeStatus(pages);
    expect(result.pending).toBe(1);
    expect(result.status).toBe(StoryIllustrationStatus.NOT_STARTED);
  });
});
