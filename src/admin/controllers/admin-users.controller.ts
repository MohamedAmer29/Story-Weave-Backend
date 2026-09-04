import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminUsersService } from '../services/admin-users.service';
import { AdminUserQueryDto, UpdateUserRoleDto } from '../dto/admin-query.dto';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/users')
@UseInterceptors(AuditInterceptor)
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users with filters' })
  async list(@Query() query: AdminUserQueryDto) {
    const result = await this.usersService.list(query);
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id (admin)' })
  async get(@Param('id') id: string) {
    const data = await this.usersService.getById(id);
    return { success: true, data };
  }

  @Patch(':id/role')
  @Audit({ action: 'USER_UPDATE_ROLE', targetType: 'user', targetParam: 'id' })
  @ApiOperation({ summary: 'Update a user role' })
  async updateRole(
    @CurrentUser() actor: { id: string; email?: string },
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const data = await this.usersService.updateRole(actor, id, dto.role);
    return { success: true, data };
  }

  @Patch(':id/active')
  @Audit({
    action: 'USER_SET_ACTIVE',
    targetType: 'user',
    targetParam: 'id',
  })
  @ApiOperation({ summary: 'Activate or deactivate a user' })
  async setActive(
    @CurrentUser() actor: { id: string; email?: string },
    @Param('id') id: string,
    @Body() body: { isActive: string | boolean },
  ) {
    const isActive =
      typeof body.isActive === 'string'
        ? body.isActive === 'true'
        : body.isActive === true;
    const data = await this.usersService.setActive(actor, id, isActive);
    return { success: true, data };
  }
}
