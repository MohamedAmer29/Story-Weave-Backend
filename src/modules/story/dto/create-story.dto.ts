import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { SourceType } from '../../../common/enums/source-type.enum';
import { StoryVisibility } from '../../../common/enums/story-visibility.enum';

export class CreateStoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsEnum(SourceType)
  @IsOptional()
  sourceType?: SourceType;

  @IsEnum(StoryVisibility)
  @IsOptional()
  visibility?: StoryVisibility;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  language?: string;
}
