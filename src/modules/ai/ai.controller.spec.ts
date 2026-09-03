import { BadRequestException } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { AiUsageService } from '../../ai/ai-usage.service';

describe('AIController', () => {
  let controller: AIController;
  let aiService: { generateTestImage: jest.Mock };
  let configService: { get: jest.Mock };
  let usageService: { getUsageStatus: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    aiService = { generateTestImage: jest.fn() };
    usageService = { getUsageStatus: jest.fn() };
  });

  const makeController = (environment = 'development') => {
    configService = {
      get: jest.fn((key: string) =>
        key === 'app.environment' ? environment : undefined,
      ),
    };
    controller = new AIController(
      aiService as unknown as AIService,
      configService as any,
      usageService as unknown as AiUsageService,
    );
  };

  describe('testImage', () => {
    it('throws BadRequest outside development environment', async () => {
      makeController('production');
      await expect(
        controller.testImage({ prompt: 'a cat' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(aiService.generateTestImage).not.toHaveBeenCalled();
    });

    it('calls the AI service in development', async () => {
      makeController('development');
      aiService.generateTestImage.mockResolvedValue({ success: true });
      const result = await controller.testImage({ prompt: 'a dog' });
      expect(aiService.generateTestImage).toHaveBeenCalledWith('a dog');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getUsage', () => {
    it('returns usage status with configured limits', async () => {
      makeController();
      const oldLimit = process.env.AI_DAILY_NEURON_LIMIT;
      const oldSafe = process.env.AI_NEURON_SAFETY_LIMIT;
      process.env.AI_DAILY_NEURON_LIMIT = '10000';
      process.env.AI_NEURON_SAFETY_LIMIT = '9500';
      usageService.getUsageStatus.mockResolvedValue({
        used: 100,
        remaining: 9400,
        percentage: 1.05,
        blocked: false,
        date: '2026-01-01',
        limit: 9500,
      });
      const result = await controller.getUsage();
      expect(result.success).toBe(true);
      expect(result.data.dailyLimit).toBe(10000);
      expect(result.data.safetyLimit).toBe(9500);
      expect(result.data.used).toBe(100);
      if (oldLimit === undefined) delete process.env.AI_DAILY_NEURON_LIMIT;
      else process.env.AI_DAILY_NEURON_LIMIT = oldLimit;
      if (oldSafe === undefined) delete process.env.AI_NEURON_SAFETY_LIMIT;
      else process.env.AI_NEURON_SAFETY_LIMIT = oldSafe;
    });
  });

  describe('getUsageStatus', () => {
    it('returns allowed state derived from blocked', async () => {
      makeController();
      usageService.getUsageStatus.mockResolvedValue({
        blocked: false,
        used: 100,
        limit: 9500,
        remaining: 9400,
      });
      const result = await controller.getUsageStatus();
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(100);
      expect(result.limit).toBe(9500);
    });
  });
});
