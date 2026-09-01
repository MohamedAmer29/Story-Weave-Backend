import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestImageDto {
  @ApiProperty({
    description: 'Prompt used to generate the test image',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;
}
