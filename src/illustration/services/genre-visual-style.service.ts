import { Injectable } from '@nestjs/common';
import { StoryType } from '../../common/enums/story-type.enum';

export const GENRE_VISUAL_STYLE: Record<StoryType, string> = {
  [StoryType.FANTASY]:
    'magical atmosphere, fantastical environments, enchanted landscapes, mythical elements, cinematic fantasy lighting',
  [StoryType.ADVENTURE]:
    'dynamic motion, expansive landscapes, adventurous atmosphere, dramatic natural lighting, a sense of journey and exploration',
  [StoryType.SCI_FI]:
    'futuristic environments, advanced technology, spaceships, futuristic architecture, science-fiction atmosphere',
  [StoryType.MYSTERY]:
    'moody atmosphere, dramatic shadows, enigmatic details, suspenseful lighting, mysterious tone',
  [StoryType.HORROR]:
    'dark atmosphere, ominous environments, suspense, dramatic shadows, unsettling atmosphere',
  [StoryType.ROMANCE]:
    'warm atmosphere, soft lighting, emotional moments, intimate scenes, romantic color palette',
  [StoryType.COMEDY]:
    'vibrant colors, playful expressions, lively composition, light-hearted atmosphere, exaggerated expressive features',
  [StoryType.DRAMA]:
    'emotional expressions, strong composition, dramatic lighting, intense atmosphere, character focus',
  [StoryType.HISTORICAL]:
    'period-appropriate clothing, historically appropriate architecture, period-appropriate objects, historically consistent environments',
  [StoryType.FAIRY_TALE]:
    'storybook aesthetic, whimsical environments, magical kingdoms, enchanted atmosphere, fairytale visual language',
  [StoryType.CHILDREN]:
    'bright colors, friendly characters, whimsical storybook style, soft shapes, cheerful atmosphere, child-friendly',
  [StoryType.ACTION]:
    'high-energy composition, dynamic poses, bold colors, dramatic action, epic scale',
  [StoryType.THRILLER]:
    'tense atmosphere, sharp shadows, high-contrast lighting, suspenseful framing, gripping mood',
};

@Injectable()
export class GenreVisualStyleService {
  getVisualGuidance(storyType: StoryType | null | undefined): string | null {
    if (!storyType) {
      return null;
    }
    return GENRE_VISUAL_STYLE[storyType] ?? null;
  }
}
