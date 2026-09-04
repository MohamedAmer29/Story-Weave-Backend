import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Admin dashboard summary (users, stories, AI usage)',
  })
  async summary() {
    const data = await this.dashboardService.getSummary();
    return { success: true, data };
  }
}
