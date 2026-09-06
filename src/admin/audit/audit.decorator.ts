import { SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuditMetadata {
  action: string;
  targetType?: string;
  targetParam?: string;
  description?: string;
  actionBuilder?: (request: Request, context: ExecutionContext) => string;
  metadataBuilder?: (
    request: Request,
    context: ExecutionContext,
  ) => Record<string, unknown>;
}

export const AUDIT_KEY = 'audit';
export const Audit = (metadata: AuditMetadata) =>
  SetMetadata(AUDIT_KEY, metadata);
