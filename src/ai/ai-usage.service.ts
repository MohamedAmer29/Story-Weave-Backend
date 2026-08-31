import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../config/redis.service';
import { AI_MODEL_USAGE } from './config/ai-model-usage.config';

const LUA_SCRIPT = `
local key = KEYS[1]
local estimated = tonumber(ARGV[1])
local safetyLimit = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', key) or '0')
local newUsage = current + estimated

if newUsage > safetyLimit then
    return {0, current}
else
    redis.call('INCRBY', key, estimated)
    redis.call('EXPIRE', key, 86400)
    return {1, newUsage}
end
`;

@Injectable()
export class AiUsageService {
  private static readonly logger = new Logger(AiUsageService.name);

  constructor(private readonly redis: RedisService) {}

  get currentDateKey(): string {
    const now = new Date();
    const utcDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const year = utcDate.getUTCFullYear();
    const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utcDate.getUTCDate()).padStart(2, '0');
    return `ai:usage:neurons:${year}-${month}-${day}`;
  }

  async getCurrentUsage(): Promise<number> {
    const client = this.redis.getClient();
    const key = this.currentDateKey;
    const raw = await client.get(key);
    return raw ? parseInt(raw, 10) : 0;
  }

  async canMakeRequest(
    modelKey: keyof typeof AI_MODEL_USAGE,
    estimatedNeurons?: number,
  ): Promise<{ allowed: boolean; used: number; remaining: number }> {
    const client = this.redis.getClient();
    if (!client) {
      return { allowed: false, used: 0, remaining: 0 };
    }

    const cost = estimatedNeurons ?? AI_MODEL_USAGE[modelKey]?.neuronsPerRequest ?? 100;
    const safetyLimit = this.getSafetyLimit();
    const key = this.currentDateKey;

    const result: any = await client.eval(
      LUA_SCRIPT,
      1,
      key,
      cost,
      safetyLimit,
    );

    const allowed = Array.isArray(result) ? result[0] === 1 : false;
    const usage =
      Array.isArray(result) ? (result[1] || result[0] || 0) : (result || 0);

    if (allowed) {
      AiUsageService.logger.debug(
        `[AI Usage] Reserved: ${cost}, Used: ${usage} / ${safetyLimit}, Remaining: ${safetyLimit - usage}`,
      );
    } else {
      AiUsageService.logger.warn(
        `[AI Usage] Blocked: would exceed safety limit ${safetyLimit} with reservation ${cost}. Current: ${usage}`,
      );
    }

    const remaining = Math.max(0, safetyLimit - (usage || 0));

    return {
      allowed,
      used: usage || 0,
      remaining,
    };
  }

  getSafetyLimit(): number {
    const safetyLimit = parseInt(process.env.AI_NEURON_SAFETY_LIMIT || '9500', 10);
    return safetyLimit;
  }

  async resetDailyUsage(): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      return;
    }
    const key = this.currentDateKey;
    await client.del(key);
    AiUsageService.logger.log(`[AI Usage] Daily usage reset for ${key}`);
  }

  async getUsageStatus(): Promise<{
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
    blocked: boolean;
    date: string;
  }> {
    const used = await this.getCurrentUsage();
    const limit = this.getSafetyLimit();
    const remaining = Math.max(0, limit - used);
    const percentage = limit > 0 ? Math.round((used / limit) * 100 * 100) / 100 : 0;

    return {
      used,
      limit,
      remaining,
      percentage,
      blocked: used >= limit,
      date: this.currentDateKey,
    };
  }
}