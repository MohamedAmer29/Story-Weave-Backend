import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { CloudflareProvider } from './providers/cloudflare.provider';
import { AiUsageService } from '../../ai/ai-usage.service';
import { RedisService } from '../../config/redis.service';
import { CloudflareTranslationProvider } from './providers/cloudflare-translation.provider';
import { TRANSLATION_PROVIDER } from '../../common/interfaces/translation-provider.interface';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [AIController],
  providers: [
    AIService,
    CloudflareProvider,
    CloudflareTranslationProvider,
    AiUsageService,
    RedisService,
    {
      provide: TRANSLATION_PROVIDER,
      useExisting: CloudflareTranslationProvider,
    },
  ],
  exports: [
    AIService,
    AiUsageService,
    CloudflareProvider,
    TRANSLATION_PROVIDER,
  ],
})
export class AIModule {}
