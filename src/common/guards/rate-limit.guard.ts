import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../config/redis.service';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  ttl: number;
  limit: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ip =
      request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const handlerName = context.getHandler().name;
    const key = `rate:${handlerName}:${ip}`;

    const client = this.redisService.getClient();
    const pipeline = client.pipeline();
    pipeline.incr(key);
    pipeline.pexpire(key, options.ttl * 1000);
    const results = await pipeline.exec();

    const count = results?.[0]?.[1] as number;

    if (count > options.limit) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
