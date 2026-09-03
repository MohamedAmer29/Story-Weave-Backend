import { StorySegmentationService } from './story-segmentation.service';

describe('StorySegmentationService', () => {
  const svc = new StorySegmentationService();

  const wordsOf = (n: number): string => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

  describe('normalizeText', () => {
    it('collapses whitespace and trims', () => {
      expect(svc.normalizeText('  hello   world \n\t done  ')).toBe(
        'hello world done',
      );
    });

    it('returns empty string for blank input', () => {
      expect(svc.normalizeText('   ')).toBe('');
    });
  });

  describe('countWords', () => {
    it('counts space-separated words', () => {
      expect(svc.countWords('one two three')).toBe(3);
    });

    it('returns 0 for empty/normalized-empty text', () => {
      expect(svc.countWords('')).toBe(0);
      expect(svc.countWords('   ')).toBe(0);
    });
  });

  describe('computeSectionWordCounts', () => {
    it('returns empty array for zero/negative words', () => {
      expect(svc.computeSectionWordCounts(0)).toEqual([]);
      expect(svc.computeSectionWordCounts(-5)).toEqual([]);
    });

    it('returns a single section for <= 250 words', () => {
      expect(svc.computeSectionWordCounts(1)).toEqual([1]);
      expect(svc.computeSectionWordCounts(250)).toEqual([250]);
    });

    it('merges remainder into the final section (never own small section)', () => {
      // 251 words -> [251] (remainder merged into single section)
      expect(svc.computeSectionWordCounts(251)).toEqual([251]);
    });

    it('splits exact multiples of 250', () => {
      expect(svc.computeSectionWordCounts(500)).toEqual([250, 250]);
    });

    it('adds the remainder to the last section', () => {
      // 500 + 30 = 530 -> [250, 280]
      const counts = svc.computeSectionWordCounts(530);
      const total = counts.reduce((a, b) => a + b, 0);
      expect(total).toBe(530);
      expect(counts.length).toBe(2);
      expect(counts[1]).toBe(280);
    });
  });

  describe('segment', () => {
    it('returns empty for blank text', () => {
      expect(svc.segment('   ')).toEqual([]);
    });

    it('produces a single section for short text and preserves words exactly', () => {
      const text = wordsOf(100);
      const sections = svc.segment(text);
      expect(sections.length).toBe(1);
      expect(sections[0].wordCount).toBe(100);
      expect(sections[0].text).toBe(text);
      expect(sections[0].order).toBe(1);
    });

    it('segments a 500-word story into 2 sections of 250 words each', () => {
      const sections = svc.segment(wordsOf(500));
      expect(sections.length).toBe(2);
      expect(sections[0].wordCount).toBe(250);
      expect(sections[1].wordCount).toBe(250);
      expect(sections[0].order).toBe(1);
      expect(sections[1].order).toBe(2);
    });

    it('is lossless: reconstruction equals the original normalized text', () => {
      const original = wordsOf(530);
      const sections = svc.segment(original);
      const reconstructed = sections
        .sort((a, b) => a.order - b.order)
        .map((s) => s.text)
        .join(' ');
      expect(reconstructed).toBe(original);
      // last section holds the merged remainder (250 + 30)
      expect(sections[sections.length - 1].wordCount).toBe(280);
    });
  });
});
