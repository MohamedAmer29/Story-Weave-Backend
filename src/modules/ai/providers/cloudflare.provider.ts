import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  AIProvider,
  AIImageGenerationResult,
} from '../../../common/interfaces/ai-provider.interface';

interface CloudflareResponse {
  result?: {
    image?: string;
  };
  errors?: Array<{
    code: number;
    message: string;
  }>;
  success: boolean;
}

@Injectable()
export class CloudflareProvider implements AIProvider {
  private readonly logger = new Logger(CloudflareProvider.name);
  private readonly baseUrl = 'https://api.cloudflare.com/client/v4/accounts';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async generateImage(prompt: string): Promise<AIImageGenerationResult> {
    const accountId = this.configService.get<string>('ai.cloudflareAccountId');
    const apiToken = this.configService.get<string>('ai.cloudflareApiToken');
    const model = this.configService.get<string>('ai.model');

    if (!accountId) {
      this.logger.error('CLOUDFLARE_ACCOUNT_ID is not configured');
      throw new InternalServerErrorException(
        'Cloudflare Account ID is not configured',
      );
    }

    if (!apiToken) {
      this.logger.error('CLOUDFLARE_API_TOKEN is not configured');
      throw new InternalServerErrorException(
        'Cloudflare API Token is not configured',
      );
    }

    if (!model) {
      this.logger.error('AI_MODEL is not configured');
      throw new InternalServerErrorException('AI Model is not configured');
    }

    const url = `${accountId}/ai/run/${model}`;
    const fullUrl = `${this.baseUrl}/${url}`;

    this.logger.log(`Generating image with model: ${model}`);
    // redact long IDs in the logged URL
    this.logger.debug(
      `Request URL: ${fullUrl.replace(/[A-Fa-f0-9-]{16,}/g, '<redacted>')}`,
    );

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      this.logger.error('Invalid prompt provided to CloudflareProvider');
      throw new InternalServerErrorException('Invalid prompt for AI provider');
    }

    this.logger.debug(`Prompt length: ${prompt.length} characters`);

    // FLUX models enforce a prompt length limit (Cloudflare error showed 2048).
    const MAX_PROMPT_LENGTH = 2048;
    let sendPrompt = prompt;
    if (prompt.length > MAX_PROMPT_LENGTH) {
      this.logger.warn(
        `Prompt length ${prompt.length} exceeds ${MAX_PROMPT_LENGTH}, truncating to fit model limit`,
      );
      // Try to cut at a space boundary for readability.
      const truncated = prompt.slice(0, MAX_PROMPT_LENGTH - 3);
      const lastSpace = truncated.lastIndexOf(' ');
      sendPrompt =
        lastSpace > Math.floor((MAX_PROMPT_LENGTH - 3) / 2)
          ? `${truncated.slice(0, lastSpace)}...`
          : `${truncated}...`;
      this.logger.debug(`Truncated prompt length: ${sendPrompt.length}`);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<CloudflareResponse>(
          fullUrl,
          {
            prompt: sendPrompt,
          },
          {
            headers: {
              Authorization: `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 60000,
          },
        ),
      );

      this.logger.log(`Cloudflare API response status: ${response.status}`);

      if (!response.data?.success) {
        const errors = response.data?.errors || [];
        const errorMessage = errors.map((e) => e.message).join(', ');
        this.logger.error(`Cloudflare API error: ${errorMessage}`);
        throw new InternalServerErrorException(
          `Cloudflare API error: ${errorMessage}`,
        );
      }

      const base64Image = response.data?.result?.image;

      if (!base64Image) {
        this.logger.error('No image in Cloudflare response');
        throw new InternalServerErrorException(
          'No image received from Cloudflare',
        );
      }

      this.logger.log(
        `Base64 image received, length: ${base64Image.length} characters`,
      );

      const buffer = Buffer.from(base64Image, 'base64');
      this.logger.log(`Image buffer created, size: ${buffer.length} bytes`);

      return {
        buffer,
        mimeType: 'image/jpeg',
      };
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        this.logger.error(`Cloudflare API error - Status: ${status}`);

        if (status === 401) {
          this.logger.error('Invalid Cloudflare API Token');
          throw new InternalServerErrorException(
            'Invalid Cloudflare API credentials (401)',
          );
        }

        if (status === 403) {
          this.logger.error('Cloudflare API access forbidden');
          throw new InternalServerErrorException(
            'Cloudflare API access forbidden (403)',
          );
        }

        if (status === 404) {
          this.logger.error(
            'Cloudflare resource not found (invalid account ID or model)',
          );
          throw new InternalServerErrorException(
            'Cloudflare resource not found (404)',
          );
        }

        // Log the response body for debugging without sensitive headers
        let safeBody: string;
        try {
          safeBody = JSON.stringify(data);
        } catch (e) {
          safeBody = String(data);
        }

        this.logger.error(`Cloudflare API error response: ${safeBody}`);
        throw new InternalServerErrorException(
          `Cloudflare API error (${status}): ${safeBody}`,
        );
      }

      if (error.code === 'ECONNABORTED') {
        this.logger.error('Cloudflare API request timeout');
        throw new InternalServerErrorException(
          'Cloudflare API request timeout',
        );
      }

      this.logger.error(
        `Unexpected error calling Cloudflare API: ${error?.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to generate image: ${error?.message ?? 'unknown'}`,
      );
    }
  }
}
