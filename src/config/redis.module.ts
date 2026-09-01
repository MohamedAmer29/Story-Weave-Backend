import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { PublicCacheService } from '../common/services/public-cache.service';

@Global()
@Module({
  providers: [RedisService, PublicCacheService],
  exports: [RedisService, PublicCacheService],
})
export class RedisModule {}
