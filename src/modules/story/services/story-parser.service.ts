import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { StoryLanguage } from '../../../common/enums/story-language.enum';

export interface StorySection {
  order: number;
  text: string;
}

export interface ParsedStory {
  title: string;
  language: StoryLanguage | null;
  sections: StorySection[];
}

@Injectable()
export class StoryParserService {
  private readonly logger = new Logger(StoryParserService.name);
  parse(rawText: string, title?: string): ParsedStory {
    this.logger.log('Starting story parsing');

    if (!rawText || rawText.trim().length === 0) {
      throw new BadRequestException('Story text cannot be empty');
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

  // Public helper for segmentation used by other services and tests.
  // Implements character-based segmentation with a 1000-character target
  // and a <=50-character remainder rule.
  splitIntoSections(text: string): StorySection[] {
    const MAX_CHARS = 1000;
    const MAX_REMAINING_CHARS = 50;

    if (!text || text.trim().length === 0) {
      return [{ order: 1, text: '' }];
    }

    // Normalize paragraphs: split by blank lines, normalize internal whitespace
    const paragraphs = text
      .replace(/\r\n/g, '\n')
      .split(/\n\s*\n+/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 0);

    // Reconstruct normalized story with paragraph markers
    let remaining = paragraphs.join('\n\n').trim();

    const sections: StorySection[] = [];

    const normalizeForLength = (s: string) => s.replace(/\s+/g, ' ').trim();
    const remainingLength = (s: string) => normalizeForLength(s).length;

    // Helper to find best split index within a candidate substring
    const findBestSplit = (candidate: string): number => {
      // Prefer sentence boundary (., ?, !) followed by space
      const sentenceRegex = /[\.\?!]["')\]]*\s+/g;
      let match: RegExpExecArray | null;
      let lastPos = -1;
      while ((match = sentenceRegex.exec(candidate)) !== null) {
        lastPos = match.index + match[0].length;
      }
      if (lastPos > 0) return lastPos;

      // Fallback: last whitespace
      const lastSpace = candidate.lastIndexOf(' ');
      if (lastSpace > 0) return lastSpace;

      // As last resort, return candidate length (unavoidable split)
      return candidate.length;
    };

    while (remaining.length > MAX_CHARS) {
      // Try to consume whole paragraphs first
      const paraParts = remaining.split('\n\n');
      let built = '';
      let i = 0;
      for (; i < paraParts.length; i++) {
        const next = (built.length === 0 ? '' : '\n\n') + paraParts[i];
        if ((built + next).length > MAX_CHARS) break;
        built = built + next;
      }

      if (built.length > 0) {
        // We consumed i paragraphs
        const section = built.trim();
        const rest = paraParts.slice(i).join('\n\n').trim();

        const remLen = remainingLength(rest);
        if (remLen <= MAX_REMAINING_CHARS) {
          // append rest to this section and finish
          sections.push({
            order: sections.length + 1,
            text: `${section} ${rest}`.trim(),
          });
          return sections;
        }

        sections.push({ order: sections.length + 1, text: section });
        remaining = rest;
        continue;
      }

      // No whole paragraph fits; split within the first paragraph
      const firstPara = paraParts[0];
      const candidate = firstPara.slice(0, MAX_CHARS);
      const splitIndex = findBestSplit(candidate);

      const sectionText = firstPara.slice(0, splitIndex).trim();
      const restPara = (
        firstPara.slice(splitIndex) +
        (paraParts.length > 1 ? '\n\n' + paraParts.slice(1).join('\n\n') : '')
      ).trim();

      const remLen = remainingLength(restPara);
      if (remLen <= MAX_REMAINING_CHARS) {
        sections.push({
          order: sections.length + 1,
          text: `${sectionText} ${restPara}`.trim(),
        });
        return sections;
      }

      sections.push({ order: sections.length + 1, text: sectionText });
      remaining = restPara;
    }

    // remaining <= MAX_CHARS
    if (remaining.length > 0) {
      const remLen = remainingLength(remaining);
      if (sections.length > 0 && remLen <= MAX_REMAINING_CHARS) {
        // append to previous
        sections[sections.length - 1].text =
          `${sections[sections.length - 1].text} ${remaining}`.trim();
      } else {
        sections.push({ order: sections.length + 1, text: remaining.trim() });
      }
    }

    return sections;
  }

  private extractTitle(text: string): string {
    const firstLine = text.split('\n')[0].trim();
    if (firstLine.length > 0 && firstLine.length < 200) {
      return firstLine;
    }
    return 'Untitled Story';
  }

  private detectLanguage(text: string): StoryLanguage | null {
    const sample = text.substring(0, 1000);

    // Quick check for Arabic Unicode block
    const arabicMatch = sample.match(/\p{Script=Arabic}/u);
    if (arabicMatch) return StoryLanguage.ARABIC;

    const latinChars = (sample.match(/[a-zA-Z]/g) || []).length;
    const totalChars = sample.replace(/\s/g, '').length;

    if (totalChars === 0) return StoryLanguage.ENGLISH;

    const latinRatio = latinChars / totalChars;

    if (latinRatio > 0.7) return StoryLanguage.ENGLISH;
    return null;
  }
}
