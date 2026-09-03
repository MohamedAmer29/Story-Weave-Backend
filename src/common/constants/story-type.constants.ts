import { StoryType } from '../enums/story-type.enum';

export const STORY_TYPE_LABELS: Record<StoryType, string> = {
  [StoryType.FANTASY]: 'Fantasy',
  [StoryType.ADVENTURE]: 'Adventure',
  [StoryType.SCI_FI]: 'Science Fiction',
  [StoryType.MYSTERY]: 'Mystery',
  [StoryType.HORROR]: 'Horror',
  [StoryType.ROMANCE]: 'Romance',
  [StoryType.COMEDY]: 'Comedy',
  [StoryType.DRAMA]: 'Drama',
  [StoryType.HISTORICAL]: 'Historical',
  [StoryType.FAIRY_TALE]: 'Fairy Tale',
  [StoryType.CHILDREN]: 'Children',
  [StoryType.ACTION]: 'Action',
  [StoryType.THRILLER]: 'Thriller',
};

export const STORY_TYPES: StoryType[] = Object.values(StoryType);

export interface StoryTypeOption {
  value: StoryType;
  label: string;
}

export function getStoryTypeOptions(): StoryTypeOption[] {
  return STORY_TYPES.map((value) => ({
    value,
    label: STORY_TYPE_LABELS[value],
  }));
}
