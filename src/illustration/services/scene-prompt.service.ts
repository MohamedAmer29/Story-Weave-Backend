import { Injectable, Logger } from '@nestjs/common';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { STORY_TYPE_LABELS } from '../../common/constants/story-type.constants';
import { GenreVisualStyleService } from './genre-visual-style.service';
import { StoryContextPromptService } from './story-context-prompt.service';
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

const MAX_AI_PROMPT_LENGTH = 2000;

interface PromptSection {
  priority: number;
  content: string;
  essential: boolean;
}

@Injectable()
export class ScenePromptService {
  private readonly logger = new Logger(ScenePromptService.name);

  constructor(
    private readonly genreVisualStyleService: GenreVisualStyleService,
    private readonly storyContextPromptService: StoryContextPromptService,
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

    // Historical & visual context are optional additions layered on top of the
    // authoritative story content. They must never override the narrative.
    this.appendStoryContext(parts, story);

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
    return this.finalizePrompt(prompt);
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

    this.appendStoryContext(parts, story);

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
    return this.finalizePrompt(prompt);
  }

  /**
   * Appends the optional Story Context (historical/visual guidance) as a
   * clearly-separated, droppable block. It is framed as context and never as a
   * system-level instruction.
   */
  private appendStoryContext(parts: string[], story: Story): void {
    const context = this.storyContextPromptService.buildContext(story);
    const civilization = this.storyContextPromptService.buildCivilizationGuidance(
      story,
    );
    const theme = this.storyContextPromptService.buildThemeGuidance(story);

    const block: string[] = [];
    if (context) {
      block.push(context);
    }
    if (civilization) {
      block.push(`Civilization visual guidance: ${civilization}`);
    }
    if (theme) {
      block.push(`Theme visual guidance: ${theme}`);
    }

    if (block.length > 0) {
      parts.push(block.join('\n'));
    }
  }

  private finalizePrompt(prompt: string): string {
    return this.truncatePrompt(prompt);
  }

  private truncatePrompt(prompt: string): string {
    if (prompt.length <= MAX_AI_PROMPT_LENGTH) {
      return prompt;
    }

    this.logger.warn(
      `Prompt length ${prompt.length} exceeds ${MAX_AI_PROMPT_LENGTH}, attempting intelligent compaction`,
    );

    // Try intelligent compaction first
    const compacted = this.compactPrompt(prompt);
    if (compacted.length <= MAX_AI_PROMPT_LENGTH) {
      this.logger.log(
        `Prompt compacted from ${prompt.length} to ${compacted.length} characters`,
      );
      return compacted;
    }

    // If compaction still exceeds limit, use safe truncation at word boundary
    this.logger.error(
      `Compacted prompt still exceeds limit (${compacted.length}), truncating at word boundary`,
    );
    return this.truncateAtWordBoundary(compacted, MAX_AI_PROMPT_LENGTH);
  }

  private compactPrompt(prompt: string): string {
    const sections: PromptSection[] = [];
    const lines = prompt.split('\n').filter((line) => line.trim());

    // Classify each section by priority
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      let priority = 5; // Default priority
      let essential = false;

      // Priority 1: Core scene/events (highest priority)
      if (
        lowerLine.includes('story section:') ||
        lowerLine.includes('scene:') ||
        lowerLine.includes('events:') ||
        lowerLine.includes('title:')
      ) {
        priority = 1;
        essential = true;
      }
      // Priority 2: Characters
      else if (
        lowerLine.includes('characters:') ||
        lowerLine.includes('character:')
      ) {
        priority = 2;
        essential = true;
      }
      // Priority 3: Setting/Location
      else if (
        lowerLine.includes('location:') ||
        lowerLine.includes('setting:')
      ) {
        priority = 3;
        essential = true;
      }
      // Priority 4: Genre/Story type
      else if (
        lowerLine.includes('genre') ||
        lowerLine.includes('story type') ||
        lowerLine.includes('illustration for a')
      ) {
        priority = 4;
      }
      // Priority 5: Language theme
      else if (
        lowerLine.includes('language guidance') ||
        lowerLine.includes('language theme')
      ) {
        priority = 5;
      }
      // Priority 6: Visual style guidance
      else if (
        lowerLine.includes('visual style') ||
        lowerLine.includes('style direction')
      ) {
        priority = 6;
      }
      // Priority 7: Continuity
      else if (
        lowerLine.includes('continuity') ||
        lowerLine.includes('previous section')
      ) {
        priority = 7;
      }
      // Priority 8: Generic instructions (lowest priority)
      else if (
        lowerLine.includes('maintain') ||
        lowerLine.includes('do not include') ||
        lowerLine.includes('no text') ||
        lowerLine.includes('no captions')
      ) {
        priority = 8;
      }

      sections.push({ priority, content: line, essential });
    }

    // Sort by priority (lower number = higher priority)
    sections.sort((a, b) => a.priority - b.priority);

    // Build compacted prompt, starting with highest priority
    const compacted: string[] = [];
    let currentLength = 0;

    for (const section of sections) {
      const sectionWithNewline =
        compacted.length > 0 ? `\n${section.content}` : section.content;
      const newLength = currentLength + sectionWithNewline.length;

      if (newLength <= MAX_AI_PROMPT_LENGTH) {
        compacted.push(section.content);
        currentLength = newLength;
      } else if (section.essential) {
        // For essential sections, try to fit by removing less essential ones
        // Remove lowest priority non-essential sections first
        for (let i = compacted.length - 1; i >= 0; i--) {
          const removedSection = sections.find(
            (s) => s.content === compacted[i],
          );
          if (
            removedSection &&
            !removedSection.essential &&
            removedSection.priority > section.priority
          ) {
            const removedLength = compacted[i].length + (i > 0 ? 1 : 0);
            currentLength -= removedLength;
            compacted.splice(i, 1);

            if (
              currentLength + sectionWithNewline.length <=
              MAX_AI_PROMPT_LENGTH
            ) {
              compacted.push(section.content);
              currentLength += sectionWithNewline.length;
              break;
            }
          }
        }
      }
      // If still doesn't fit and not essential, skip it
    }

    return compacted.join('\n').trim();
  }

  private truncateAtWordBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    const truncated = text.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    const lastNewlineIndex = truncated.lastIndexOf('\n');
    const lastBoundary = Math.max(lastSpaceIndex, lastNewlineIndex);

    if (lastBoundary > maxLength * 0.8) {
      return truncated.substring(0, lastBoundary).trim();
    }

    return truncated.trim();
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
