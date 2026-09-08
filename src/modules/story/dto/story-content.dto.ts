import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AppendStoryDto {
  @ApiPropertyOptional({
    description: 'Continuation text. Do not send together with a PDF file.',
    maxLength: 100000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  content?: string;
}

export class StoryContentDto {
  @ApiProperty({ maxLength: 100000 })
  @IsNotEmpty()
  @MaxLength(100000)
  content: string;
}

export class ReorderStoryPagesDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @IsUUID('4', { each: true })
  pageIds: string[];
}
