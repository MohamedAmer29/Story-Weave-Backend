import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { StoryType } from '../../../common/enums/story-type.enum';

export const STORY_SORT_VALUES = ['latest', 'oldest', 'updated'] as const;

export type StorySort = (typeof STORY_SORT_VALUES)[number];

export class StoryListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: STORY_SORT_VALUES,
    default: 'latest',
    description: 'Sort order for the returned stories',
  })
  @IsOptional()
  @IsIn(STORY_SORT_VALUES)
  sort: StorySort = 'latest';

  @ApiPropertyOptional({ enum: StoryType })
  @IsOptional()
  @IsEnum(StoryType)
  storyType?: StoryType;
}
