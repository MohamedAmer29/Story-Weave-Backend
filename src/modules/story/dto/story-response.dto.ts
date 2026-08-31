import { StoryStatus } from '../../../common/enums/story-status.enum';
import { SourceType } from '../../../common/enums/source-type.enum';
import { StoryVisibility } from '../../../common/enums/story-visibility.enum';

export class StoryResponseDto {
  id: string;
  userId: string;
  title: string;
  description?: string;
  originalText: string;
  sourceType: SourceType;
  status: StoryStatus;
  visibility: StoryVisibility;
  language?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PaginatedStoriesResponseDto {
  data: StoryResponseDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
