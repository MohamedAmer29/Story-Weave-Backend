import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StoryOptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  legacyValue: string | null;

  @ApiPropertyOptional()
  createdBy: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
