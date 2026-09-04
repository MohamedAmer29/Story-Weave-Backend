import { ScenePromptService } from './scene-prompt.service';
import { GenreVisualStyleService } from './genre-visual-style.service';
import { StoryContextPromptService } from './story-context-prompt.service';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';
import { StoryLanguage } from '../../common/enums/story-language.enum';
import { StoryType } from '../../common/enums/story-type.enum';
import { StoryEra } from '../../common/enums/story-era.enum';
import { StoryCivilization } from '../../common/enums/story-civilization.enum';
import { StoryTheme } from '../../common/enums/story-theme.enum';

function makeStory(): Story {
  return Object.assign(new Story(), {
    id: 'story-id',
    title: 'The Magical Forest',
    visualStyle: null,
    storyType: StoryType.FANTASY,
    language: StoryLanguage.ENGLISH,
  });
}

function makePage(): StoryPage {
  return Object.assign(new StoryPage(), {
    id: 'page-id',
    pageNumber: 1,
    text: 'Ahmed enters a mysterious forest and discovers a glowing blue dragon.',
    sceneDescription: 'An enchanted forest at sunset',
    location: 'Enchanted Forest',
    characterDescriptions:
      'Ahmed: 10-year-old boy, curly dark hair, blue shirt',
  });
}

describe('ScenePromptService', () => {
  let service: ScenePromptService;
  let genreService: { getVisualGuidance: jest.Mock };

  beforeEach(() => {
    genreService = { getVisualGuidance: jest.fn().mockReturnValue(null) };
    service = new ScenePromptService(
      genreService,
      new StoryContextPromptService(),
    );
  });

  it('includes language-specific visual guidance for Arabic stories', () => {
    const story = makeStory();
    story.language = StoryLanguage.ARABIC;
    const prompt = service.buildImagePrompt(story, makePage());
    expect(prompt).toContain('Arabic/Middle-Eastern-inspired');
  });

  it('applies genre guidance when genre service returns a style', () => {
    genreService.getVisualGuidance.mockReturnValue(
      'magical atmosphere, enchanted landscapes',
    );
    const prompt = service.buildImagePrompt(makeStory(), makePage());
    expect(prompt).toContain('magical atmosphere, enchanted landscapes');
    expect(genreService.getVisualGuidance).toHaveBeenCalledWith(
      StoryType.FANTASY,
    );
  });

  it('adds scene continuity referencing the previous page when multiple pages exist', () => {
    const story = makeStory();
    const page2 = makePage();
    page2.id = 'page-2';
    page2.pageNumber = 2;
    page2.text = 'Then Ahmed climbed the tower.';
    const page1 = makePage();
    page1.id = 'page-1';
    page1.pageNumber = 1;
    page1.text = 'Ahmed found the glowing blue dragon in the forest.';

    const prompt = service.buildImagePrompt(story, page2, [page1, page2]);
    expect(prompt).toContain('Scene continuity');
    expect(prompt).toContain('glowing blue dragon');
  });

  it('omits continuity for a single page story', () => {
    const prompt = service.buildImagePrompt(makeStory(), makePage());
    expect(prompt).not.toContain('Scene continuity');
  });

  it('builds a cover prompt with title and description', () => {
    const story = makeStory();
    story.description = 'A tale of friendship and courage.';
    const prompt = service.buildCoverPrompt(story);
    expect(prompt).toContain('book cover');
    expect(prompt).toContain('The Magical Forest');
    expect(prompt).toContain('A tale of friendship and courage.');
  });

  it('uses originalText snippet when cover has no description', () => {
    const story = makeStory();
    story.originalText = 'Once upon a time a young hero set out on a quest.';
    const prompt = service.buildCoverPrompt(story);
    expect(prompt).toContain('Story summary');
    expect(prompt).toContain('Once upon a time');
  });

  it('enforces the 2000-character prompt limit', () => {
    const story = makeStory();
    story.visualStyle = 'x'.repeat(4000);
    const prompt = service.buildImagePrompt(story, makePage());
    expect(prompt.length).toBeLessThanOrEqual(2000);
  });

  it('enforces the 2000-char limit on cover prompts too', () => {
    const story = makeStory();
    story.description = 'y'.repeat(4000);
    const prompt = service.buildCoverPrompt(story);
    expect(prompt.length).toBeLessThanOrEqual(2000);
  });

  it('trims trailing punctuation from character descriptions', () => {
    const page = makePage();
    page.characterDescriptions = 'Ahmed: boy, brave. ';
    const prompt = service.buildImagePrompt(makeStory(), page);
    // trailing period and whitespace stripped from character descriptions
    expect(prompt).toContain('Characters: Ahmed: boy, brave');
    expect(prompt).not.toContain('brave. ');
  });

  it('builds a prompt from story and page details', () => {
    const prompt = service.buildImagePrompt(makeStory(), makePage());

    expect(prompt).toContain('The Magical Forest');
    expect(prompt).toContain('An enchanted forest at sunset');
    expect(prompt).toContain('Ahmed: 10-year-old boy');
    expect(prompt).toContain('Location: Enchanted Forest');
  });

  it('includes the default visual style', () => {
    const prompt = service.buildImagePrompt(makeStory(), makePage());
    expect(prompt).toContain("children's storybook illustration");
  });

  it('uses the story visual style if configured', () => {
    const story = makeStory();
    story.visualStyle = 'Dark fantasy concept art';
    const prompt = service.buildImagePrompt(story, makePage());
    expect(prompt).toContain('Dark fantasy concept art');
  });

  it('always suppresses text and watermarks', () => {
    const prompt = service.buildImagePrompt(makeStory(), makePage());
    expect(prompt).toContain(
      'no text, no captions, no subtitles, no speech bubbles, no logos, no watermark, no letters',
    );
  });

  it('falls back to page text when no scene description exists', () => {
    const page = makePage();
    page.sceneDescription = null as unknown as string;
    const prompt = service.buildImagePrompt(makeStory(), page);
    expect(prompt).toContain('glowing blue dragon');
  });

  describe('story context integration', () => {
    function contextStory(): Story {
      const story = makeStory();
      story.era = StoryEra.BCE;
      story.year = 1250;
      story.location = 'Thebes, Egypt';
      story.civilization = StoryCivilization.ANCIENT_EGYPTIAN;
      story.theme = StoryTheme.ADVENTURE;
      return story;
    }

    it('incorporates historical context into the page prompt', () => {
      const prompt = service.buildImagePrompt(contextStory(), makePage());
      expect(prompt).toContain('1250 BCE');
      expect(prompt).toContain('Thebes, Egypt');
      expect(prompt).toContain('Adventure');
    });

    it('incorporates historical context into the cover prompt', () => {
      const prompt = service.buildCoverPrompt(contextStory());
      expect(prompt).toContain('1250 BCE');
      expect(prompt).toContain('Ancient Egyptian visual context');
    });

    it('keeps the story text authoritative when context is present', () => {
      const prompt = service.buildImagePrompt(contextStory(), makePage());
      expect(prompt).toContain('An enchanted forest at sunset');
      expect(prompt).toContain(
        'The events, characters, environment, objects, actions and mood must come exactly from the story text',
      );
    });

    it('keeps final page prompt within 2000 chars under extreme input', () => {
      const story = contextStory();
      story.visualStyle = 'a'.repeat(4000);
      story.customCivilization = 'b'.repeat(4000);
      story.customTheme = 'c'.repeat(4000);
      const prompt = service.buildImagePrompt(story, makePage());
      expect(prompt.length).toBeLessThanOrEqual(2000);
    });

    it('keeps final cover prompt within 2000 chars under extreme input', () => {
      const story = contextStory();
      story.visualStyle = 'd'.repeat(4000);
      story.description = 'e'.repeat(4000);
      const prompt = service.buildCoverPrompt(story);
      expect(prompt.length).toBeLessThanOrEqual(2000);
    });
  });
});
