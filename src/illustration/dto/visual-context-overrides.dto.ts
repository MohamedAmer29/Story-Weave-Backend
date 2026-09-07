import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { StoryEra } from '../../common/enums/story-era.enum';
import { StoryCivilization } from '../../common/enums/story-civilization.enum';
import { StoryTheme } from '../../common/enums/story-theme.enum';
import { StoryType } from '../../common/enums/story-type.enum';

export class VisualContextOverridesDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ enum: StoryEra })
  @IsOptional()
  @IsEnum(StoryEra)
  era?: StoryEra;

  @ApiPropertyOptional({ minimum: 1, maximum: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  year?: number;

  @ApiPropertyOptional({ enum: StoryCivilization })
  @IsOptional()
  @IsEnum(StoryCivilization)
  civilization?: StoryCivilization;

  @ApiPropertyOptional({ enum: StoryTheme })
  @IsOptional()
  @IsEnum(StoryTheme)
  theme?: StoryTheme;

  @ApiPropertyOptional({ enum: StoryType })
  @IsOptional()
  @IsEnum(StoryType)
  genre?: StoryType;
}

export class RegeneratePageDto extends VisualContextOverridesDto {}

export class RegenerateCoverDto extends VisualContextOverridesDto {}
