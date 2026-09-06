import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditQueryDto } from '../dto/admin-query.dto';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { AUDIT_ACTION_CATEGORIES } from '../audit/audit-actions';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/audit')
@UseInterceptors(AuditInterceptor)
export class AuditLogsController {
  constructor(private readonly auditService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'List audit log entries' })
  async list(@Query() query: AuditQueryDto) {
    const actions = query.category
      ? (AUDIT_ACTION_CATEGORIES[
          query.category as keyof typeof AUDIT_ACTION_CATEGORIES
        ] as readonly string[])
      : undefined;
    const data = await this.auditService.list({
      ...query,
      actions: actions ? [...actions] : undefined,
    });
    return { success: true, ...data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single audit log entry' })
  async getOne(@Param('id') id: string) {
    const entry = await this.auditService.findById(id);
    if (!entry) {
      throw new NotFoundException('Audit log entry not found');
    }
    return { success: true, data: entry };
  }
}
