import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

const KNOWN_ERROR_NAMES = [
  'BadRequestException',
  'UnauthorizedException',
  'ForbiddenException',
  'NotFoundException',
  'ConflictException',
  'NotAcceptableException',
  'RequestTimeoutException',
  'PayloadTooLargeException',
  'UnprocessableEntityException',
  'TooManyRequestsException',
];

const GENERIC_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Payload Too Large',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Propagate a client-supplied correlation ID, else generate one server-side.
    const requestId =
      (request as any).requestId ||
      request.headers['x-request-id'] ||
      randomUUID().toString();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Detailed (sanitized) info only for the server-side log.
    let logDetail = 'Unknown error';
    if (exception instanceof Error) {
      logDetail = this.sanitizeMessage(exception.message);
    }

    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - RequestId: ${requestId} - Message: ${logDetail}`,
      exception instanceof Error ? exception.stack : '',
    );

    // For 5xx or unexpected errors, never leak internals to the client.
    let clientMessage: string | string[] = 'Internal server error';
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      clientMessage = this.buildClientMessage(status, res, exception);
    }

    response.status(status).json({
      statusCode: status,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: clientMessage,
    });
  }

  private buildClientMessage(
    status: number,
    res: string | object,
    exception: HttpException,
  ): string | string[] {
    // Reject error payloads from unexpected (server-side) exceptions.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'Internal server error';
    }

    if (typeof res === 'string') {
      // A string response from a known, intentionally-thrown exception is safe.
      if (KNOWN_ERROR_NAMES.includes(exception.constructor.name)) {
        return this.sanitizeMessage(res);
      }
      return GENERIC_MESSAGES[status] ?? 'Request failed';
    }

    if (res && typeof res === 'object') {
      const msg = (res as any).message;
      // Validation DTOs return an array of messages.
      if (Array.isArray(msg)) {
        return msg.map((m) => this.sanitizeMessage(String(m)));
      }
      if (typeof msg === 'string') {
        return this.sanitizeMessage(msg);
      }
      return GENERIC_MESSAGES[status] ?? 'Request failed';
    }

    return GENERIC_MESSAGES[status] ?? 'Request failed';
  }

  private sanitizeMessage(message: string): string {
    if (!message || message.length === 0) {
      return 'Unknown error';
    }

    const REDACTION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
      [/(password\s*[:=]?\s*)(\S+)/gi, '$1<redacted>'],
      [/(authorization\s*[:=]?\s*)(\S+)/gi, '$1<redacted>'],
      [/(bearer\s+)(\S+)/gi, '$1<redacted>'],
      [/(api[_-]?token\s*[:=]?\s*)(\S+)/gi, '$1<redacted>'],
      [/(api[_-]?key\s*[:=]?\s*)(\S+)/gi, '$1<redacted>'],
      [/(api[_-]?secret\s*[:=]?\s*)(\S+)/gi, '$1<redacted>'],
      [/(jwt[_-]?secret\s*[:=]?\s*)(\S+)/gi, '$1<redacted>'],
      [/(cloudinary[_-]?api[_-]?secret\s*[:=]?\s*)(\S+)/gi, '$1<redacted>'],
    ];

    let sanitized = message;
    for (const [pattern, replacement] of REDACTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    // Guard against runaway/unbounded length on log lines.
    return sanitized.length > 500 ? `${sanitized.substring(0, 500)}...` : sanitized;
  }
}
