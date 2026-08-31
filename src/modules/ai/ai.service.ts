import { Injectable, Logger } from '@nestjs/common';
import { AIProvider } from '../../common/interfaces/ai-provider.interface';
import { CloudflareProvider } from './providers/cloudflare.provider';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly provider: AIProvider;

  constructor(
    private readonly cloudflareProvider: CloudflareProvider,
    private readonly configService: ConfigService,
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
  }

  async generateTestImage(prompt: string): Promise<{
    success: boolean;
    message: string;
    size: number;
    file: string;
  }> {
    this.logger.log('Generating test image...');

    const result = await this.provider.generateImage(prompt);

    const filename = 'flux-test.jpg';
    const filepath = path.join(process.cwd(), filename);

    this.logger.log(`Saving image to: ${filepath}`);

    fs.writeFileSync(filepath, result.buffer);

    const stats = fs.statSync(filepath);
    this.logger.log(`Image saved successfully, size: ${stats.size} bytes`);

    return {
      success: true,
      message: 'FLUX.1 Schnell image generated successfully',
      size: stats.size,
      file: filename,
    };
  }
}
