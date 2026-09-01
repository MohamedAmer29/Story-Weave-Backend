import { HttpException, HttpStatus } from '@nestjs/common';

export class AiUsageLimitExceededException extends HttpException {
  constructor(used: number, limit: number) {
    super(
      {
        success: false,
        code: 'AI_DAILY_LIMIT_REACHED',
        message:
          'Daily AI generation limit reached. New AI requests are temporarily disabled.',
        usage: {
          limit,
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
