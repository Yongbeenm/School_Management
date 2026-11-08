import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateEnrollmentDto, UpdateEnrollmentStatusDto } from './dto/create-enrollment.dto';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('Enrollments') @ApiBearerAuth()
@Controller({ path: '', version: '1' })
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get('enrollments') @RequirePermissions('enrollment.read')
  list(
    @CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto,
    @Query('academicYearId') academicYearId?: string, @Query('classSectionId') classSectionId?: string, @Query('studentId') studentId?: string,
  ) { return this.enrollmentsService.list(user, query, academicYearId, classSectionId, studentId); }

  @Post('enrollments') @RequirePermissions('enrollment.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEnrollmentDto) { return this.enrollmentsService.create(user.schoolId, user.id, dto); }

  @Patch('enrollments/:id/status') @RequirePermissions('enrollment.update')
  updateStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateEnrollmentStatusDto) { return this.enrollmentsService.updateStatus(user.schoolId, user.id, id, dto); }

  @Get('classes/:classId/students') @RequirePermissions('enrollment.read')
  classStudents(@CurrentUser() user: AuthenticatedUser, @Param('classId') classId: string, @Query() query: PaginationQueryDto) { return this.enrollmentsService.list(user, query, undefined, classId); }

  @Get('students/:studentId/enrollments') @RequirePermissions('enrollment.read')
  studentHistory(@CurrentUser() user: AuthenticatedUser, @Param('studentId') studentId: string, @Query() query: PaginationQueryDto) { return this.enrollmentsService.list(user, query, undefined, undefined, studentId); }
}
