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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { TestImageDto } from './dto/test-image.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('ai')
@Controller('ai')
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly configService: ConfigService,
    private readonly usageService: AiUsageService,
  ) {}

  @Post('test-image')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @RateLimit({ ttl: 60, limit: 5 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a test image (development only)' })
  async testImage(@Body() body: TestImageDto) {
    const environment = this.configService.get<string>('app.environment');

    if (environment !== 'development') {
      throw new BadRequestException(
        'Test endpoint is only available in development mode',
      );
    }

    return this.aiService.generateTestImage(body.prompt);
  }

  @Get('usage')
  async getUsage() {
    const status = await this.usageService.getUsageStatus();

    return {
      success: true,
      data: {
        dailyLimit: Number(process.env.AI_DAILY_NEURON_LIMIT) || 10000,
        safetyLimit: Number(process.env.AI_NEURON_SAFETY_LIMIT) || 9500,
        used: status.used,
        remainingUntilSafetyLimit: status.remaining,
        percentageUsed: status.percentage,
        blocked: status.blocked,
        date: status.date,
      },
    };
  }

  @Get('usage/status')
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
