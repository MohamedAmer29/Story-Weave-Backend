import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';
import { AUDIT_KEY, AuditMetadata } from './audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditMetadata | undefined>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap(() => {
        const targetId = metadata.targetParam
          ? (request.params?.[metadata.targetParam] ?? null)
          : null;

        this.auditService.record({
          adminId: user?.id ?? 'unknown',
          adminEmail: user?.email ?? null,
          action: metadata.action,
          targetType: metadata.targetType ?? null,
          targetId: targetId ?? null,
          metadata: {
            method: request.method,
            path: request.originalUrl ?? request.url,
          },
          ip: request.ip ?? null,
          userAgent: request.headers?.['user-agent'] ?? null,
        });
      }),
    );
  }
}
