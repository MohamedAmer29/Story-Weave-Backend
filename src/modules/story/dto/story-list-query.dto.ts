import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

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
}