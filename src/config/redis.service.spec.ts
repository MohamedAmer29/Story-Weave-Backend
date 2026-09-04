import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

// Use `var` (not const/let) so the jest.mock factory can reference the variable
// without a temporal-dead-zone error. The factory creates a fresh mocked client
// on every `new Redis(...)` call and exposes it via `mockInstance`.
var mockInstance: Record<string, jest.Mock> | undefined;

jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => {
    const m: Record<string, jest.Mock> = {};
    for (const method of [
      'get',
      'set',
      'incrby',
      'del',
      'expire',
      'pexpire',
      'pipeline',
      'quit',
      'on',
    ]) {
      m[method] = jest.fn();
    }
    mockInstance = m;
    return m;
  }),
}));

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(() => {
    mockInstance = undefined;
  });

  const makeConfig = (values: Record<string, unknown>) => {
    return {
      get: jest.fn((key: string, def?: unknown) => values[key] ?? def),
    } as unknown as ConfigService;
  };

  describe('onModuleInit', () => {
    it('creates a client with a URL when redis.url is present', async () => {
      const config = makeConfig({ 'redis.url': 'redis://localhost:6379' });
      service = new RedisService(config);
      await service.onModuleInit();
      expect(mockInstance).toBeDefined();
    });

    it('creates a client with host/port when no URL', async () => {
      const config = makeConfig({ 'redis.host': 'myhost', 'redis.port': 6380 });
      service = new RedisService(config);
      await service.onModuleInit();
      expect(mockInstance).toBeDefined();
    });

    it('registers an error handler on the client', async () => {
      const config = makeConfig({ 'redis.host': 'h', 'redis.port': 6379 });
      service = new RedisService(config);
      await service.onModuleInit();
      expect(service.getClient().on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
    });
  });

  describe('client operations', () => {
    let client: Record<string, jest.Mock>;

    beforeEach(async () => {
      const config = makeConfig({ 'redis.host': 'h', 'redis.port': 6379 });
      service = new RedisService(config);
      await service.onModuleInit();
      client = service.getClient() as unknown as Record<string, jest.Mock>;
    });

    it('set uses EX TTL in seconds derived from ms', async () => {
      client.set.mockResolvedValue('OK');
      await service.set('k', 'v', 5000);
      expect(client.set).toHaveBeenCalledWith('k', 'v', 'EX', 5);
    });

    it('set without ttl calls set plainly', async () => {
      client.set.mockResolvedValue('v');
      await service.set('k', 'v');
      expect(client.set).toHaveBeenCalledWith('k', 'v');
    });

    it('get delegates to client', async () => {
      client.get.mockResolvedValue('hello');
      await expect(service.get('key')).resolves.toBe('hello');
    });

    it('incrby/del/expire/pexpire delegate correctly', async () => {
      client.incrby.mockResolvedValue(3);
      await expect(service.incrby('n', 3)).resolves.toBe(3);
      client.del.mockResolvedValue(1);
      await expect(service.del('k')).resolves.toBe(1);
      client.expire.mockResolvedValue(1);
      await expect(service.expire('k', 60)).resolves.toBe(1);
      client.pexpire.mockResolvedValue(1);
      await expect(service.pexpire('k', 60000)).resolves.toBe(1);
    });

    it('pipeline delegates to client pipeline', () => {
      const pipeline = { incr: jest.fn(), pexpire: jest.fn(), exec: jest.fn() };
      client.pipeline.mockReturnValue(pipeline);
      expect(service.pipeline()).toBe(pipeline);
    });

    it('disconnect calls quit', async () => {
      client.quit.mockResolvedValue('OK');
      await service.disconnect();
      expect(client.quit).toHaveBeenCalled();
    });

    it('throws when getting an uninitialized client', () => {
      const fresh = new RedisService(makeConfig({}));
      expect(() => fresh.getClient()).toThrow('Redis client not initialized');
    });
  });
});
