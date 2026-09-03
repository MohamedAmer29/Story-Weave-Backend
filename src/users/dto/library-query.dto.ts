import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { StoryStatus } from '../../common/enums/story-status.enum';
import { StoryVisibility } from '../../common/enums/story-visibility.enum';
import { SourceType } from '../../common/enums/source-type.enum';
import { StoryListQueryDto } from '../../modules/story/dto/story-list-query.dto';

export class LibraryQueryDto extends StoryListQueryDto {
  @ApiPropertyOptional({
    enum: StoryStatus,
    description: 'Filter by story status',
  })
  @IsOptional()
  @IsEnum(StoryStatus)
  status?: StoryStatus;

  @ApiPropertyOptional({
    enum: StoryVisibility,
    description: 'Filter by visibility',
  })
  @IsOptional()
  @IsEnum(StoryVisibility)
  visibility?: StoryVisibility;

  @ApiPropertyOptional({
    enum: SourceType,
    description: 'Filter by source type',
  })
  @IsOptional()
  @IsEnum(SourceType)
  sourceType?: SourceType;
}
