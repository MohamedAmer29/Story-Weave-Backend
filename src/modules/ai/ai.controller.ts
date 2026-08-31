import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from './ai.service';
import { TestImageDto } from './dto/test-image.dto';

@Controller('ai')
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly configService: ConfigService,
  ) {}

  @Post('test-image')
  @HttpCode(HttpStatus.OK)
  async testImage(@Body() testImageDto: TestImageDto) {
    const environment = this.configService.get<string>('app.environment');

    if (environment !== 'development') {
      throw new BadRequestException(
        'Test endpoint is only available in development mode',
      );
    }

    return this.aiService.generateTestImage(testImageDto.prompt);
  }
}
