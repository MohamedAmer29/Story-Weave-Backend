import { Injectable, Logger } from '@nestjs/common';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { STORY_TYPE_LABELS } from '../../common/constants/story-type.constants';
import { StoryTheme } from '../../common/enums/story-theme.enum';
import { StoryEra } from '../../common/enums/story-era.enum';
import { StoryCivilization } from '../../common/enums/story-civilization.enum';
import { GenreVisualStyleService } from './genre-visual-style.service';
import { StoryContextPromptService } from './story-context-prompt.service';
import { StoryType } from '../../common/enums/story-type.enum';

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

interface SceneAnalysis {
  mainSubject?: string;
  actions: string[];
  environment: string[];
  objects: string[];
  visualPhenomena: string[];
  lighting?: string;
  atmosphere?: string;
  spatialRelationships: string[];
  importantDetails: string[];
}

export interface VisualContextOverrides {
  location?: string;
  era?: StoryEra;
  year?: number;
  civilization?: StoryCivilization;
  theme?: StoryTheme;
  genre?: StoryType;
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
    overrides?: VisualContextOverrides,
    visualContent?: string,
  ): string {
    const analysis = this.analyzeScene(page, visualContent);
    const sections = this.buildImagePromptSections(
      story,
      page,
      allPages,
      analysis,
      overrides,
      visualContent,
    );
    const prompt = sections.join('\n\n').trim();
    this.logger.debug(
      `Generated image prompt for page ${page.pageNumber} scene=${analysis.mainSubject ?? 'unknown'} length=${prompt.length}`,
    );
    return this.finalizePrompt(prompt);
  }

  buildCoverPrompt(
    story: Story,
    overrides?: VisualContextOverrides,
    visualContent?: string,
  ): string {
    const storyTypeLabel = this.resolveGenre(story, overrides);
    const sections = [
      `Cover concept: Create a cinematic book cover for a ${storyTypeLabel} story.`,
      this.buildCoverSubject(story, visualContent),
      this.buildCoverContext(story, overrides),
      this.buildCoverGenre(story, overrides),
      this.buildCoverQuality(story),
      'Do not include text, typography, logos, or watermarks.',
    ].filter((value): value is string => Boolean(value && value.trim().length > 0));

    const prompt = sections.join('\n\n').trim();
    this.logger.debug(`Generated cover prompt length=${prompt.length}`);
    return this.finalizePrompt(prompt);
  }

  private buildImagePromptSections(
    story: Story,
    page: StoryPage,
    allPages: StoryPage[] | undefined,
    analysis: SceneAnalysis,
    overrides?: VisualContextOverrides,
    visualContent?: string,
  ): string[] {
    const storyTypeLabel = this.resolveGenre(story, overrides);
    const sections: string[] = [];
    sections.push(`Exact scene:\n${this.buildSceneText(story, page, analysis, visualContent)}`);
    sections.push(`Main subject:\n${analysis.mainSubject ?? 'The most important subject in the scene.'}`);
    sections.push(`Action:\n${analysis.actions.join(' ') || 'Depict the story event exactly as described.'}`);
    sections.push(`Environment:\n${analysis.environment.join(' ') || 'Use the environment described in the story.'}`);
    if (analysis.objects.length > 0) sections.push(`Objects:\n${analysis.objects.join(' ')}`);
    if (analysis.visualPhenomena.length > 0) sections.push(`Visual phenomena:\n${analysis.visualPhenomena.join(' ')}`);
    if (analysis.lighting) sections.push(`Lighting:\n${analysis.lighting}`);
    if (analysis.atmosphere) sections.push(`Atmosphere:\n${analysis.atmosphere}`);
    if (analysis.spatialRelationships.length > 0) sections.push(`Spatial relationships:\n${analysis.spatialRelationships.join(' ')}`);
    if (analysis.importantDetails.length > 0) sections.push(`Important details:\n${analysis.importantDetails.join(' ')}`);
    sections.push(
      'The events, characters, environment, objects, actions and mood must come exactly from the story text.',
    );
    sections.push(this.buildStoryContext(story, overrides));
    sections.push(this.buildGenreSection(storyTypeLabel, story, overrides));
    sections.push(this.buildThemeSection(story, overrides));
    const continuity = this.buildContinuity(page, allPages);
    if (continuity) sections.push(`Continuity:\n${continuity}`);
    sections.push(this.buildQualitySection(story));
    sections.push(`Do not include ${TEXT_SUPPRESSION} inside the image.`);
    return sections.filter((value): value is string => Boolean(value && value.trim().length > 0));
  }

  private buildSceneText(
    story: Story,
    page: StoryPage,
    analysis: SceneAnalysis,
    visualContent?: string,
  ): string {
    return [
      story.title ? `Story title: ${story.title}` : '',
      page.sceneDescription?.trim() || '',
      (visualContent ?? page.text).trim(),
      page.characterDescriptions ? `Characters: ${page.characterDescriptions.trim().replace(/[.\s]+$/g, '')}` : '',
      page.location ? `Location: ${page.location.trim()}` : '',
      analysis.mainSubject ? `Primary focus: ${analysis.mainSubject}` : '',
    ].filter(Boolean).join(' ');
  }

  private analyzeScene(page: StoryPage, visualContent?: string): SceneAnalysis {
    const text = `${page.sceneDescription ?? ''} ${visualContent ?? page.text ?? ''}`.trim();
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const firstSentence = sentences[0] ?? text;
    const characters = page.characterDescriptions?.trim();
    const objects = this.extractKeywords(text, ['key', 'sword', 'book', 'door', 'ship', 'window', 'bone', 'spire', 'viewport', 'machine', 'temple', 'crown', 'horse', 'car', 'train']);
    return {
      mainSubject: characters || firstSentence.slice(0, 220),
      actions: this.extractSentences(text, ['stands', 'looks', 'runs', 'holds', 'raises', 'falls', 'rises', 'opens', 'clutches', 'watches', 'leans', 'speaks', 'screams']),
      environment: [page.location?.trim()].filter(Boolean) as string[],
      objects,
      visualPhenomena: this.extractSentences(text, ['light', 'shadow', 'mist', 'fog', 'water', 'fire', 'storm', 'brine', 'glow']),
      lighting: this.extractPhrase(text, ['light', 'lighting', 'glow', 'dark', 'dim', 'bright', 'sunset', 'moonlight']),
      atmosphere: this.extractPhrase(text, ['eerie', 'tense', 'calm', 'warm', 'ominous', 'melancholic', 'dreamlike', 'chaotic']),
      spatialRelationships: this.extractSentences(text, ['beside', 'under', 'above', 'behind', 'in front of', 'through', 'across', 'toward']),
      importantDetails: [page.sceneDescription?.trim(), page.characterDescriptions?.trim()].filter(Boolean) as string[],
    };
  }

  private buildStoryContext(
    story: Story,
    overrides?: VisualContextOverrides,
  ): string {
    const resolved = this.resolveStory(story, overrides);
    const lines: string[] = [];
    const context = this.storyContextPromptService.buildContext(
      resolved,
    );
    const civilization = this.storyContextPromptService.buildCivilizationGuidance(
      resolved,
    );
    const theme = this.storyContextPromptService.buildThemeGuidance(
      resolved,
    );
    if (context) lines.push(context);
    if (civilization) lines.push(`Civilization visual guidance: ${civilization}`);
    if (theme) lines.push(`Theme visual guidance: ${theme}`);
    return lines.join('\n');
  }

  private buildGenreSection(
    storyTypeLabel: string,
    story: Story,
    overrides?: VisualContextOverrides,
  ): string {
    const genreGuidance = this.genreVisualStyleService.getVisualGuidance(
      overrides?.genre ?? story.storyType,
    );
    if (!genreGuidance) return `Visual treatment: ${DEFAULT_VISUAL_STYLE}`;
    return `Genre treatment for ${storyTypeLabel}:\n${genreGuidance}`;
  }

  private buildThemeSection(story: Story, overrides?: VisualContextOverrides): string {
    const effective = this.resolveStory(story, overrides);
    if (!effective.theme || effective.theme === StoryTheme.UNSPECIFIED) return '';
    const guidance = this.storyContextPromptService.buildThemeGuidance(effective);
    return guidance ? `Theme treatment:\n${guidance}` : '';
  }

  private buildQualitySection(story: Story): string {
    if (story.visualStyle && story.visualStyle.trim().length > 0) {
      return `Quality and style:\n${story.visualStyle.trim()}`;
    }
    return 'Quality and composition: highly detailed, professional cinematic illustration, physically coherent objects, realistic materials, atmospheric depth, accurate anatomy where applicable, sharp primary subject, coherent lighting, detailed environment, polished visual quality.';
  }

  private buildCoverSubject(story: Story, visualContent?: string): string {
    const snippet =
      story.description?.trim() ||
      visualContent?.replace(/\s+/g, ' ').trim().slice(0, 900) ||
      story.originalText?.replace(/\s+/g, ' ').trim().slice(0, 900) ||
      story.title;
    return `Story title: ${story.title}. Main cover concept should represent the story's central visual idea: ${snippet}`;
  }

  private buildCoverContext(story: Story, overrides?: VisualContextOverrides): string {
    return this.buildStoryContext(story, overrides);
  }

  private buildCoverGenre(story: Story, overrides?: VisualContextOverrides): string {
    const storyTypeLabel = this.resolveGenre(story, overrides);
    return this.buildGenreSection(storyTypeLabel, story, overrides);
  }

  private buildCoverQuality(story: Story): string {
    return this.buildQualitySection(story);
  }

  private extractSentences(text: string, keywords: string[]): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .filter((sentence) =>
        keywords.some((keyword) => sentence.toLowerCase().includes(keyword)),
      )
      .slice(0, 4)
      .map((sentence) => sentence.trim());
  }

  private extractPhrase(text: string, keywords: string[]): string | undefined {
    const sentence = text
      .split(/(?<=[.!?])\s+/)
      .find((part) => keywords.some((keyword) => part.toLowerCase().includes(keyword)));
    return sentence?.trim();
  }

  private extractKeywords(text: string, keywords: string[]): string[] {
    const lower = text.toLowerCase();
    return keywords.filter((keyword) => lower.includes(keyword)).slice(0, 8);
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
        lowerLine.includes('exact scene:') ||
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
        lowerLine.includes('main subject:') ||
        lowerLine.includes('characters:') ||
        lowerLine.includes('character:')
      ) {
        priority = 2;
        essential = true;
      }
      // Priority 3: Setting/Location
      else if (
        lowerLine.includes('action:') ||
        lowerLine.includes('objects:') ||
        lowerLine.includes('location:') ||
        lowerLine.includes('setting:')
      ) {
        priority = 3;
        essential = true;
      }
      // Priority 4: Genre/Story type
      else if (
        lowerLine.includes('environment:') ||
        lowerLine.includes('visual phenomena:') ||
        lowerLine.includes('lighting:') ||
        lowerLine.includes('atmosphere:') ||
        lowerLine.includes('spatial relationships:') ||
        lowerLine.includes('genre') ||
        lowerLine.includes('story type') ||
        lowerLine.includes('illustration for a')
      ) {
        priority = 4;
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

  private resolveStory(story: Story, overrides?: VisualContextOverrides): Story {
    return Object.assign(new Story(), {
      ...story,
      location: overrides?.location ?? story.location,
      era: overrides?.era ?? story.era,
      year: overrides?.year ?? story.year,
      civilization: overrides?.civilization ?? story.civilization,
      theme: overrides?.theme ?? story.theme,
      storyType: overrides?.genre ?? story.storyType,
    });
  }

  private resolveGenre(story: Story, overrides?: VisualContextOverrides): string {
    const genre = overrides?.genre ?? story.storyType;
    return genre ? STORY_TYPE_LABELS[genre] : 'story';
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
    return `Scene continuity: preserve the visual details from the previous section. Previous section content: "${snippet}...".`;
  }
}
