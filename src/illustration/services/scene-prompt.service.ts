import { Injectable, Logger } from '@nestjs/common';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';

const DEFAULT_VISUAL_STYLE =
  "Whimsical children's storybook illustration, expressive characters, detailed environment, soft cinematic lighting, colorful, polished digital illustration, warm atmosphere, child-friendly, high quality.";

const TEXT_SUPPRESSION = 'no text, no captions, no watermark, no letters';

@Injectable()
export class ScenePromptService {
  private readonly logger = new Logger(ScenePromptService.name);

  buildImagePrompt(story: Story, page: StoryPage): string {
    const parts: string[] = [];

    const subject = this.buildSubject(story, page);
    if (subject) {
      parts.push(subject);
    }

    const style = story.visualStyle || DEFAULT_VISUAL_STYLE;
    if (style) {
      parts.push(style);
    }

    parts.push(TEXT_SUPPRESSION);

    const prompt = parts.join(' ').trim();
    this.logger.debug(`Generated image prompt for page ${page.pageNumber}`);

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
}
