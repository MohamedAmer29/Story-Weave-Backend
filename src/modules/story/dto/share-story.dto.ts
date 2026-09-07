import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ShareStoryDto {
  @ApiProperty({
    description: 'Email address of the user to share the story with',
    example: 'reader@example.com',
  })
  @IsEmail({}, { message: 'Invalid recipient email' })
  email: string;
}
