import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsBoolean,
} from 'class-validator';

export class UpdateStoryOptionDto {
  @ApiPropertyOptional({ description: 'Display name', maxLength: 120 })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Optional description', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
