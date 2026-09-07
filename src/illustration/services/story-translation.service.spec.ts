import { StoryLanguage } from '../../common/enums/story-language.enum';
import { StoryTranslationService } from './story-translation.service';

describe('StoryTranslationService', () => {
  it('does not translate English content', async () => {
    const provider = { translateToEnglish: jest.fn() };
    const redis = { get: jest.fn(), set: jest.fn() };
    const service = new StoryTranslationService(provider, redis as never);

    await expect(
      service.translateForVisual(
        'An English scene.',
        StoryLanguage.ENGLISH,
        'page-1',
      ),
    ).resolves.toBe('An English scene.');
    expect(provider.translateToEnglish).not.toHaveBeenCalled();
  });

  it('translates Arabic content and caches by source and content hash', async () => {
    const provider = {
      translateToEnglish: jest
        .fn()
        .mockResolvedValue('Ahmed enters the alley.'),
    };
    const redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    const service = new StoryTranslationService(provider, redis as never);

    await expect(
      service.translateForVisual(
        'أحمد يدخل الزقاق.',
        StoryLanguage.ARABIC,
        'page-1',
      ),
    ).resolves.toBe('Ahmed enters the alley.');

    expect(provider.translateToEnglish).toHaveBeenCalledWith(
      'أحمد يدخل الزقاق.',
    );
    expect(redis.get).toHaveBeenCalledWith(
      expect.stringMatching(/^story:visual-translation:en:page-1:/),
    );
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^story:visual-translation:en:page-1:/),
      'Ahmed enters the alley.',
      30 * 24 * 60 * 60 * 1000,
    );
  });

  it('uses a cached translation without calling the provider', async () => {
    const provider = { translateToEnglish: jest.fn() };
    const redis = {
      get: jest.fn().mockResolvedValue('Cached English scene.'),
      set: jest.fn(),
    };
    const service = new StoryTranslationService(provider, redis as never);

    await expect(
      service.translateForVisual('مشهد عربي.', StoryLanguage.ARABIC, 'page-1'),
    ).resolves.toBe('Cached English scene.');
    expect(provider.translateToEnglish).not.toHaveBeenCalled();
  });

  it('does not return raw Arabic when translation fails', async () => {
    const provider = {
      translateToEnglish: jest
        .fn()
        .mockRejectedValue(new Error('provider down')),
    };
    const redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    const service = new StoryTranslationService(provider, redis as never);

    await expect(
      service.translateForVisual('مشهد عربي.', StoryLanguage.ARABIC, 'page-1'),
    ).rejects.toThrow('provider down');
  });
});
