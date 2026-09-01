import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateIllustrationsDto {
  @ApiPropertyOptional({
    description: 'Regenerate illustrations for pages that already have one',
  })
  @IsBoolean()
  @IsOptional()
  regenerate?: boolean;
}
