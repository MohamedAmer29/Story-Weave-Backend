import { AiUsageService } from './ai-usage.service';
import { AI_MODEL_USAGE } from './config/ai-model-usage.config';
import { RedisService } from '../config/redis.service';

describe('AiUsageService', () => {
  let service: AiUsageService;
  let redis: { getClient: jest.Mock };

  const mockClient = {
    get: jest.fn(),
    eval: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    redis = {
      getClient: jest.fn().mockReturnValue(mockClient),
    };
    service = new AiUsageService(redis as unknown as RedisService);
    delete process.env.AI_NEURON_SAFETY_LIMIT;
  });

  describe('currentDateKey', () => {
    it('formats the current UTC date into the neuron key', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-05T12:00:00Z'));
      expect(service.currentDateKey).toBe('ai:usage:neurons:2026-01-05');
      jest.useRealTimers();
    });

    it('pads months and days with leading zeros', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-09T12:00:00Z'));
      const key = service.currentDateKey;
      expect(key).toMatch(/ai:usage:neurons:2026-11-09$/);
      jest.useRealTimers();
    });
  });

  describe('getCurrentUsage', () => {
    it('returns 0 when no key exists', async () => {
      mockClient.get.mockResolvedValue(null);
      await expect(service.getCurrentUsage()).resolves.toBe(0);
    });

    it('parses the stored usage value', async () => {
      mockClient.get.mockResolvedValue('4200');
      await expect(service.getCurrentUsage()).resolves.toBe(4200);
    });
  });

  describe('canMakeRequest', () => {
    const MODEL = '@cf/black-forest-labs/flux-1-schnell';

    it('denies the request when no redis client is available', async () => {
      redis.getClient.mockReturnValue(null);
      await expect(service.canMakeRequest(MODEL)).resolves.toEqual({
        allowed: false,
        used: 0,
        remaining: 0,
      });
    });

    it('allows a request under the safety limit and returns remaining', async () => {
      // Lua returns {1, newUsage}
      mockClient.eval.mockResolvedValue([1, 5000]);
      const result = await service.canMakeRequest(MODEL);
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(5000);
      expect(result.remaining).toBe(4500);
      expect(mockClient.eval).toHaveBeenCalledTimes(1);
    });

    it('blocks a request that would exceed the safety limit', async () => {
      // Lua returns {0, current}
      mockClient.eval.mockResolvedValue([0, 9500]);
      const result = await service.canMakeRequest(MODEL);
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(9500);
      expect(result.remaining).toBe(0);
    });

    it('uses default model cost when none provided', async () => {
      mockClient.eval.mockResolvedValue([1, 100]);
      await service.canMakeRequest(MODEL);
      const [, , , costArg] = mockClient.eval.mock.calls[0];
      expect(costArg).toBe(AI_MODEL_USAGE[MODEL].neuronsPerRequest);
    });

    it('honors an explicit estimatedNeurons parameter', async () => {
      mockClient.eval.mockResolvedValue([1, 250]);
      await service.canMakeRequest(MODEL, 250);
      const [, , , costArg] = mockClient.eval.mock.calls[0];
      expect(costArg).toBe(250);
    });

    it('treats a non-array eval result as denied', async () => {
      mockClient.eval.mockResolvedValue(0);
      const result = await service.canMakeRequest(MODEL);
      expect(result.allowed).toBe(false);
    });

    it('clamps remaining at zero', async () => {
      mockClient.eval.mockResolvedValue([1, 99999]);
      const result = await service.canMakeRequest(MODEL);
      expect(result.remaining).toBe(0);
    });
  });

  describe('getSafetyLimit', () => {
    it('defaults to 9500 when env not set', () => {
      expect(service.getSafetyLimit()).toBe(9500);
    });

    it('reads from environment variable', () => {
      process.env.AI_NEURON_SAFETY_LIMIT = '8000';
      expect(service.getSafetyLimit()).toBe(8000);
    });
  });

  describe('resetDailyUsage', () => {
    it('deletes the current day key', async () => {
      mockClient.del.mockResolvedValue(1);
      const key = service.currentDateKey;
      await service.resetDailyUsage();
      expect(mockClient.del).toHaveBeenCalledWith(key);
    });

    it('no-ops when client missing', async () => {
      redis.getClient.mockReturnValue(null);
      await expect(service.resetDailyUsage()).resolves.toBeUndefined();
    });
  });

  describe('getUsageStatus', () => {
    it('reports blocked state and percentage', async () => {
      mockClient.get.mockResolvedValue('9500');
      const status = await service.getUsageStatus();
      expect(status.used).toBe(9500);
      expect(status.blocked).toBe(true);
      expect(status.remaining).toBe(0);
      expect(status.percentage).toBe(100);
      expect(status.limit).toBe(9500);
    });

    it('computes percentage and remaining for partial usage', async () => {
      mockClient.get.mockResolvedValue('4750');
      const status = await service.getUsageStatus();
      expect(status.remaining).toBe(4750);
      expect(status.blocked).toBe(false);
      expect(status.percentage).toBe(50);
    });
  });
});
