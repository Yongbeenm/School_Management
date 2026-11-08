import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}
  @Get('admin')
  @RequirePermissions('dashboard.read')
  admin(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.adminSummary(user.schoolId);
  }

  @Get('super-admin')
  @RequirePermissions('dashboard.read')
  @RequireRoles('SUPER_ADMIN')
  superAdmin(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.superAdminSummary(user.schoolId);
  }

  @Get('principal')
  @RequirePermissions('dashboard.read')
  @RequireRoles('PRINCIPAL')
  principal(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.principalSummary(user.schoolId);
  }

  @Get('teacher')
  @RequirePermissions('portal.read')
  teacher(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.teacherSummary(user.schoolId, user.id);
  }

  @Get('student')
  @RequirePermissions('portal.read')
  student(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.studentSummary(user.schoolId, user.id);
  }

  @Get('parent')
  @RequirePermissions('portal.read')
  parent(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.parentSummary(user.schoolId, user.id);
  }
}
