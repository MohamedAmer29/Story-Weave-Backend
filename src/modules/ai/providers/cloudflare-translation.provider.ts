import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TranslationProvider } from '../../../common/interfaces/translation-provider.interface';

interface CloudflareTranslationResponse {
  success?: boolean;
  result?: {
    translated_text?: string;
  };
  errors?: Array<{ message?: string }>;
}

@Injectable()
export class CloudflareTranslationProvider implements TranslationProvider {
  private readonly logger = new Logger(CloudflareTranslationProvider.name);
  private readonly baseUrl = 'https://api.cloudflare.com/client/v4/accounts';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async translateToEnglish(text: string): Promise<string> {
    const accountId = this.configService.get<string>('ai.cloudflareAccountId');
    const apiToken = this.configService.get<string>('ai.cloudflareApiToken');
    const model =
      this.configService.get<string>('ai.translationModel') ||
      '@cf/meta/m2m100-1.2b';

    if (!accountId || !apiToken) {
      throw new InternalServerErrorException(
        'Translation provider credentials are not configured',
      );
    }

    if (!text.trim()) {
      return text;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<CloudflareTranslationResponse>(
          `${this.baseUrl}/${accountId}/ai/run/${model}`,
          {
            text,
            source_lang: 'ar',
            target_lang: 'en',
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

      const translated = response.data?.result?.translated_text?.trim();
      if (!response.data?.success || !translated) {
        const message = (response.data?.errors ?? [])
          .map((error) => error.message)
          .filter(Boolean)
          .join(', ');
        throw new Error(message || 'Translation response was empty');
      }

      return translated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Arabic visual translation failed: ${message}`);
      throw new InternalServerErrorException(
        'Arabic visual translation failed',
      );
    }
  }
}
