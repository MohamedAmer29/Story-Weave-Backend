import { IsNotEmpty, IsString } from 'class-validator';

export class TestImageDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;
}
