import { ApiProperty } from '@nestjs/swagger';

export class AppendStoryResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  storyId: string;

  @ApiProperty()
  pagesCreated: number;

  @ApiProperty()
  pagesUpdated: number;

  @ApiProperty()
  pagesRegenerationRequired: number;

  @ApiProperty()
  generationQueued: boolean;
}
