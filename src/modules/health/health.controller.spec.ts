import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthModule', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get(HealthController);
    service = module.get(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('HealthService.check', () => {
    it('returns ok status with a timestamp', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const result = service.check();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBe('2026-01-01T00:00:00.000Z');
      jest.useRealTimers();
    });
  });

  describe('HealthController.check', () => {
    it('delegates to the service', () => {
      const spy = jest.spyOn(service, 'check').mockReturnValue({
        status: 'ok',
        timestamp: 'x',
      });
      expect(controller.check()).toEqual({ status: 'ok', timestamp: 'x' });
      expect(spy).toHaveBeenCalled();
    });
  });
});
