import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export interface RecordAuditInput {
  adminId: string;
  adminEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: object | null;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async record(input: RecordAuditInput): Promise<void> {
    try {
      const entry = this.auditRepository.create({
        adminId: input.adminId,
        adminEmail: input.adminEmail ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      });
      await this.auditRepository.save(entry);
    } catch (error: any) {
      this.logger.error(
        `Failed to persist audit log for ${input.action}: ${error?.message}`,
      );
    }
  }

  async list(query: {
    page?: number;
    limit?: number;
    adminId?: string;
    action?: string;
    targetType?: string;
  }): Promise<{
    data: AuditLog[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit =
      Number(query.limit) > 0 && Number(query.limit) <= 100
        ? Number(query.limit)
        : 20;
    const skip = (page - 1) * limit;

    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .orderBy('audit.createdAt', 'DESC');

    if (query.adminId) {
      qb.andWhere('audit.adminId = :adminId', { adminId: query.adminId });
    }
    if (query.action) {
      qb.andWhere('audit.action = :action', { action: query.action });
    }
    if (query.targetType) {
      qb.andWhere('audit.targetType = :targetType', {
        targetType: query.targetType,
      });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }
}
