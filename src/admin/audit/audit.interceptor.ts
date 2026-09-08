import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { AuditLogService } from './audit-log.service';
import { AUDIT_KEY, AuditMetadata } from './audit.decorator';
import { getClientIp } from '../../common/utils/ip.util';

interface AuditRequestUser {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role?: string;
  sessionId?: string;
}

interface AuditRequest extends Request {
  user?: AuditRequestUser;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditLogService,
  ) {}

  private normalizeParamValue(
    value: string | string[] | undefined,
  ): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return null;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditMetadata | undefined>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditRequest>();
    const user = request.user;
    const actorName =
      user?.name ??
      (user?.firstName || user?.lastName
        ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
        : null);

    return next.handle().pipe(
      tap(() => {
        const targetId = metadata.targetParam
          ? this.normalizeParamValue(request.params?.[metadata.targetParam])
          : null;
        const action = metadata.actionBuilder
          ? metadata.actionBuilder(request, context)
          : metadata.action;

        void this.auditService.record({
          adminId: user?.id ?? 'unknown',
          adminEmail: user?.email ?? null,
          actorName: actorName ?? null,
          actorRole: user?.role ?? null,
          action,
          targetType: metadata.targetType ?? null,
          targetId: targetId ?? null,
          description: metadata.description,
          metadata: {
            method: request.method,
            path: request.originalUrl ?? request.url,
            ...(metadata.metadataBuilder
              ? metadata.metadataBuilder(request, context)
              : {}),
          },
          ip: getClientIp(request),
          userAgent: request.headers?.['user-agent'] ?? null,
        });
      }),
    );
  }
}
