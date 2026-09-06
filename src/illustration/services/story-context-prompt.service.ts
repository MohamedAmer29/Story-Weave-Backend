import { Injectable, Logger } from '@nestjs/common';
import { Story } from '../../database/entities/story.entity';
import { StoryEra } from '../../common/enums/story-era.enum';
import { StoryTheme } from '../../common/enums/story-theme.enum';
import { getCivilization } from '../../common/constants/civilizations.constants';

const THEME_VISUAL: Partial<Record<StoryTheme, string>> = {
  [StoryTheme.FANTASY]:
    'fantastical atmosphere, magical elements when appropriate',
  [StoryTheme.HISTORICAL]:
    'authentic historical atmosphere, period-appropriate setting',
  [StoryTheme.ADVENTURE]:
    'adventurous cinematic atmosphere, exploration and dynamic composition',
  [StoryTheme.ROMANCE]: 'emotional and romantic visual atmosphere',
  [StoryTheme.MYSTERY]: 'mysterious atmosphere, suspenseful composition',
  [StoryTheme.WAR]:
    'dramatic conflict atmosphere, historically appropriate setting',
  [StoryTheme.HORROR]: 'dark, unsettling atmosphere appropriate to the story',
  [StoryTheme.COMEDY]: 'light, playful and expressive atmosphere',
  [StoryTheme.DRAMA]: 'emotional, intense dramatic atmosphere',
  [StoryTheme.MYTHOLOGY]:
    'mythological atmosphere and appropriate legendary elements',
  [StoryTheme.RELIGIOUS]:
    'respectful, reverent atmosphere appropriate to the story',
};

const MAX_CONTEXT_LENGTH = 1200;

function isMeaningful(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0;
}

function formatYear(
  era: StoryEra,
  year: number | null | undefined,
): string | null {
  if (era === StoryEra.UNSPECIFIED || era === StoryEra.MODERN) {
    return null;
  }
  if (year === null || year === undefined) {
    return era;
  }
  return `${year} ${era}`;
}

/**
 * Converts the structured Story Context into safe, optional AI visual
 * instructions. User-supplied free text (customCivilization, customTheme,
 * location) is always framed as contextual metadata, never as a system
 * instruction, to prevent prompt injection.
 */
@Injectable()
export class StoryContextPromptService {
  private readonly logger = new Logger(StoryContextPromptService.name);

  buildContext(story: Story): string {
    const lines: string[] = [];

    const yearLabel = formatYear(story.era, story.year);
    const hasEra = story.era && story.era !== StoryEra.UNSPECIFIED;

    lines.push('Historical context:');

    if (hasEra) {
      lines.push(`Era: ${yearLabel ?? 'specified historical period'}.`);
    }

    const civLabel = this.civilizationLabel(story);
    if (civLabel) {
      lines.push(`Civilization: ${civLabel}.`);
    }

    const location = story.location?.trim();
    if (isMeaningful(location)) {
      lines.push(`Location: ${location}.`);
    }

    const themeLabel = this.themeLabel(story);
    if (themeLabel) {
      lines.push(`Theme: ${themeLabel}.`);
    }

    if (lines.length === 1) {
      return '';
    }

    lines.push(
      'Reflect the specified historical period, architecture, clothing, environment, cultural setting, objects, and visual atmosphere appropriately for the context.',
    );

    return this.limitLength(lines.join('\n'));
  }

  /**
   * Visual guidance derived from the civilization, with the era/year framing
   * the interpretation (e.g. EGYPTIAN is NOT automatically Ancient Egyptian).
   */
  buildCivilizationGuidance(story: Story): string | null {
    if (!story.civilization) {
      return null;
    }
    const def = getCivilization(story.civilization);
    if (!def) {
      return null;
    }
    // Custom civilizations (generic or region-specific) have no fixed visual
    // definition, so we frame the user-supplied value as cultural context
    // rather than as a system instruction (prevents prompt injection).
    if (def.kind === 'custom') {
      const custom = story.customCivilization?.trim();
      if (!custom || custom.length === 0) {
        return null;
      }
      return `Cultural context for ${custom.slice(0, 100)}. Reflect this civilization's architecture, clothing, materials, environment, and cultural details where they do not contradict the story.`;
    }
    // 'unspecified' carries no visual identity of its own.
    if (def.kind === 'unspecified') {
      return null;
    }
    const period = formatYear(story.era, story.year);
    const periodPhrase = period ? ` for the ${period} period` : '';
    if (def.kind === 'other') {
      return `Visual setting draws broadly from the ${def.region} cultural sphere${periodPhrase}, incorporating period-appropriate architecture, clothing, materials, environment, and cultural details.`;
    }
    return `${def.label} visual context${periodPhrase}, period-appropriate architecture, clothing, materials, environment, and cultural details.`;
  }

  /**
   * Visual guidance derived from the theme. Returns null when no theme or the
   * theme is CUSTOM/UNSPECIFIED.
   */
  buildThemeGuidance(story: Story): string | null {
    if (!story.theme) {
      return null;
    }
    if (story.theme === StoryTheme.UNSPECIFIED) {
      return null;
    }
    if (story.theme === StoryTheme.CUSTOM) {
      const custom = story.customTheme?.trim();
      if (custom && custom.length > 0) {
        return `Use the theme of ${custom.slice(0, 100)} to inform the atmosphere, only where it does not contradict the story.`;
      }
      return null;
    }
    return THEME_VISUAL[story.theme] ?? null;
  }

  private civilizationLabel(story: Story): string | null {
    const def = getCivilization(story.civilization);
    if (!def) {
      return null;
    }
    if (def.kind === 'unspecified') {
      return null;
    }
    if (def.kind === 'custom') {
      const custom = story.customCivilization?.trim();
      if (custom && custom.length > 0) {
        return `Custom civilization: ${custom.slice(0, 100)}`;
      }
      return null;
    }
    return `${def.label} civilization`;
  }

  private themeLabel(story: Story): string | null {
    if (!story.theme || story.theme === StoryTheme.UNSPECIFIED) {
      return null;
    }
    if (story.theme === StoryTheme.CUSTOM) {
      const custom = story.customTheme?.trim();
      if (custom && custom.length > 0) {
        return `Custom theme: ${custom.slice(0, 100)}`;
      }
      return 'Custom theme';
    }
    return story.theme.charAt(0) + story.theme.slice(1).toLowerCase();
  }

  private limitLength(text: string): string {
    return text.length <= MAX_CONTEXT_LENGTH
      ? text
      : text.slice(0, MAX_CONTEXT_LENGTH).trim() + '\n';
  }
}
