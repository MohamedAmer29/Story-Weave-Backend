import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { AdminStoriesService } from '../services/admin-stories.service';
import {
  AdminStoryQueryDto,
  FailedStoriesQueryDto,
  RetryStoryDto,
} from '../dto/admin-query.dto';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/stories')
@UseInterceptors(AuditInterceptor)
export class AdminStoriesController {
  constructor(private readonly storiesService: AdminStoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all stories with filters' })
  async list(@Query() query: AdminStoryQueryDto) {
    const result = await this.storiesService.list(query);
    return { success: true, ...result };
  }

  @Get('failed')
  @ApiOperation({ summary: 'List stories/pages with failed generations' })
  async failed(@Query() query: FailedStoriesQueryDto) {
    const result = await this.storiesService.listFailed(query);
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a story detail (admin)' })
  async get(@Param('id') id: string) {
    const data = await this.storiesService.getById(id);
    return { success: true, data };
  }

  @Delete(':id')
  @Audit({ action: 'STORY_DELETE', targetType: 'story', targetParam: 'id' })
  @ApiOperation({ summary: 'Delete a story (admin)' })
  async remove(@Param('id') id: string) {
    const result = await this.storiesService.delete(id);
    return { ...result };
  }

  @Post(':id/retry')
  @RateLimit({ ttl: 60, limit: 10 })
  @Audit({
    action: 'GENERATION_RETRY',
    targetType: 'story',
    targetParam: 'id',
  })
  @ApiOperation({ summary: 'Retry a failed generation for a story' })
  async retry(@Param('id') id: string, @Query() query: RetryStoryDto) {
    const scope = query.scope === 'cover' ? 'cover' : 'page';
    const result = await this.storiesService.retryFailed(id, scope);
    return { ...result };
  }
}
