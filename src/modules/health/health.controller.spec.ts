import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RedisService } from '../../config/redis.service';

describe('HealthModule', () => {
  let controller: HealthController;
  let service: HealthService;

  const dataSourceMock = {
    query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const redisMock = {
    getClient: jest.fn().mockReturnValue({ ping: jest.fn().mockResolvedValue('PONG') }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: getDataSourceToken(), useValue: dataSourceMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    controller = module.get(HealthController);
    service = module.get(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('HealthService.liveness', () => {
    it('returns ok status with a timestamp', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const result = service.liveness();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBe('2026-01-01T00:00:00.000Z');
      jest.useRealTimers();
    });
  });

  describe('HealthService.readiness', () => {
    it('reports ok when database and redis respond', async () => {
      const result = await service.readiness();
      expect(result.status).toBe('ok');
      expect(result.checks).toEqual({ database: 'ok', redis: 'ok' });
    });

    it('reports error when database fails', async () => {
      dataSourceMock.query.mockRejectedValueOnce(new Error('down'));
      const result = await service.readiness();
      expect(result.status).toBe('error');
      expect(result.checks.database).toBe('error');
      expect(result.checks.redis).toBe('ok');
    });

    it('reports error when redis fails', async () => {
      redisMock.getClient.mockReturnValueOnce({
        ping: jest.fn().mockRejectedValueOnce(new Error('down')),
      });
      const result = await service.readiness();
      expect(result.status).toBe('error');
      expect(result.checks.database).toBe('ok');
      expect(result.checks.redis).toBe('error');
    });
  });

  describe('HealthController.liveness', () => {
    it('delegates to the service', () => {
      const spy = jest.spyOn(service, 'liveness').mockReturnValue({
        status: 'ok',
        timestamp: 'x',
      });
      expect(controller.liveness()).toEqual({ status: 'ok', timestamp: 'x' });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('HealthController.readiness', () => {
    it('delegates to the service (async)', async () => {
      const spy = jest.spyOn(service, 'readiness').mockResolvedValue({
        status: 'ok',
        checks: { database: 'ok', redis: 'ok' },
        timestamp: 'x',
      });
      await expect(controller.readiness()).resolves.toEqual({
        status: 'ok',
        checks: { database: 'ok', redis: 'ok' },
        timestamp: 'x',
      });
      expect(spy).toHaveBeenCalled();
    });
  });
});
