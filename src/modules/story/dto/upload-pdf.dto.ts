import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoryType } from '../../../common/enums/story-type.enum';
import { StoryLanguage } from '../../../common/enums/story-language.enum';
import { StoryEra } from '../../../common/enums/story-era.enum';
import { StoryCivilization } from '../../../common/enums/story-civilization.enum';
import { StoryTheme } from '../../../common/enums/story-theme.enum';

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

  @ApiPropertyOptional({
    description: 'Historical era of the story',
    enum: StoryEra,
    enumName: 'StoryEra',
    example: StoryEra.BCE,
  })
  @IsOptional()
  @IsEnum(StoryEra)
  era?: StoryEra;

  @ApiPropertyOptional({
    description:
      'The year of the story, interpreted together with `era` (e.g. 1250 for 1250 BCE). Positive integer only.',
    example: 1250,
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  year?: number;

  @ApiPropertyOptional({
    description: 'Historical/geographical location of the story',
    example: 'Thebes, Egypt',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({
    description:
      'Civilization of the story. When `CUSTOM`, `customCivilization` is required.',
    enum: StoryCivilization,
    enumName: 'StoryCivilization',
    example: StoryCivilization.ANCIENT_EGYPTIAN,
  })
  @IsOptional()
  @IsEnum(StoryCivilization)
  civilization?: StoryCivilization;

  @ApiPropertyOptional({
    description:
      'Custom civilization value, required only when `civilization` is `CUSTOM`. Framed as contextual metadata.',
    example: 'Nubian Civilization',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customCivilization?: string;

  @ApiPropertyOptional({
    description:
      'Story theme controlling illustration style. When `CUSTOM`, `customTheme` is required.',
    enum: StoryTheme,
    enumName: 'StoryTheme',
    example: StoryTheme.ADVENTURE,
  })
  @IsOptional()
  @IsEnum(StoryTheme)
  theme?: StoryTheme;

  @ApiPropertyOptional({
    description:
      'Custom theme value, required only when `theme` is `CUSTOM`. Framed as contextual metadata.',
    example: 'Political historical drama',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customTheme?: string;
}
