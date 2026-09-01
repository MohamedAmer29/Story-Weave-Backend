import { StoryParserService } from './story-parser.service';

describe('StoryParserService segmentation (1000-char + <=50-char remainder rule)', () => {
  const svc = new StoryParserService();

  // Build a text of exactly `len` characters made of single-letter words separated by single spaces.
  const buildTextOfLength = (len: number) => {
    if (len <= 0) return '';
    const parts: string[] = [];
    let remaining = len;
    while (remaining > 0) {
      if (remaining === 1) {
        parts.push('a');
        remaining -= 1;
      } else if (remaining === 2) {
        parts.push('a');
        remaining -= 1;
      } else {
        parts.push('a');
        remaining -= 2; // 'a' + ' '
      }
    }
    let s = parts.join(' ');
    if (s.length > len) s = s.slice(0, len);
    while (s.length < len) s += 'a';
    return s;
  };

  const cases: { len: number; expectedPages: number }[] = [
    { len: 1000, expectedPages: 1 },
    { len: 1001, expectedPages: 1 },
    { len: 1050, expectedPages: 1 },
    { len: 1051, expectedPages: 2 },
    { len: 2000, expectedPages: 2 },
    { len: 2050, expectedPages: 2 },
    { len: 2051, expectedPages: 3 },
  ];

  cases.forEach(({ len, expectedPages }) => {
    it(`splits ${len} chars into ${expectedPages} story pages`, () => {
      const text = buildTextOfLength(len);
      const sections = svc.splitIntoSections(text);
      expect(sections.length).toBe(expectedPages);

      // Reconstruct should preserve all characters (normalized spacing)
      const reconstructed = sections
        .sort((a, b) => a.order - b.order)
        .map((p) => p.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      const normalizedOriginal = text.replace(/\s+/g, ' ').trim();
      expect(reconstructed).toBe(normalizedOriginal);
    });
  });
});
