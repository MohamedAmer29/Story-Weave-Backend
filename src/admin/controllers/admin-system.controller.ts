import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { AdminSystemService } from '../services/admin-system.service';
import { AuditLogService } from '../audit/audit-log.service';
import { GenerationQueryDto, AuditQueryDto } from '../dto/admin-query.dto';
import { Audit } from '../audit/audit.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/system')
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
    const data = await this.auditService.list(query);
    return { success: true, ...data };
  }
}
