import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestImageDto {
  @ApiProperty({
    description: 'Prompt used to generate the test image',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  prompt: string;
}
