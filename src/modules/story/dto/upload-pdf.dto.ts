import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoryType } from '../../../common/enums/story-type.enum';
import { StoryLanguage } from '../../../common/enums/story-language.enum';

export class UploadPdfDto {
  @ApiProperty({
    description: 'Story type (genre) used for genre-aware illustrations',
    enum: StoryType,
    example: StoryType.FANTASY,
  })
  @IsEnum(StoryType)
  @IsNotEmpty()
  storyType: StoryType;

  @ApiPropertyOptional({
    description: 'Optional visual style for illustrations',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  visualStyle?: string;

  @ApiPropertyOptional({
    description: 'Optional story language',
    enum: StoryLanguage,
  })
  @IsOptional()
  @IsEnum(StoryLanguage)
  language?: StoryLanguage;
}
