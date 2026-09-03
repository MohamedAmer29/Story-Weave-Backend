import { GenreVisualStyleService } from './genre-visual-style.service';
import { StoryType } from '../../common/enums/story-type.enum';

describe('GenreVisualStyleService', () => {
  const svc = new GenreVisualStyleService();

  it('returns null for undefined story type', () => {
    expect(svc.getVisualGuidance(undefined)).toBeNull();
    expect(svc.getVisualGuidance(null)).toBeNull();
  });

  it('returns a style string for a known story type', () => {
    const style = svc.getVisualGuidance(StoryType.FANTASY);
    expect(style).toContain('magical');
  });

  it('returns null for an unknown story type not in the map', () => {
    expect(svc.getVisualGuidance('UNKNOWN' as StoryType)).toBeNull();
  });

  it('returns distinct guidance per known genre', () => {
    const fantasy = svc.getVisualGuidance(StoryType.FANTASY);
    const scifi = svc.getVisualGuidance(StoryType.SCI_FI);
    expect(fantasy).not.toBe(scifi);
  });
});
