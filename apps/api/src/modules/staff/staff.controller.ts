import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

@ApiTags('Staff') @ApiBearerAuth()
@Controller({ path: 'staff', version: '1' })
export class StaffController {
  constructor(private readonly staffService: StaffService) {}
  @Get() @RequirePermissions('teacher.read') list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) { return this.staffService.list(user, query); }
  @Post() @RequirePermissions('teacher.create') create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStaffDto) { return this.staffService.create(user.schoolId, user.id, dto); }
  @Patch(':id') @RequirePermissions('teacher.update') update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateStaffDto) { return this.staffService.update(user.schoolId, user.id, id, dto); }
  @Delete(':id') @HttpCode(204) @RequirePermissions('teacher.delete') archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.staffService.archive(user.schoolId, user.id, id); }
}
