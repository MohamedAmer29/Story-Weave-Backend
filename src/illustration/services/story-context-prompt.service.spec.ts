import { StoryContextPromptService } from './story-context-prompt.service';
import { Story } from '../../database/entities/story.entity';
import { StoryLanguage } from '../../common/enums/story-language.enum';
import { StoryEra } from '../../common/enums/story-era.enum';
import { StoryCivilization } from '../../common/enums/story-civilization.enum';
import { StoryTheme } from '../../common/enums/story-theme.enum';

function makeStory(overrides: Partial<Story> = {}): Story {
  return Object.assign(new Story(), {
    id: 's-1',
    title: 'Story',
    era: StoryEra.UNSPECIFIED,
    year: null,
    location: null,
    civilization: StoryCivilization.UNSPECIFIED,
    customCivilization: null,
    theme: StoryTheme.UNSPECIFIED,
    customTheme: null,
    language: StoryLanguage.ENGLISH,
    ...overrides,
  });
}

describe('StoryContextPromptService', () => {
  let service: StoryContextPromptService;

  beforeEach(() => {
    service = new StoryContextPromptService();
  });

  describe('era & year', () => {
    it('formats a BCE context with year', () => {
      const context = service.buildContext(
        makeStory({ era: StoryEra.BCE, year: 1250 }),
      );
      expect(context).toContain('Era: 1250 BCE.');
    });

    it('formats a CE context with year', () => {
      const context = service.buildContext(
        makeStory({ era: StoryEra.CE, year: 120 }),
      );
      expect(context).toContain('Era: 120 CE.');
    });

    it('includes era without year when year is absent', () => {
      const context = service.buildContext(makeStory({ era: StoryEra.BCE }));
      expect(context).toContain('Era: BCE.');
    });

    it('returns empty for UNSPECIFIED era without other context', () => {
      const context = service.buildContext(makeStory());
      expect(context).toBe('');
    });
  });

  describe('location', () => {
    it('includes the location', () => {
      const context = service.buildContext(
        makeStory({ location: 'Thebes, Egypt' }),
      );
      expect(context).toContain('Location: Thebes, Egypt.');
    });

    it('contains the reflection instruction', () => {
      const context = service.buildContext(
        makeStory({ location: 'Thebes, Egypt' }),
      );
      expect(context).toContain('architecture, clothing, environment');
    });
  });

  describe('civilization visual guidance', () => {
    it('produces Ancient Egyptian guidance', () => {
      const g = service.buildCivilizationGuidance(
        makeStory({ civilization: StoryCivilization.ANCIENT_EGYPTIAN }),
      );
      expect(g).toContain('Ancient Egyptian visual context');
      expect(g).toContain('architecture');
    });

    it('produces Greek guidance', () => {
      const g = service.buildCivilizationGuidance(
        makeStory({ civilization: StoryCivilization.GREEK }),
      );
      expect(g).toContain('Ancient Greek visual context');
    });

    it('produces Roman guidance', () => {
      const g = service.buildCivilizationGuidance(
        makeStory({ civilization: StoryCivilization.ROMAN }),
      );
      expect(g).toContain('Ancient Roman visual context');
    });

    it('produces Arabic guidance referencing era', () => {
      const g = service.buildCivilizationGuidance(
        makeStory({
          civilization: StoryCivilization.ARABIC,
          era: StoryEra.BCE,
          year: 700,
        }),
      );
      expect(g).toContain('Arabic historical/cultural visual context');
      expect(g).toContain('700 BCE');
    });

    it('keeps Egyptian distinct from Ancient Egyptian', () => {
      const egyptian = service.buildCivilizationGuidance(
        makeStory({ civilization: StoryCivilization.EGYPTIAN }),
      );
      const ancient = service.buildCivilizationGuidance(
        makeStory({ civilization: StoryCivilization.ANCIENT_EGYPTIAN }),
      );
      expect(egyptian).not.toEqual(ancient);
      expect(egyptian).toContain('appropriate to');
    });

    it('references custom civilization value as metadata', () => {
      const g = service.buildCivilizationGuidance(
        makeStory({
          civilization: StoryCivilization.CUSTOM,
          customCivilization: 'Nubian Civilization',
        }),
      );
      expect(g).toContain('Nubian Civilization');
      expect(g).toContain('Culture');
    });

    it('returns null for unspecified civilization', () => {
      expect(
        service.buildCivilizationGuidance(makeStory()),
      ).toBeNull();
    });
  });

  describe('theme visual guidance', () => {
    it('maps FANTASY theme guidance', () => {
      const g = service.buildThemeGuidance(
        makeStory({ theme: StoryTheme.FANTASY }),
      );
      expect(g).toContain('magical');
    });

    it('maps WAR theme guidance', () => {
      const g = service.buildThemeGuidance(
        makeStory({ theme: StoryTheme.WAR }),
      );
      expect(g).toContain('conflict');
    });

    it('maps MYSTERY theme guidance', () => {
      const g = service.buildThemeGuidance(
        makeStory({ theme: StoryTheme.MYSTERY }),
      );
      expect(g).toContain('suspenseful');
    });

    it('uses custom theme as metadata', () => {
      const g = service.buildThemeGuidance(
        makeStory({
          theme: StoryTheme.CUSTOM,
          customTheme: 'Political historical drama',
        }),
      );
      expect(g).toContain('Political historical drama');
    });

    it('returns null for unspecified theme', () => {
      expect(service.buildThemeGuidance(makeStory())).toBeNull();
    });
  });

  describe('language safety', () => {
    it('preserves Arabic story context without corrupting text', () => {
      const story = makeStory({
        language: StoryLanguage.ARABIC,
        civilization: StoryCivilization.ARABIC,
        era: StoryEra.BCE,
        year: 700,
        location: 'بغداد',
      });
      const context = service.buildContext(story);
      expect(context).toContain('بغداد');
    });
  });

  describe('full context', () => {
    it('builds context with all fields populated', () => {
      const story = makeStory({
        era: StoryEra.BCE,
        year: 1250,
        location: 'Thebes, Egypt',
        civilization: StoryCivilization.ANCIENT_EGYPTIAN,
        theme: StoryTheme.ADVENTURE,
      });
      const context = service.buildContext(story);
      expect(context).toContain('1250 BCE');
      expect(context).toContain('Ancient Egyptian civilization');
      expect(context).toContain('Thebes, Egypt');
      expect(context).toContain('Adventure');
    });
  });

  describe('prompt length', () => {
    it('never produces context longer than the cap under extreme input', () => {
      const story = makeStory({
        location: 'x'.repeat(5000),
        civilization: StoryCivilization.CUSTOM,
        customCivilization: 'y'.repeat(5000),
        theme: StoryTheme.CUSTOM,
        customTheme: 'z'.repeat(5000),
      });
      const context = service.buildContext(story);
      expect(context.length).toBeLessThanOrEqual(1400);
    });
  });
});
