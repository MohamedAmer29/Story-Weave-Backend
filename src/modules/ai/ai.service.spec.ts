import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { AIService } from './ai.service';
import { CloudflareProvider } from './providers/cloudflare.provider';
import { AiUsageService } from '../../ai/ai-usage.service';
import { AiUsageLimitExceededException } from '../../ai/ai-usage-limit-exception';

jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  statSync: jest.fn(() => ({ size: 123 })),
}));

describe('AIService', () => {
  let service: AIService;
  let cloudflareProvider: { generateImage: jest.Mock };
  let usageService: { canMakeRequest: jest.Mock; getCurrentUsage: jest.Mock; getSafetyLimit: jest.Mock };

  const makeConfig = (provider: string) => {
    const values: Record<string, unknown> = {
      'ai.provider': provider,
      'ai.model': '@cf/black-forest-labs/flux-1-schnell',
    };
    return { get: jest.fn((k: string) => values[k]) } as unknown as ConfigService;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cloudflareProvider = { generateImage: jest.fn() };
    usageService = {
      canMakeRequest: jest.fn(),
      getCurrentUsage: jest.fn(),
      getSafetyLimit: jest.fn(),
    };
  });

  const build = (provider = 'cloudflare') =>
    new AIService(
      cloudflareProvider as unknown as CloudflareProvider,
      makeConfig(provider),
      usageService as unknown as AiUsageService,
    );

  describe('constructor provider selection', () => {
    it('selects cloudflare provider', () => {
      service = build('cloudflare');
      expect(service).toBeInstanceOf(AIService);
    });

    it('defaults to cloudflare for unknown providers', () => {
      service = build('totally-unknown');
      expect(service).toBeInstanceOf(AIService);
    });
  });

  describe('generateTestImage', () => {
    it('generates image, writes file, and returns success metadata', async () => {
      service = build();
      usageService.canMakeRequest.mockResolvedValue({
        allowed: true,
        used: 0,
        remaining: 9500,
      });
      cloudflareProvider.generateImage.mockResolvedValue({
        buffer: Buffer.from('image'),
        mimeType: 'image/jpeg',
      });

      const result = await service.generateTestImage('a test prompt');

      expect(usageService.canMakeRequest).toHaveBeenCalledWith(
        '@cf/black-forest-labs/flux-1-schnell',
        100,
      );
      expect(cloudflareProvider.generateImage).toHaveBeenCalledWith(
        'a test prompt',
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'flux-test.jpg'),
        Buffer.from('image'),
      );
      expect(result).toMatchObject({
        success: true,
        size: 123,
        file: 'flux-test.jpg',
      });
    });

    it('throws AiUsageLimitExceededException when not allowed', async () => {
      service = build();
      usageService.canMakeRequest.mockResolvedValue({
        allowed: false,
        used: 9500,
        remaining: 0,
      });
      usageService.getCurrentUsage.mockResolvedValue(9500);
      usageService.getSafetyLimit.mockResolvedValue(9500);

      await expect(service.generateTestImage('x')).rejects.toBeInstanceOf(
        AiUsageLimitExceededException,
      );
      expect(cloudflareProvider.generateImage).not.toHaveBeenCalled();
    });
  });
});
