import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard, RATE_LIMIT_KEY } from './rate-limit.guard';
import { RedisService } from '../../config/redis.service';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: { get: jest.Mock };
  let redis: { getClient: jest.Mock };

  const makePipeline = (count: number) => {
    // pipeline.incr + pipeline.pexpire -> exec returns [[err, newCount], [err, 1]]
    const incr = jest.fn(() => pipeline);
    const pexpire = jest.fn(() => pipeline);
    const exec = jest.fn().mockResolvedValue([
      [null, count],
      [null, 1],
    ]);
    const pipeline = { incr, pexpire, exec };
    return pipeline;
  };

  const makeContext = () => {
    const handler = { name: 'someHandler' };
    const request = {
      ip: '127.0.0.1',
      headers: {},
    };
    return {
      getHandler: () => handler,
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = { get: jest.fn() };
    redis = { getClient: jest.fn() };
    guard = new RateLimitGuard(
      reflector as unknown as Reflector,
      redis as unknown as RedisService,
    );
  });

  it('allows through when no rate-limit metadata present', async () => {
    reflector.get.mockReturnValue(undefined);
    const result = await guard.canActivate(makeContext());
    expect(result).toBe(true);
    expect(redis.getClient).not.toHaveBeenCalled();
  });

  it('uses x-forwarded-for header when ip missing', async () => {
    reflector.get.mockReturnValue({ ttl: 60, limit: 5 });
    const context = makeContext() as any;
    const request = context.switchToHttp().getRequest();
    request.ip = undefined;
    request.headers['x-forwarded-for'] = '8.8.8.8';
    const pipeline = makePipeline(1);
    redis.getClient.mockReturnValue({ pipeline: () => pipeline });

    await guard.canActivate(context);
    expect(pipeline.incr).toHaveBeenCalledWith('rate:someHandler:8.8.8.8');
  });

  it('increments the counter and allows under the limit', async () => {
    reflector.get.mockReturnValue({ ttl: 60, limit: 10 });
    const pipeline = makePipeline(3);
    redis.getClient.mockReturnValue({ pipeline: () => pipeline });

    const result = await guard.canActivate(makeContext());
    expect(result).toBe(true);
    expect(pipeline.incr).toHaveBeenCalledWith('rate:someHandler:127.0.0.1');
    expect(pipeline.pexpire).toHaveBeenCalledWith('rate:someHandler:127.0.0.1', 60000);
  });

  it('throws 429 when the limit is exceeded', async () => {
    reflector.get.mockReturnValue({ ttl: 60, limit: 10 });
    const pipeline = makePipeline(11);
    redis.getClient.mockReturnValue({ pipeline: () => pipeline });

    const promise = guard.canActivate(makeContext());
    await expect(promise).rejects.toBeInstanceOf(HttpException);
    await expect(promise).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });
});
