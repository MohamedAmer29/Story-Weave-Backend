import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoryOptionDto {
  @ApiProperty({ description: 'Display name', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ description: 'Optional description', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Legacy enum value this option replaces',
    maxLength: 120,
  })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  legacyValue?: string;
}
