import { PublicCacheService } from './public-cache.service';
import { RedisService } from '../../config/redis.service';

describe('PublicCacheService', () => {
  let service: PublicCacheService;
  const store: Record<string, string> = {};
  let redis: { getClient: jest.Mock; get: jest.Mock; set: jest.Mock; incrby: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(store).forEach((k) => delete store[k]);

    const mockClient = {
      get: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
      set: jest.fn((k: string, v: string) => {
        store[k] = v;
        return Promise.resolve('OK');
      }),
      incrby: jest.fn((k: string, inc: number) => {
        const cur = parseInt(store[k] ?? '0', 10);
        store[k] = String(cur + inc);
        return Promise.resolve(cur + inc);
      }),
    };

    redis = {
      getClient: jest.fn().mockReturnValue(mockClient),
      get: mockClient.get,
      set: mockClient.set,
      incrby: mockClient.incrby,
    } as unknown as { getClient: jest.Mock; get: jest.Mock; set: jest.Mock; incrby: jest.Mock };

    service = new PublicCacheService(redis as unknown as RedisService);
  });

  describe('get/set with versioning', () => {
    it('writes and reads back a value using the current version', async () => {
      await service.set('stories', 's1', { title: 'Hello' });
      const value = await service.get<{ title: string }>('stories', 's1');
      expect(value).toEqual({ title: 'Hello' });
      // stored under version 0 key
      expect(store['public:0:stories:s1']).toBeDefined();
    });

    it('uses the default TTL when none provided', async () => {
      await service.set('stories', 's1', { a: 1 });
      expect(redis.set).toHaveBeenCalledWith(
        'public:0:stories:s1',
        expect.any(String),
        60000,
      );
    });

    it('returns null when key missing', async () => {
      await expect(service.get('x', 'y')).resolves.toBeNull();
    });
  });

  describe('bust', () => {
    it('increments the cache version so old entries become unreachable', async () => {
      await service.set('stories', 's1', { old: true });
      // version 0 populated
      expect(store['public:0:stories:s1']).toBeDefined();

      await service.bust();
      // now version is 1 -> read from version 1 returns null
      await expect(service.get('stories', 's1')).resolves.toBeNull();
      expect(store['public:cache:version']).toBe('1');
    });
  });

  describe('error resilience', () => {
    it('returns null from get when redis throws', async () => {
      redis.get.mockRejectedValueOnce(new Error('boom'));
      await expect(service.get('a', 'b')).resolves.toBeNull();
    });

    it('swallows write errors', async () => {
      redis.set.mockRejectedValueOnce(new Error('boom'));
      await expect(
        service.set('a', 'b', { x: 1 }),
      ).resolves.toBeUndefined();
    });

    it('swallows bust errors', async () => {
      redis.incrby.mockRejectedValueOnce(new Error('boom'));
      await expect(service.bust()).resolves.toBeUndefined();
    });
  });
});
