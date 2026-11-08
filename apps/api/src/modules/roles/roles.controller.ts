import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { PermissionScope } from '@school/database';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('role.read')
  list() {
    return this.rolesService.list();
  }

  @Post()
  @RequirePermissions('role.manage')
  @RequireRoles('SUPER_ADMIN')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(user.schoolId, user.id, dto);
  }

  @Put(':id/permissions')
  @RequirePermissions('role.manage')
  @RequireRoles('SUPER_ADMIN')
  setPermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    const grants = dto.grants ?? (dto.permissionCodes ?? []).map((code) => ({ code, scope: PermissionScope.SCHOOL }));
    return this.rolesService.setPermissions(user.schoolId, user.id, roleId, grants);
  }
}
