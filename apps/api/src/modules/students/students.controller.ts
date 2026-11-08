import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { LinkGuardianDto } from './dto/link-guardian.dto';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { StudentsService } from './students.service';

@ApiTags('Students')
@ApiBearerAuth()
@Controller({ path: 'students', version: '1' })
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get() @RequirePermissions('student.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) { return this.studentsService.list(user, query); }

  @Post() @RequirePermissions('student.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStudentDto) { return this.studentsService.create(user.schoolId, user.id, dto); }

  @Get(':id') @RequirePermissions('student.read')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.studentsService.getOne(user, id); }

  @Patch(':id') @RequirePermissions('student.update')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateStudentDto) { return this.studentsService.update(user.schoolId, user.id, id, dto); }

  @Delete(':id') @RequirePermissions('student.delete') @HttpCode(204)
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.studentsService.archive(user.schoolId, user.id, id); }

  @Post(':id/guardians') @RequirePermissions('student.update')
  linkGuardian(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: LinkGuardianDto) { return this.studentsService.linkGuardian(user.schoolId, user.id, id, dto); }

  @Delete(':id/guardians/:parentId') @RequirePermissions('student.update') @HttpCode(204)
  unlinkGuardian(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('parentId') parentId: string) { return this.studentsService.unlinkGuardian(user.schoolId, user.id, id, parentId); }

  @Patch(':id/profile-photo/:documentId') @RequirePermissions('student.update')
  setProfilePhoto(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('documentId') documentId: string) { return this.studentsService.setProfilePhoto(user.schoolId, user.id, id, documentId); }
}
