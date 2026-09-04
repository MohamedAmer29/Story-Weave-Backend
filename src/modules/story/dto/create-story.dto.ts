import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SourceType } from '../../../common/enums/source-type.enum';
import { StoryVisibility } from '../../../common/enums/story-visibility.enum';
import { StoryType } from '../../../common/enums/story-type.enum';
import { StoryEra } from '../../../common/enums/story-era.enum';
import { StoryCivilization } from '../../../common/enums/story-civilization.enum';
import { StoryTheme } from '../../../common/enums/story-theme.enum';

export class CreateStoryDto {
  @ApiProperty({ description: 'Story title', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Short description', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Story type (genre)',
    enum: StoryType,
    example: StoryType.FANTASY,
  })
  @IsEnum(StoryType)
  @IsNotEmpty()
  storyType: StoryType;

  @ApiProperty({ description: 'Original story text', type: String })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional({
    description: 'Source of the story',
    enum: SourceType,
  })
  @IsEnum(SourceType)
  @IsOptional()
  sourceType?: SourceType;

  @ApiPropertyOptional({
    description: 'Story visibility',
    enum: StoryVisibility,
  })
  @IsEnum(StoryVisibility)
  @IsOptional()
  visibility?: StoryVisibility;

  @ApiPropertyOptional({ description: 'Story language', maxLength: 10 })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({
    description: 'Visual style for generated illustrations',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  visualStyle?: string;

  @ApiPropertyOptional({
    description: 'Historical era of the story',
    enum: StoryEra,
    enumName: 'StoryEra',
    example: StoryEra.BCE,
  })
  @IsEnum(StoryEra)
  @IsOptional()
  era?: StoryEra;

  @ApiPropertyOptional({
    description:
      'The year of the story, interpreted together with `era` (e.g. 1250 for 1250 BCE). Positive integer only.',
    example: 1250,
    minimum: 1,
    maximum: 10000,
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  year?: number;

  @ApiPropertyOptional({
    description: 'Historical/geographical location of the story',
    example: 'Thebes, Egypt',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    description:
      'Civilization of the story. When `CUSTOM`, `customCivilization` is required. `EGYPTIAN` and `ANCIENT_EGYPTIAN` are intentionally separate.',
    enum: StoryCivilization,
    enumName: 'StoryCivilization',
    example: StoryCivilization.ANCIENT_EGYPTIAN,
  })
  @IsEnum(StoryCivilization)
  @IsOptional()
  civilization?: StoryCivilization;

  @ApiPropertyOptional({
    description:
      'Custom civilization value, required only when `civilization` is `CUSTOM`. Framed as contextual metadata, never as a system instruction.',
    example: 'Nubian Civilization',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  customCivilization?: string;

  @ApiPropertyOptional({
    description:
      'Story theme controlling illustration style. When `CUSTOM`, `customTheme` is required.',
    enum: StoryTheme,
    enumName: 'StoryTheme',
    example: StoryTheme.ADVENTURE,
  })
  @IsEnum(StoryTheme)
  @IsOptional()
  theme?: StoryTheme;

  @ApiPropertyOptional({
    description:
      'Custom theme value, required only when `theme` is `CUSTOM`. Framed as contextual metadata, never as a system instruction.',
    example: 'Political historical drama',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  customTheme?: string;
}
