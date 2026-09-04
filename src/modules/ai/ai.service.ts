import { Injectable, Logger } from '@nestjs/common';
import { AIProvider } from '../../common/interfaces/ai-provider.interface';
import { CloudflareProvider } from './providers/cloudflare.provider';
import { AiUsageService } from '../../ai/ai-usage.service';
import { ConfigService } from '@nestjs/config';
import { AiUsageLimitExceededException } from '../../ai/ai-usage-limit-exception';
import { AI_MODEL_USAGE } from '../../ai/config/ai-model-usage.config';

const MODEL_KEY_MAP: Record<string, string> = {
  '@cf/black-forest-labs/flux-1-schnell':
    '@cf/black-forest-labs/flux-1-schnell',
};

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly provider: AIProvider;
  private readonly usageService: AiUsageService;

  constructor(
    private readonly cloudflareProvider: CloudflareProvider,
    private readonly configService: ConfigService,
    usageService: AiUsageService,
  ) {
    const provider = this.configService.get<string>('ai.provider');
    this.logger.log(`AI Provider: ${provider}`);

    switch (provider) {
      case 'cloudflare':
        this.provider = this.cloudflareProvider;
        break;
      default:
        this.logger.warn(
          `Unknown provider: ${provider}, defaulting to Cloudflare`,
        );
        this.provider = this.cloudflareProvider;
    }

    this.usageService = usageService;
  }

  async generateTestImage(prompt: string): Promise<{
    success: boolean;
    message: string;
    size: number;
  }> {
    this.logger.log('Generating test image...');

    const model = this.configService.get<string>('ai.model');
    const modelKey = MODEL_KEY_MAP[model as string];

    const estimatedNeurons = AI_MODEL_USAGE[modelKey]?.neuronsPerRequest ?? 100;

    // Check usage reservation before proceeding
    const { allowed, remaining } = await this.usageService.canMakeRequest(
      modelKey as keyof typeof AI_MODEL_USAGE,
      estimatedNeurons,
    );

    if (!allowed) {
      throw new AiUsageLimitExceededException(
        await this.usageService.getCurrentUsage(),
        await this.usageService.getSafetyLimit(),
      );
    }

    this.logger.log(
      `[AI Usage] Proceeding with request. Reserved: ${estimatedNeurons} neurons`,
    );

    const result = await this.provider.generateImage(prompt);

    // Return the generated image in memory. This is a diagnostic endpoint and
    // must not write artifacts into the application's working directory.
    return {
      success: true,
      message: 'FLUX.1 Schnell image generated successfully',
      size: result.buffer.length,
    };
  }
}
