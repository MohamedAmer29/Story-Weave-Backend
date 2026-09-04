import { BadRequestException } from '@nestjs/common';
import { StoryContextService } from './story-context.service';
import { StoryEra } from '../../../common/enums/story-era.enum';
import { StoryCivilization } from '../../../common/enums/story-civilization.enum';
import { StoryTheme } from '../../../common/enums/story-theme.enum';

describe('StoryContextService', () => {
  let service: StoryContextService;

  beforeEach(() => {
    service = new StoryContextService();
  });

  describe('era & year', () => {
    it('accepts a valid BCE era with a positive year', () => {
      const out = service.normalize({ era: StoryEra.BCE, year: 1250 });
      expect(out.era).toBe(StoryEra.BCE);
      expect(out.year).toBe(1250);
    });

    it('accepts a valid CE era with a positive year', () => {
      const out = service.normalize({ era: StoryEra.CE, year: 120 });
      expect(out.era).toBe(StoryEra.CE);
      expect(out.year).toBe(120);
    });

    it('rejects a year of zero', () => {
      expect(() =>
        service.normalize({ era: StoryEra.BCE, year: 0 }),
      ).toThrow(BadRequestException);
    });

    it('rejects a negative year', () => {
      expect(() =>
        service.normalize({ era: StoryEra.BCE, year: -100 }),
      ).toThrow(BadRequestException);
    });

    it('rejects a non-integer year', () => {
      expect(() =>
        service.normalize({ era: StoryEra.BCE, year: 1250.5 }),
      ).toThrow(BadRequestException);
    });

    it('nulls out an empty year input', () => {
      const out = service.normalize({ era: StoryEra.BCE, year: undefined });
      expect(out.year).toBeNull();
    });

    it('rejects a year when era is UNSPECIFIED', () => {
      expect(() =>
        service.normalize({ era: StoryEra.UNSPECIFIED, year: 1250 }),
      ).toThrow(BadRequestException);
    });

    it('allows year to be null when era is UNSPECIFIED', () => {
      const out = service.normalize({ era: StoryEra.UNSPECIFIED });
      expect(out.year).toBeNull();
    });
  });

  describe('location', () => {
    it('trims location whitespace', () => {
      const out = service.normalize({ location: '  Thebes, Egypt  ' });
      expect(out.location).toBe('Thebes, Egypt');
    });

    it('normalizes an empty location to null', () => {
      const out = service.normalize({ location: '   ' });
      expect(out.location).toBeNull();
    });

    it('rejects an excessively long location', () => {
      expect(() =>
        service.normalize({ location: 'x'.repeat(201) }),
      ).toThrow(BadRequestException);
    });
  });

  describe('civilization', () => {
    it('rejects CUSTOM civilization without a custom civilization', () => {
      expect(() =>
        service.normalize({ civilization: StoryCivilization.CUSTOM }),
      ).toThrow(BadRequestException);
    });

    it('accepts CUSTOM civilization with a valid custom value', () => {
      const out = service.normalize({
        civilization: StoryCivilization.CUSTOM,
        customCivilization: ' Nubian Civilization ',
      });
      expect(out.customCivilization).toBe('Nubian Civilization');
    });

    it('ignores custom civilization when not CUSTOM', () => {
      const out = service.normalize({
        civilization: StoryCivilization.GREEK,
        customCivilization: 'ignore me',
      });
      expect(out.customCivilization).toBeNull();
    });

    it('rejects an excessively long custom civilization', () => {
      expect(() =>
        service.normalize({
          civilization: StoryCivilization.CUSTOM,
          customCivilization: 'y'.repeat(101),
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('theme', () => {
    it('rejects CUSTOM theme without a custom theme', () => {
      expect(() =>
        service.normalize({ theme: StoryTheme.CUSTOM }),
      ).toThrow(BadRequestException);
    });

    it('accepts CUSTOM theme with a valid custom value', () => {
      const out = service.normalize({
        theme: StoryTheme.CUSTOM,
        customTheme: ' Political historical drama ',
      });
      expect(out.customTheme).toBe('Political historical drama');
    });

    it('ignores custom theme when not CUSTOM', () => {
      const out = service.normalize({
        theme: StoryTheme.ADVENTURE,
        customTheme: 'ignore me',
      });
      expect(out.customTheme).toBeNull();
    });

    it('rejects an excessively long custom theme', () => {
      expect(() =>
        service.normalize({
          theme: StoryTheme.CUSTOM,
          customTheme: 'z'.repeat(101),
        }),
      ).toThrow(BadRequestException);
    });
  });

  it('defaults an empty input to UNSPECIFIED/null values', () => {
    const out = service.normalize({});
    expect(out.era).toBe(StoryEra.UNSPECIFIED);
    expect(out.civilization).toBe(StoryCivilization.UNSPECIFIED);
    expect(out.theme).toBe(StoryTheme.UNSPECIFIED);
    expect(out.year).toBeNull();
    expect(out.location).toBeNull();
    expect(out.customCivilization).toBeNull();
    expect(out.customTheme).toBeNull();
  });
});
