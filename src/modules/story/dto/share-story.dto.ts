import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ShareStoryDto {
  @ApiProperty({
    description: 'UUID of the user to share the story with',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'Invalid user identifier' })
  userId: string;
}
