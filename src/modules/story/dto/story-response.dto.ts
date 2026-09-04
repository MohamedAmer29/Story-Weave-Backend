import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoryStatus } from '../../../common/enums/story-status.enum';
import { SourceType } from '../../../common/enums/source-type.enum';
import { StoryVisibility } from '../../../common/enums/story-visibility.enum';
import { StoryType } from '../../../common/enums/story-type.enum';
import { StoryEra } from '../../../common/enums/story-era.enum';
import { StoryCivilization } from '../../../common/enums/story-civilization.enum';
import { StoryTheme } from '../../../common/enums/story-theme.enum';

export class StoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  originalText: string;

  @ApiProperty({ enum: SourceType })
  sourceType: SourceType;

  @ApiPropertyOptional({ enum: StoryType })
  storyType?: StoryType | null;

  @ApiProperty({ enum: StoryStatus })
  status: StoryStatus;

  @ApiProperty({ enum: StoryVisibility })
  visibility: StoryVisibility;

  @ApiPropertyOptional()
  language?: string;

  @ApiPropertyOptional({ enum: StoryEra })
  era?: StoryEra | null;

  @ApiPropertyOptional()
  year?: number | null;

  @ApiPropertyOptional()
  location?: string | null;

  @ApiPropertyOptional({ enum: StoryCivilization })
  civilization?: StoryCivilization | null;

  @ApiPropertyOptional()
  customCivilization?: string | null;

  @ApiPropertyOptional({ enum: StoryTheme })
  theme?: StoryTheme | null;

  @ApiPropertyOptional()
  customTheme?: string | null;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
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
