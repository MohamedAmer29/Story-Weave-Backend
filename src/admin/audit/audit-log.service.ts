import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export interface RecordAuditInput {
  adminId: string;
  adminEmail?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  description?: string | null;
  metadata?: object | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditListQuery {
  page?: number;
  limit?: number;
  adminId?: string;
  action?: string;
  actions?: string[];
  targetType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'asc' | 'desc';
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
        actorName: input.actorName ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      });
      await this.auditRepository.save(entry);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to persist audit log for ${input.action}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async findById(id: string): Promise<AuditLog | null> {
    return this.auditRepository.findOne({ where: { id } });
  }

  async list(query: AuditListQuery): Promise<{
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
    const sortDir = query.sort === 'asc' ? 'ASC' : 'DESC';

    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .orderBy('audit.createdAt', sortDir);

    if (query.adminId) {
      qb.andWhere('audit.adminId = :adminId', { adminId: query.adminId });
    }
    if (query.actions && query.actions.length) {
      qb.andWhere('audit.action IN (:...actions)', {
        actions: query.actions,
      });
    } else if (query.action) {
      qb.andWhere('audit.action = :action', { action: query.action });
    }
    if (query.targetType) {
      qb.andWhere('audit.targetType = :targetType', {
        targetType: query.targetType,
      });
    }
    if (query.dateFrom) {
      qb.andWhere('audit.createdAt >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }
    if (query.dateTo) {
      const to = new Date(query.dateTo);
      to.setHours(23, 59, 59, 999);
      qb.andWhere('audit.createdAt <= :dateTo', { dateTo: to });
    }
    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      qb.andWhere(
        '(audit.action ILIKE :s OR audit.adminEmail ILIKE :s OR audit.actorName ILIKE :s OR audit.targetType ILIKE :s OR audit.targetId ILIKE :s OR audit.description ILIKE :s)',
        { s },
      );
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
