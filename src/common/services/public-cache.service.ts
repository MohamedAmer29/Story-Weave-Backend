import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../config/redis.service';

const CACHE_VERSION_KEY = 'public:cache:version';
const DEFAULT_TTL_MS = 60_000;

@Injectable()
export class PublicCacheService {
  private readonly logger = new Logger(PublicCacheService.name);

  constructor(private readonly redis: RedisService) {}

  async bust(): Promise<void> {
    try {
      await this.redis.incrby(CACHE_VERSION_KEY, 1);
    } catch (error) {
      this.logger.warn(`Failed to bust public cache: ${error.message}`);
    }
  }

  async get<T>(namespace: string, key: string): Promise<T | null> {
    try {
      const version = await this.currentVersion();
      const raw = await this.redis.get(`public:${version}:${namespace}:${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.logger.warn(`Failed to read public cache: ${error.message}`);
      return null;
    }
  }

  async set<T>(
    namespace: string,
    key: string,
    value: T,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<void> {
    try {
      const version = await this.currentVersion();
      await this.redis.set(
        `public:${version}:${namespace}:${key}`,
        JSON.stringify(value),
        ttlMs,
      );
    } catch (error) {
      this.logger.warn(`Failed to write public cache: ${error.message}`);
    }
  }

  private async currentVersion(): Promise<number> {
    const raw = await this.redis.get(CACHE_VERSION_KEY);
    return raw ? parseInt(raw, 10) : 0;
  }
}