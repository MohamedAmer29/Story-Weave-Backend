import { SetMetadata } from '@nestjs/common';

export interface AuditMetadata {
  action: string;
  targetType?: string;
  targetParam?: string;
}

export const AUDIT_KEY = 'audit';
export const Audit = (metadata: AuditMetadata) =>
  SetMetadata(AUDIT_KEY, metadata);
