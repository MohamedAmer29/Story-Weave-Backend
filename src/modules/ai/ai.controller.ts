import {
  Controller,
  Get,
  UseGuards,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from './ai.service';
import { AiUsageService } from '../../ai/ai-usage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('ai')
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly configService: ConfigService,
    private readonly usageService: AiUsageService,
  ) {}

  @Post('test-image')
  @Public()
  @HttpCode(HttpStatus.OK)
  async testImage(@Body('prompt') prompt: string) {
    const environment = this.configService.get<string>('app.environment');

    if (environment !== 'development') {
      throw new BadRequestException(
        'Test endpoint is only available in development mode',
      );
    }

    return this.aiService.generateTestImage(prompt);
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  @Public()
  async getUsage() {
    const status = await this.usageService.getUsageStatus();

    return {
      success: true,
      data: {
        dailyLimit: Number(process.env.AI_DAILY_NEURON_LIMIT) || 10000,
        safetyLimit: Number(process.env.AI_NEURON_SAFETY_LIMIT) || 9500,
        safetyBuffer: (Number(process.env.AI_NEURON_SAFETY_LIMIT) || 9500)
          - (Number(process.env.AI_DAILY_NEURON_LIMIT) || 10000),
        used: status.used,
        remainingUntilSafetyLimit: status.remaining,
        percentageUsed: status.percentage,
        blocked: status.blocked,
        date: status.date,
      },
    };
  }

  @Get('usage/status')
  @UseGuards(JwtAuthGuard)
  @Public()
  async getUsageStatus() {
    const status = await this.usageService.getUsageStatus();

    return {
      allowed: !status.blocked,
      used: status.used,
      limit: status.limit,
      remaining: status.remaining,
    };
  }
}