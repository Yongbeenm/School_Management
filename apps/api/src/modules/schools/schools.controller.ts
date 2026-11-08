import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolStatusDto } from './dto/update-school-status.dto';
import { SchoolsService } from './schools.service';

@ApiTags('Schools')
@ApiBearerAuth()
@Controller({ path: 'schools', version: '1' })
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  @RequirePermissions('school.read')
  @RequireRoles('SUPER_ADMIN')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.schoolsService.list(user.schoolId, query);
  }

  @Post()
  @RequirePermissions('school.manage')
  @RequireRoles('SUPER_ADMIN')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(user.schoolId, user.id, dto);
  }

  @Patch(':schoolId/status')
  @RequirePermissions('school.manage')
  @RequireRoles('SUPER_ADMIN')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Body() dto: UpdateSchoolStatusDto,
  ) {
    return this.schoolsService.updateStatus(user.schoolId, user.id, schoolId, dto.status);
  }

  @Get('current')
  @RequirePermissions('school.read')
  @RequireRoles('ADMIN')
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.schoolsService.current(user.schoolId);
  }

  @Patch('current')
  @RequirePermissions('settings.manage')
  @RequireRoles('ADMIN')
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSchoolDto) {
    return this.schoolsService.update(user.schoolId, user.id, dto);
  }
}
