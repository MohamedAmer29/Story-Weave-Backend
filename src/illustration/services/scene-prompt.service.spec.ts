import { ScenePromptService } from './scene-prompt.service';
import { Story } from '../../database/entities/story.entity';
import { StoryPage } from '../../database/entities/story-page.entity';

function makeStory(): Story {
  return Object.assign(new Story(), {
    id: 'story-id',
    title: 'The Magical Forest',
    visualStyle: null,
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

  beforeEach(() => {
    service = new ScenePromptService();
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
    expect(prompt).toContain('no text, no captions, no watermark, no letters');
  });

  it('falls back to page text when no scene description exists', () => {
    const page = makePage();
    page.sceneDescription = null as unknown as string;
    const prompt = service.buildImagePrompt(makeStory(), page);
    expect(prompt).toContain('glowing blue dragon');
  });
});
