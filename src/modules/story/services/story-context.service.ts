import { BadRequestException, Injectable } from '@nestjs/common';
import { StoryEra } from '../../../common/enums/story-era.enum';
import { StoryCivilization } from '../../../common/enums/story-civilization.enum';
import { StoryTheme } from '../../../common/enums/story-theme.enum';

/**
 * Internal normalized representation of the Story Context, ready to be stored
 * on the Story entity. `year`/`location`/custom fields are `null` when absent.
 */
export interface NormalizedStoryContext {
  era: StoryEra;
  year: number | null;
  location: string | null;
  civilization: StoryCivilization;
  customCivilization: string | null;
  theme: StoryTheme;
  customTheme: string | null;
}

export interface StoryContextInput {
  era?: StoryEra;
  year?: number;
  location?: string;
  civilization?: StoryCivilization;
  customCivilization?: string;
  theme?: StoryTheme;
  customTheme?: string;
}

const LOCATION_MAX_LENGTH = 200;
const CUSTOM_MAX_LENGTH = 100;
const YEAR_MIN = 1;
const YEAR_MAX = 10000;

/**
 * Validates and normalizes the Story Context fields and their cross-field
 * relationships. DTO decorators handle per-field type/length rules; this
 * service enforces the domain rules that span multiple fields.
 */
@Injectable()
export class StoryContextService {
  /**
   * Normalizes partial/optional input into a complete, validated context.
   * Used when creating or updating a story.
   */
  normalize(input: StoryContextInput): NormalizedStoryContext {
    const era = input.era ?? StoryEra.UNSPECIFIED;
    const civilization =
      input.civilization ?? StoryCivilization.UNSPECIFIED;
    const theme = input.theme ?? StoryTheme.UNSPECIFIED;

    let location = this.trimOrNull(input.location);
    let customCivilization = this.trimOrNull(input.customCivilization);
    let customTheme = this.trimOrNull(input.customTheme);

    if (location !== null && location.length > LOCATION_MAX_LENGTH) {
      throw new BadRequestException(
        `location must not exceed ${LOCATION_MAX_LENGTH} characters`,
      );
    }
    if (
      customCivilization !== null &&
      customCivilization.length > CUSTOM_MAX_LENGTH
    ) {
      throw new BadRequestException(
        `customCivilization must not exceed ${CUSTOM_MAX_LENGTH} characters`,
      );
    }
    if (customTheme !== null && customTheme.length > CUSTOM_MAX_LENGTH) {
      throw new BadRequestException(
        `customTheme must not exceed ${CUSTOM_MAX_LENGTH} characters`,
      );
    }

    // Year must be a positive integer within bounds when provided.
    let year: number | null = null;
    if (input.year !== undefined && input.year !== null) {
      if (
        !Number.isInteger(input.year) ||
        input.year < YEAR_MIN ||
        input.year > YEAR_MAX
      ) {
        throw new BadRequestException(
          `year must be a positive integer between ${YEAR_MIN} and ${YEAR_MAX}`,
        );
      }
      year = input.year;
    }

    // If era is UNSPECIFIED, year should normally be null.
    if (era === StoryEra.UNSPECIFIED && year !== null) {
      throw new BadRequestException(
        'year cannot be set when era is UNSPECIFIED; set era to BCE, CE or MODERN',
      );
    }

    // CUSTOM civilization requires the custom text; otherwise it is ignored.
    if (civilization === StoryCivilization.CUSTOM) {
      if (!customCivilization) {
        throw new BadRequestException(
          'customCivilization is required when civilization is CUSTOM',
        );
      }
    } else {
      customCivilization = null;
    }

    // CUSTOM theme requires the custom text; otherwise it is ignored.
    if (theme === StoryTheme.CUSTOM) {
      if (!customTheme) {
        throw new BadRequestException(
          'customTheme is required when theme is CUSTOM',
        );
      }
    } else {
      customTheme = null;
    }

    return {
      era,
      year,
      location,
      civilization,
      customCivilization,
      theme,
      customTheme,
    };
  }

  private trimOrNull(value: string | undefined | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}
