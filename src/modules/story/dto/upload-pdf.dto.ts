import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StoryType } from '../../../common/enums/story-type.enum';

export class UploadPdfDto {
  @ApiProperty({
    description: 'Story type (genre) used for genre-aware illustrations',
    enum: StoryType,
    example: StoryType.FANTASY,
  })
  @IsEnum(StoryType)
  @IsNotEmpty()
  storyType: StoryType;
}