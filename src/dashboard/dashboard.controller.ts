import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a compact dashboard overview for the user' })
  @ApiResponse({ status: 200, description: 'Dashboard overview' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDashboard(@CurrentUser('id') userId: string) {
    const data = await this.dashboardService.getDashboard(userId);
    return { success: true, data };
  }
}
