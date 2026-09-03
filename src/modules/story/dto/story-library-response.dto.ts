import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoryStatus } from '../../../common/enums/story-status.enum';
import { SourceType } from '../../../common/enums/source-type.enum';
import { StoryVisibility } from '../../../common/enums/story-visibility.enum';
import { StoryType } from '../../../common/enums/story-type.enum';

export class StoryLibraryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: StoryVisibility })
  visibility: StoryVisibility;

  @ApiProperty({ enum: StoryStatus })
  status: StoryStatus;

  @ApiProperty({ enum: SourceType })
  sourceType: SourceType;

  @ApiPropertyOptional({ enum: StoryType, description: 'Story type (genre)' })
  storyType?: StoryType | null;

  @ApiPropertyOptional({ description: 'First successfully illustrated page' })
  coverImageUrl?: string;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  illustratedPages: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedLibraryResponseDto {
  data: StoryLibraryItemDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
