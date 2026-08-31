import { Injectable, Logger } from '@nestjs/common';

export interface StorySection {
  order: number;
  text: string;
}

export interface ParsedStory {
  title: string;
  language: string;
  sections: StorySection[];
}

@Injectable()
export class StoryParserService {
  private readonly logger = new Logger(StoryParserService.name);

  parse(rawText: string, title?: string): ParsedStory {
    this.logger.log('Starting story parsing');

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Story text cannot be empty');
    }

    const sections = this.splitIntoSections(rawText);
    const detectedLanguage = this.detectLanguage(rawText);

    this.logger.log(`Story parsed into ${sections.length} sections`);

    return {
      title: title || this.extractTitle(rawText),
      language: detectedLanguage,
      sections,
    };
  }

  private splitIntoSections(text: string): StorySection[] {
    const paragraphs = text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length === 0) {
      return [{ order: 1, text: text.trim() }];
    }

    return paragraphs.map((text, index) => ({
      order: index + 1,
      text,
    }));
  }

  private extractTitle(text: string): string {
    const firstLine = text.split('\n')[0].trim();
    if (firstLine.length > 0 && firstLine.length < 200) {
      return firstLine;
    }
    return 'Untitled Story';
  }

  private detectLanguage(text: string): string {
    const sample = text.substring(0, 1000);
    const latinChars = (sample.match(/[a-zA-Z]/g) || []).length;
    const totalChars = sample.replace(/\s/g, '').length;

    if (totalChars === 0) return 'en';

    const latinRatio = latinChars / totalChars;

    if (latinRatio > 0.7) return 'en';
    if (latinRatio > 0.3) return 'mixed';
    return 'unknown';
  }
}
