import { createHash } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { StoryLanguage } from '../../common/enums/story-language.enum';
import {
  TRANSLATION_PROVIDER,
  TranslationProvider,
} from '../../common/interfaces/translation-provider.interface';
import { RedisService } from '../../config/redis.service';

@Injectable()
export class StoryTranslationService {
  private readonly logger = new Logger(StoryTranslationService.name);
  private readonly cacheTtlSeconds = 60 * 60 * 24 * 30;

  constructor(
    @Inject(TRANSLATION_PROVIDER)
    private readonly provider: TranslationProvider,
    private readonly redisService: RedisService,
  ) {}

  async translateForVisual(
    text: string,
    language: StoryLanguage | null | undefined,
    sourceId: string,
  ): Promise<string> {
    if (language !== StoryLanguage.ARABIC || !text.trim()) {
      return text;
    }

    const hash = createHash('sha256').update(text, 'utf8').digest('hex');
    const cacheKey = `story:visual-translation:en:${sourceId}:${hash}`;

    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) return cached;
    } catch (error) {
      this.logger.warn(`Translation cache read failed: ${String(error)}`);
    }

    const translated = await this.provider.translateToEnglish(text);
    if (!translated.trim()) {
      throw new Error('Arabic visual translation returned empty content');
    }

    try {
      await this.redisService.set(
        cacheKey,
        translated,
        this.cacheTtlSeconds * 1000,
      );
    } catch (error) {
      this.logger.warn(`Translation cache write failed: ${String(error)}`);
    }

    return translated;
  }
}
