import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator'; import { RequirePermissions } from '../../common/decorators/permissions.decorator'; import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AssignmentsService } from './assignments.service'; import { CreateAssignmentDto, GradeSubmissionDto, SubmitAssignmentDto, UpdateAssignmentDto, UpdateAssignmentStatusDto } from './dto/assignment.dto';
@ApiTags('Assignments') @ApiBearerAuth() @Controller({ path: 'assignments', version: '1' })
export class AssignmentsController { constructor(private readonly assignments: AssignmentsService) {}
  @Get() @RequirePermissions('assignment.read') list(@CurrentUser() user: AuthenticatedUser, @Query('id') id?: string) { return this.assignments.list(user, id); }
  @Post() @RequirePermissions('assignment.create') create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAssignmentDto) { return this.assignments.create(user, dto); }
  @Patch(':id') @RequirePermissions('assignment.update') update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateAssignmentDto) { return this.assignments.update(user, id, dto); }
  @Delete(':id') @HttpCode(204) @RequirePermissions('assignment.delete') archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.assignments.archive(user, id); }
  @Patch(':id/status') @RequirePermissions('assignment.update') status(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateAssignmentStatusDto) { return this.assignments.setStatus(user, id, dto.status); }
  @Post(':id/submissions') @RequirePermissions('assignment.submit') submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SubmitAssignmentDto) { return this.assignments.submit(user, id, dto); }
  @Post('submissions/:id/grade') @RequirePermissions('assignment.grade') grade(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: GradeSubmissionDto) { return this.assignments.grade(user, id, dto); }
}
