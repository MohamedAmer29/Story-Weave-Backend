import { OtpService } from './otp.service';
import { RedisService } from '../../config/redis.service';
import { ConfigService } from '@nestjs/config';

describe('OtpService', () => {
  let service: OtpService;
  let redis: { getClient: jest.Mock; get: jest.Mock; set: jest.Mock; del: jest.Mock; incrby: jest.Mock; expire: jest.Mock };
  let config: ConfigService;

  const mockStore: Record<string, string> = {};
  let storedTtls: Record<string, number> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
    storedTtls = {};

    const mockClient = {
      get: jest.fn((k: string) => Promise.resolve(mockStore[k] ?? null)),
      set: jest.fn((k: string, v: string, _mode: string, _ttl: number) => {
        mockStore[k] = v;
        return Promise.resolve('OK');
      }),
      del: jest.fn((k: string) => {
        const existed = k in mockStore;
        delete mockStore[k];
        return Promise.resolve(existed ? 1 : 0);
      }),
      incrby: jest.fn((k: string, inc: number) => {
        const cur = parseInt(mockStore[k] ?? '0', 10);
        mockStore[k] = String(cur + inc);
        return Promise.resolve(cur + inc);
      }),
      expire: jest.fn((k: string, secs: number) => {
        storedTtls[k] = secs;
        return Promise.resolve(1);
      }),
    };

    redis = {
      getClient: jest.fn().mockReturnValue(mockClient),
      get: mockClient.get,
      set: mockClient.set,
      del: mockClient.del,
      incrby: mockClient.incrby,
      expire: mockClient.expire,
    } as unknown as { getClient: jest.Mock; get: jest.Mock; set: jest.Mock; del: jest.Mock; incrby: jest.Mock; expire: jest.Mock };

    const configValues: Record<string, unknown> = {
      'otp.expiresInMinutes': 10,
      'otp.maxAttempts': 5,
      'otp.resendCooldownSeconds': 60,
    };
    config = {
      get: jest.fn((key: string, def?: unknown) => configValues[key] ?? def),
    } as unknown as ConfigService;

    service = new OtpService(redis as unknown as RedisService, config);
  });

  describe('generate', () => {
    it('stores a 6-digit otp hash and resets attempts', async () => {
      const otp = await service.generate('u1', 'verify');
      expect(otp).toMatch(/^\d{6}$/);

      // hash stored under the otp key
      const stored = mockStore['otp:verify:u1'];
      expect(stored).toBeDefined();
      expect(stored).not.toBe(otp); // hashed, not plaintext
      expect(redis.set).toHaveBeenCalledWith(
        'otp:verify:u1',
        expect.any(String),
        600000,
      );
      expect(redis.del).toHaveBeenCalledWith('otp:attempts:verify:u1');
    });
  });

  describe('verify', () => {
    it('returns true for a matching otp and invalidates the key', async () => {
      const otp = await service.generate('u1', 'verify');
      const ok = await service.verify('u1', 'verify', otp);
      expect(ok).toBe(true);
      expect(mockStore['otp:verify:u1']).toBeUndefined();
      expect(mockStore['otp:attempts:verify:u1']).toBeUndefined();
    });

    it('returns false for a wrong otp and increments attempts', async () => {
      await service.generate('u1', 'verify');
      const ok = await service.verify('u1', 'verify', '000000');
      expect(ok).toBe(false);
      expect(mockStore['otp:attempts:verify:u1']).toBe('1');
    });

    it('blocks after max attempts', async () => {
      await service.generate('u1', 'verify');
      const otp = await service.generate('u1', 'verify');
      // set attempts to max
      mockStore['otp:attempts:verify:u1'] = '5';
      const ok = await service.verify('u1', 'verify', otp);
      expect(ok).toBe(false);
    });

    it('returns false when no otp stored', async () => {
      const ok = await service.verify('u1', 'verify', '123456');
      expect(ok).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('returns true when no otp stored', async () => {
      await expect(service.isExpired('u1', 'verify')).resolves.toBe(true);
    });

    it('returns false when otp exists', async () => {
      await service.generate('u1', 'verify');
      await expect(service.isExpired('u1', 'verify')).resolves.toBe(false);
    });
  });

  describe('attempts', () => {
    it('increments attempts and sets expiry', async () => {
      const count = await service.incrementAttempts('u1', 'verify');
      expect(count).toBe(1);
      expect(storedTtls['otp:attempts:verify:u1']).toBe(600);
    });

    it('getAttempts returns 0 when none stored', async () => {
      await expect(service.getAttempts('u1', 'verify')).resolves.toBe(0);
    });

    it('getAttempts returns stored value', async () => {
      mockStore['otp:attempts:verify:u1'] = '3';
      await expect(service.getAttempts('u1', 'verify')).resolves.toBe(3);
    });
  });

  describe('cooldown', () => {
    it('isCoolingDown returns false when no cooldown', async () => {
      await expect(service.isCoolingDown('u1', 'verify')).resolves.toBe(false);
    });

    it('isCoolingDown returns true when cooldown set', async () => {
      await service.setCooldown('u1', 'verify');
      await expect(service.isCoolingDown('u1', 'verify')).resolves.toBe(true);
    });
  });

  describe('invalidate', () => {
    it('removes otp and attempts keys', async () => {
      await service.generate('u1', 'verify');
      await service.invalidate('u1', 'verify');
      expect(mockStore['otp:verify:u1']).toBeUndefined();
      expect(mockStore['otp:attempts:verify:u1']).toBeUndefined();
    });
  });
});
