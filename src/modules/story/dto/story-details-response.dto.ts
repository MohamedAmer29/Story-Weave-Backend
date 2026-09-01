import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoryStatus } from '../../../common/enums/story-status.enum';
import { SourceType } from '../../../common/enums/source-type.enum';
import { StoryVisibility } from '../../../common/enums/story-visibility.enum';
import { StoryType } from '../../../common/enums/story-type.enum';
import { IllustrationPageStatus } from '../../../illustration/enums/illustration-page-status.enum';

export class StoryAuthorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  avatarUrl?: string | null;
}

export class StoryDetailsPageDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  pageNumber: number;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiProperty()
  text: string;

  @ApiPropertyOptional()
  wordCount?: number | null;

  @ApiPropertyOptional()
  sceneDescription?: string | null;

  @ApiPropertyOptional()
  location?: string | null;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiPropertyOptional({ enum: IllustrationPageStatus })
  imageStatus?: IllustrationPageStatus | null;
}

export class StoryDetailsSectionDto {
  @ApiProperty()
  pageNumber: number;

  @ApiProperty()
  text: string;

  @ApiProperty()
  wordCount: number;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiPropertyOptional({ enum: IllustrationPageStatus })
  imageStatus?: IllustrationPageStatus | null;
}

export class StoryDetailsStatsDto {
  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  illustratedPages: number;

  @ApiProperty()
  failedPages: number;

  @ApiProperty()
  pendingPages: number;

  @ApiProperty()
  progress: number;
}

export class StoryDetailsResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ enum: StoryVisibility })
  visibility: StoryVisibility;

  @ApiProperty({ enum: StoryStatus })
  status: StoryStatus;

  @ApiProperty({ enum: SourceType })
  sourceType: SourceType;

  @ApiPropertyOptional({ enum: StoryType, description: 'Story type (genre)' })
  storyType?: StoryType | null;

  @ApiPropertyOptional()
  language?: string | null;

  @ApiProperty({ type: StoryAuthorDto })
  author: StoryAuthorDto;

  @ApiProperty({ type: StoryDetailsStatsDto })
  stats: StoryDetailsStatsDto;

  @ApiProperty({ type: [StoryDetailsPageDto] })
  pages: StoryDetailsPageDto[];

  @ApiPropertyOptional()
  cover?: {
    imageUrl?: string | null;
    imageStatus?: IllustrationPageStatus | null;
  };

  @ApiProperty({
    type: [StoryDetailsSectionDto],
    description:
      'Story sections in reading order, each with its text, word count and corresponding image',
  })
  sections: StoryDetailsSectionDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
