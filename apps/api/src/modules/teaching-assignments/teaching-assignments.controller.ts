import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateTeachingAssignmentDto, UpdateTeachingAssignmentDto } from './dto/teaching-assignment.dto';
import { TeachingAssignmentsService } from './teaching-assignments.service';

@ApiTags('Teaching Assignments')
@ApiBearerAuth()
@Controller({ path: 'teaching-assignments', version: '1' })
export class TeachingAssignmentsController {
  constructor(private readonly assignments: TeachingAssignmentsService) {}

  @Get() @RequirePermissions('class_subject.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query('semesterId') semesterId?: string, @Query('classSectionId') classSectionId?: string) {
    return this.assignments.list(user, semesterId, classSectionId);
  }

  @Post() @RequirePermissions('class_subject.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTeachingAssignmentDto) {
    return this.assignments.create(user.schoolId, user.id, dto);
  }

  @Patch(':id') @RequirePermissions('class_subject.update')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTeachingAssignmentDto) {
    return this.assignments.update(user.schoolId, user.id, id, dto);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('class_subject.delete')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assignments.archive(user.schoolId, user.id, id);
  }
}
