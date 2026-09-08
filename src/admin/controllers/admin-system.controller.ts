import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Query,
  Delete,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { AdminSystemService } from '../services/admin-system.service';
import { AuditLogService } from '../audit/audit-log.service';
import { GenerationQueryDto, AuditQueryDto } from '../dto/admin-query.dto';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { AUDIT_ACTION_CATEGORIES } from '../audit/audit-actions';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/system')
@UseInterceptors(AuditInterceptor)
export class AdminSystemController {
  constructor(
    private readonly systemService: AdminSystemService,
    private readonly auditService: AuditLogService,
  ) {}

  @Get('queue')
  @ApiOperation({ summary: 'Get illustration queue statistics' })
  async queueStats() {
    const data = await this.systemService.getQueueStats();
    return { success: true, data };
  }

  @Get('queue/failures')
  @ApiOperation({ summary: 'Get recent queue failures' })
  async queueFailures() {
    const data = await this.systemService.getQueueFailures();
    return { success: true, data };
  }

  @Get('health')
  @ApiOperation({ summary: 'Run admin health checks (DB, Redis, queue)' })
  async health() {
    const data = await this.systemService.getHealth();
    return { success: true, data };
  }

  @Delete('sessions/others')
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: 'OTHER_USERS_SESSIONS_REVOKED',
    targetType: 'USERS',
    description: 'Revoked active sessions for all other users',
    metadataBuilder: (req) => ({
      currentSessionId:
        (req as { user?: { sessionId?: string } }).user?.sessionId ?? null,
    }),
  })
  @ApiOperation({ summary: 'Revoke sessions for all other users' })
  async revokeOtherUserSessions(
    @CurrentUser('id') adminUserId: string,
    @CurrentUser('sessionId') currentSessionId: string | undefined,
  ) {
    const result = await this.systemService.revokeOtherUserSessions(
      adminUserId,
      currentSessionId,
    );
    return { ...result, currentSessionId };
  }

  @Get('ai-usage')
  @ApiOperation({ summary: 'Get current AI / neuron usage' })
  async aiUsage() {
    const data = await this.systemService.getAiUsage();
    return { success: true, data };
  }

  @Post('ai-usage/reset')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'AI_USAGE_RESET' })
  @ApiOperation({ summary: 'Reset the daily AI usage counter' })
  async resetAiUsage() {
    const data = await this.systemService.resetAiUsage();
    return { ...data };
  }

  @Get('generations')
  @ApiOperation({ summary: 'List generation jobs / page results' })
  async generations(@Query() query: GenerationQueryDto) {
    const data = await this.systemService.getGenerationList(query);
    return { success: true, ...data };
  }

  @Get('audit')
  @ApiOperation({ summary: 'List audit log entries' })
  async audit(@Query() query: AuditQueryDto) {
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
}
