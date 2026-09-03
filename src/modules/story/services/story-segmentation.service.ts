import { Injectable } from '@nestjs/common';

export const SEGMENT_BASE_WORDS = 250;

export interface SegmentedSection {
  order: number;
  text: string;
  wordCount: number;
}

@Injectable()
export class StorySegmentationService {
  /**
   * Normalize whitespace before counting: multiple spaces, tabs and newlines
   * are collapsed into a single space. PDF extraction artifacts are collapsed.
   */
  normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  countWords(text: string): number {
    const normalized = this.normalizeText(text);
    if (!normalized) {
      return 0;
    }
    return normalized.split(' ').length;
  }

  /**
   * 250 words is the base unit for determining the number of images.
   * - totalWords <= 250: ONE image containing the entire story.
   * - totalWords % 250 === 0: every section has exactly 250 words.
   * - otherwise: 250-word sections, remainder merged into the final section.
   * The remainder is NEVER emitted as its own small section.
   */
  computeSectionWordCounts(totalWords: number): number[] {
    if (totalWords <= 0) {
      return [];
    }
    if (totalWords <= SEGMENT_BASE_WORDS) {
      return [totalWords];
    }

    const quotient = Math.floor(totalWords / SEGMENT_BASE_WORDS);
    const remainder = totalWords % SEGMENT_BASE_WORDS;

    const counts: number[] = new Array(quotient).fill(SEGMENT_BASE_WORDS);
    if (remainder > 0) {
      counts[counts.length - 1] += remainder;
    }
    return counts;
  }

  /**
   * Divide the original (normalized) story into ordered sections without
   * rewriting, summarizing, adding or removing words. The whole story can be
   * reconstructed by joining the section texts in order.
   */
  segment(text: string): SegmentedSection[] {
    const normalized = this.normalizeText(text);
    const words = normalized ? normalized.split(' ') : [];
    const counts = this.computeSectionWordCounts(words.length);

    let index = 0;
    return counts.map((count, i) => {
      const sectionWords = words.slice(index, index + count);
      index += count;
      return {
        order: i + 1,
        text: sectionWords.join(' '),
        wordCount: sectionWords.length,
      };
    });
  }
}
