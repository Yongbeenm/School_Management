import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ReportsService } from './reports.service';

@ApiTags('Academic Reports') @ApiBearerAuth()
@Controller({ path: 'report-cards', version: '1' })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get() @RequirePermissions('report_card.read') list(@CurrentUser() user: AuthenticatedUser, @Query('studentId') studentId?: string, @Query('semesterId') semesterId?: string) { return this.reports.list(user, studentId, semesterId); }
  @Post('generate') @RequirePermissions('report_card.generate') generate(@CurrentUser() user: AuthenticatedUser, @Query('studentId') studentId: string, @Query('semesterId') semesterId: string) { return this.reports.generate(user, studentId, semesterId); }
  @Patch(':id/publish') @RequirePermissions('report_card.publish') publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.reports.publish(user, id); }
  @Patch(':id/approve') @RequirePermissions('report_card.approve') approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.reports.approve(user, id); }
}
