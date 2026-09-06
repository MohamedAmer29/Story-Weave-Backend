import { ApiProperty } from '@nestjs/swagger';

export class CivilizationOptionDto {
  @ApiProperty({ description: 'Stable enum value stored on the story' })
  value: string;

  @ApiProperty({ description: 'Human-readable label' })
  label: string;

  @ApiProperty({ description: 'Civilization region grouping' })
  region: string;

  @ApiProperty({
    description: 'How the value participates in the story form',
    enum: ['specific', 'other', 'custom', 'unspecified'],
  })
  kind: 'specific' | 'other' | 'custom' | 'unspecified';
}

export class CivilizationRegionDto {
  @ApiProperty({ description: 'Region id in canonical display order' })
  id: string;

  @ApiProperty({ type: [CivilizationOptionDto] })
  options: CivilizationOptionDto[];
}

export class CivilizationsMetaResponseDto {
  @ApiProperty({
    type: [CivilizationRegionDto],
    description: 'Supported civilizations grouped by region in display order',
  })
  data: CivilizationRegionDto[];
}
