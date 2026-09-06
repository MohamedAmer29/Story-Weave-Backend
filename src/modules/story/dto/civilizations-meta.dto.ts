import { ApiProperty } from '@nestjs/swagger';
import { StoryCivilization } from '../../../common/enums/story-civilization.enum';
import {
  CivilizationKind,
  CivilizationRegion,
} from '../../../common/constants/civilizations.constants';

export class CivilizationOptionDto {
  @ApiProperty({
    description: 'Stable enum value stored on the story',
    enum: StoryCivilization,
  })
  value: StoryCivilization;

  @ApiProperty({ description: 'Human-readable label' })
  label: string;

  @ApiProperty({
    description: 'Civilization region grouping',
    enum: [
      'Unspecified',
      'Africa',
      'Middle East & Ancient Near East',
      'Mediterranean & Classical',
      'Europe',
      'South Asia',
      'East Asia',
      'Southeast Asia',
      'Central Asia',
      'North America',
      'Mesoamerica',
      'South America',
      'Oceania',
      'Religious-Historical',
      'Modern Regional',
      'Fantasy',
      'Other',
      'Custom',
    ],
  })
  region: CivilizationRegion;

  @ApiProperty({
    description: 'How the value participates in the story form',
    enum: ['specific', 'other', 'custom', 'unspecified'],
  })
  kind: CivilizationKind;
}

export class CivilizationRegionDto {
  @ApiProperty({
    description: 'Region id in canonical display order',
    enum: [
      'Unspecified',
      'Africa',
      'Middle East & Ancient Near East',
      'Mediterranean & Classical',
      'Europe',
      'South Asia',
      'East Asia',
      'Southeast Asia',
      'Central Asia',
      'North America',
      'Mesoamerica',
      'South America',
      'Oceania',
      'Religious-Historical',
      'Modern Regional',
      'Fantasy',
      'Other',
      'Custom',
    ],
  })
  id: CivilizationRegion;

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
