import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@RequireRoles('ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('user.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.usersService.list(user.schoolId, query);
  }

  @Post()
  @RequirePermissions('user.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.schoolId, user.id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('user.status.update')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(user.schoolId, user.id, userId, dto, false);
  }

  @Put(':id/roles')
  @RequirePermissions('user.role.assign')
  assignRoles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') userId: string,
    @Body() dto: AssignRolesDto,
  ) {
    return this.usersService.assignRoles(user.schoolId, user.id, userId, dto.roleCodes, false);
  }
}
