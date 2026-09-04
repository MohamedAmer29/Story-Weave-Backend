import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { CloudflareProvider } from './cloudflare.provider';

describe('CloudflareProvider', () => {
  let provider: CloudflareProvider;
  let httpService: { post: jest.Mock };

  const makeConfig = (overrides: Record<string, unknown> = {}) => {
    const values: Record<string, unknown> = {
      'ai.cloudflareAccountId': 'acct-1',
      'ai.cloudflareApiToken': 'token-1',
      'ai.model': '@cf/black-forest-labs/flux-1-schnell',
      ...overrides,
    };
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    httpService = { post: jest.fn() };
    provider = new CloudflareProvider(
      makeConfig(),
      httpService as unknown as HttpService,
    );
  });

  describe('configuration validation', () => {
    it('throws when account id missing', async () => {
      provider = new CloudflareProvider(
        makeConfig({ 'ai.cloudflareAccountId': undefined }),
        httpService as unknown as HttpService,
      );
      await expect(provider.generateImage('hi')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('throws when api token missing', async () => {
      provider = new CloudflareProvider(
        makeConfig({ 'ai.cloudflareApiToken': undefined }),
        httpService as unknown as HttpService,
      );
      await expect(provider.generateImage('hi')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('throws when model missing', async () => {
      provider = new CloudflareProvider(
        makeConfig({ 'ai.model': undefined }),
        httpService as unknown as HttpService,
      );
      await expect(provider.generateImage('hi')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('throws for empty/invalid prompt', async () => {
      await expect(provider.generateImage('')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      await expect(provider.generateImage('   ')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('generateImage', () => {
    it('returns a buffer for a successful response', async () => {
      const base64 = Buffer.from('fake-image-bytes').toString('base64');
      httpService.post.mockReturnValue(
        of({
          data: { success: true, result: { image: base64 } },
          status: 200,
        }),
      );

      const result = await provider.generateImage('a beautiful scene');

      expect(result.mimeType).toBe('image/jpeg');
      expect(result.buffer.toString()).toBe('fake-image-bytes');

      const [url, body, config] = httpService.post.mock.calls[0];
      expect(url).toContain('/ai/run/@cf/black-forest-labs/flux-1-schnell');
      expect(body).toEqual({ prompt: 'a beautiful scene' });
      expect(config.headers.Authorization).toBe('Bearer token-1');
      expect(config.timeout).toBe(60000);
    });

    it('throws when API reports success=false with errors', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            success: false,
            errors: [{ code: 1, message: 'bad prompt' }],
          },
          status: 200,
        }),
      );
      await expect(provider.generateImage('x')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('throws when no image returned', async () => {
      httpService.post.mockReturnValue(
        of({ data: { success: true, result: {} }, status: 200 }),
      );
      await expect(provider.generateImage('x')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('truncates prompts longer than 2048 chars', async () => {
      const longPrompt = 'word '.repeat(600); // ~2400 chars
      httpService.post.mockReturnValue(
        of({
          data: { success: true, result: { image: 'aGk=' } },
          status: 200,
        }),
      );
      await provider.generateImage(longPrompt.trim());
      const body = httpService.post.mock.calls[0][1];
      expect(body.prompt.length).toBeLessThanOrEqual(2048);
    });
  });

  describe('error mapping', () => {
    const makeHttpError = (status: number, data: unknown) => {
      const err: any = new Error(`HTTP ${status}`);
      err.response = { status, data };
      return err;
    };

    it('maps 401 to a credentials message', async () => {
      httpService.post.mockReturnValue(
        throwError(() => makeHttpError(401, {})),
      );
      await expect(provider.generateImage('x')).rejects.toThrow(
        'Invalid Cloudflare API credentials',
      );
    });

    it('maps 403 to forbidden', async () => {
      httpService.post.mockReturnValue(
        throwError(() => makeHttpError(403, {})),
      );
      await expect(provider.generateImage('x')).rejects.toThrow('forbidden');
    });

    it('maps 404 to resource not found', async () => {
      httpService.post.mockReturnValue(
        throwError(() => makeHttpError(404, {})),
      );
      await expect(provider.generateImage('x')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('maps a generic HTTP error to InternalServerError', async () => {
      httpService.post.mockReturnValue(
        throwError(() => makeHttpError(500, { error: 'server down' })),
      );
      await expect(provider.generateImage('x')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('maps timeout errors', async () => {
      const err: any = new Error('timeout');
      err.code = 'ECONNABORTED';
      httpService.post.mockReturnValue(throwError(() => err));
      await expect(provider.generateImage('x')).rejects.toThrow('timeout');
    });

    it('maps unexpected errors', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('network down')),
      );
      await expect(provider.generateImage('x')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
