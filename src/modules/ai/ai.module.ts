import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { CloudflareProvider } from './providers/cloudflare.provider';
import { AiUsageService } from '../../ai/ai-usage.service';
import { AiUsageLimitExceededException } from '../../ai/ai-usage-limit-exception';
import { RedisService } from '../../config/redis.service';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [AIController],
  providers: [AIService, CloudflareProvider, AiUsageService, RedisService],
  exports: [AIService, AiUsageService],
})
export class AIModule {}