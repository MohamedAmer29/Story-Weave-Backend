import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { StoryVisibility } from '../../../common/enums/story-visibility.enum';

export class UpdateVisibilityDto {
  @ApiProperty({ enum: StoryVisibility })
  @IsEnum(StoryVisibility)
  @IsNotEmpty()
  visibility: StoryVisibility;
}
