import { Injectable, Logger } from '@nestjs/common';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { STORY_TYPE_LABELS } from '../../common/constants/story-type.constants';
import { GenreVisualStyleService } from './genre-visual-style.service';
import { StoryLanguage } from '../../common/enums/story-language.enum';

const LANGUAGE_THEMES: Record<string, { visualGuidance: string }> = {
  ARABIC: {
    visualGuidance:
      'Arabic/Middle-Eastern-inspired visual atmosphere and culturally appropriate regional details where relevant.',
  },
  ENGLISH: {
    visualGuidance:
      'Use a visual atmosphere appropriate to the story setting and genre.',
  },
};

const DEFAULT_VISUAL_STYLE =
  "Whimsical children's storybook illustration, expressive characters, detailed environment, soft cinematic lighting, colorful, polished digital illustration, warm atmosphere, child-friendly, high quality.";

const TEXT_SUPPRESSION =
  'no text, no captions, no subtitles, no speech bubbles, no logos, no watermark, no letters';

const CONTINUITY_SNIPPET_LENGTH = 300;

@Injectable()
export class ScenePromptService {
  private readonly logger = new Logger(ScenePromptService.name);

  constructor(
    private readonly genreVisualStyleService: GenreVisualStyleService,
  ) {}

  buildImagePrompt(
    story: Story,
    page: StoryPage,
    allPages?: StoryPage[],
  ): string {
    const parts: string[] = [];

    const storyTypeLabel = story.storyType
      ? STORY_TYPE_LABELS[story.storyType]
      : null;
    // Language theme guidance
    const lang = story.language as any as StoryLanguage | undefined;
    const langTheme = lang ? LANGUAGE_THEMES[lang] : undefined;
    if (langTheme) {
      parts.push(`Language guidance: ${langTheme.visualGuidance}`);
    }
    parts.push(
      `Generate an illustration for a ${storyTypeLabel ?? 'story'} story.`,
    );

    const subject = this.buildSubject(story, page);
    if (subject) {
      parts.push(`Story section:\n${subject}`);
    }

    // Genre controls visual treatment; story content stays authoritative.
    const genreGuidance = this.genreVisualStyleService.getVisualGuidance(
      story.storyType,
    );
    if (genreGuidance) {
      parts.push(
        `The visual style should clearly reflect the ${storyTypeLabel} genre:\n${genreGuidance}.\nUse a coherent illustrated-${storyTypeLabel?.toLowerCase()} aesthetic.`,
      );
    }

    if (story.visualStyle && story.visualStyle.trim().length > 0) {
      parts.push(`Additional style direction: ${story.visualStyle.trim()}.`);
    } else if (!genreGuidance) {
      parts.push(`Visual style: ${DEFAULT_VISUAL_STYLE}`);
    }

    const continuity = this.buildContinuity(page, allPages);
    if (continuity) {
      parts.push(`Scene continuity:\n${continuity}`);
    }

    parts.push(
      'Maintain character appearance and important visual details from previous sections when available.',
      'The genre only guides the visual treatment. The events, characters, environment, objects, actions and mood must come exactly from the story text. Do not introduce major events or characters that are not present in the story.',
      `Do not include ${TEXT_SUPPRESSION} inside the image.`,
    );

    const prompt = parts.join('\n\n').trim();
    this.logger.debug(`Generated image prompt for page ${page.pageNumber}`);
    return prompt;
  }

  buildCoverPrompt(story: Story): string {
    const parts: string[] = [];
    // Language theme guidance
    const lang = story.language as any as StoryLanguage | undefined;
    const langTheme = lang ? LANGUAGE_THEMES[lang] : undefined;
    if (langTheme) {
      parts.push(`Language guidance: ${langTheme.visualGuidance}`);
    }

    const storyTypeLabel = story.storyType
      ? STORY_TYPE_LABELS[story.storyType]
      : 'story';

    parts.push(
      `Create a cinematic book cover illustration for a ${storyTypeLabel} story.`,
    );

    if (story.title && story.title !== 'Untitled Story') {
      parts.push(`Title: ${story.title}`);
    }

    if (story.description) {
      parts.push(`Description: ${story.description}`);
    } else if (story.originalText) {
      const snippet = story.originalText
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 800);
      parts.push(`Story summary: ${snippet}...`);
    }

    const genreGuidance = this.genreVisualStyleService.getVisualGuidance(
      story.storyType,
    );
    if (genreGuidance) {
      parts.push(`Visual style guidance: ${genreGuidance}`);
    }

    if (story.visualStyle) {
      parts.push(`Additional style direction: ${story.visualStyle}`);
    } else {
      parts.push(
        `Visual style: cinematic, high-detail, professional book cover.`,
      );
    }

    parts.push(
      'Do not include text or typography in the image. Focus on a strong focal point, dramatic lighting, and a clear visual hierarchy. No logos or watermarks.',
    );

    const prompt = parts.join('\n\n').trim();
    this.logger.debug('Generated cover prompt');
    return prompt;
  }

  private buildSubject(story: Story, page: StoryPage): string {
    const elements: string[] = [];

    if (story.title && story.title !== 'Untitled Story') {
      elements.push(`Story titled "${story.title}"`);
    }

    const sceneText = page.sceneDescription || page.text;
    if (sceneText) {
      elements.push(sceneText.trim());
    }

    if (page.characterDescriptions) {
      elements.push(
        `Characters: ${page.characterDescriptions.trim().replace(/[.\s]+$/g, '')}`,
      );
    }

    if (page.location) {
      elements.push(`Location: ${page.location.trim()}`);
    }

    return elements.join(' ');
  }

  private buildContinuity(
    page: StoryPage,
    allPages?: StoryPage[],
  ): string | null {
    if (!allPages || allPages.length <= 1) {
      return null;
    }

    const previous = allPages
      .filter((p) => p.id !== page.id && p.pageNumber < page.pageNumber)
      .sort((a, b) => b.pageNumber - a.pageNumber)[0];

    if (!previous || !previous.text) {
      return null;
    }

    const snippet = previous.text.trim().slice(0, CONTINUITY_SNIPPET_LENGTH);
    return `Preserve the visual details from the previous section. Previous section content: "${snippet}...".`;
  }
}
