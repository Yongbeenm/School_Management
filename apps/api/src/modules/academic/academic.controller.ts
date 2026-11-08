import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AcademicService } from './academic.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './dto/academic-year.dto';
import { CreateClassSectionDto, UpdateClassSectionDto } from './dto/class-section.dto';
import { CreateGradeDto, UpdateGradeDto } from './dto/grade.dto';
import { CreateSemesterDto, UpdateSemesterDto } from './dto/semester.dto';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';

@ApiTags('Academic Structure')
@ApiBearerAuth()
@Controller({ path: '', version: '1' })
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Get('academic-years') @RequirePermissions('academic_year.read')
  listYears(@CurrentUser() user: AuthenticatedUser) { return this.academicService.listAcademicYears(user.schoolId); }

  @Post('academic-years') @RequirePermissions('academic_year.create')
  createYear(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAcademicYearDto) { return this.academicService.createAcademicYear(user.schoolId, user.id, dto); }

  @Patch('academic-years/:id') @RequirePermissions('academic_year.update')
  updateYear(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateAcademicYearDto) { return this.academicService.updateAcademicYear(user.schoolId, user.id, id, dto); }

  @Get('semesters') @RequirePermissions('semester.read')
  listSemesters(@CurrentUser() user: AuthenticatedUser, @Query('academicYearId') academicYearId?: string) { return this.academicService.listSemesters(user.schoolId, academicYearId); }

  @Post('semesters') @RequirePermissions('semester.create')
  createSemester(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSemesterDto) { return this.academicService.createSemester(user.schoolId, user.id, dto); }

  @Patch('semesters/:id') @RequirePermissions('semester.update')
  updateSemester(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateSemesterDto) { return this.academicService.updateSemester(user.schoolId, user.id, id, dto); }

  @Get('grades') @RequirePermissions('grade.read')
  listGrades(@CurrentUser() user: AuthenticatedUser) { return this.academicService.listGrades(user.schoolId); }

  @Post('grades') @RequirePermissions('grade.create')
  createGrade(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGradeDto) { return this.academicService.createGrade(user.schoolId, user.id, dto); }

  @Patch('grades/:id') @RequirePermissions('grade.update')
  updateGrade(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateGradeDto) { return this.academicService.updateGrade(user.schoolId, user.id, id, dto); }

  @Delete('grades/:id') @HttpCode(204) @RequirePermissions('grade.delete')
  archiveGrade(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.academicService.archiveGrade(user.schoolId, user.id, id); }

  @Get('subjects') @RequirePermissions('subject.read')
  listSubjects(@CurrentUser() user: AuthenticatedUser) { return this.academicService.listSubjects(user); }

  @Post('subjects') @RequirePermissions('subject.create')
  createSubject(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSubjectDto) { return this.academicService.createSubject(user.schoolId, user.id, dto); }

  @Patch('subjects/:id') @RequirePermissions('subject.update')
  updateSubject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateSubjectDto) { return this.academicService.updateSubject(user.schoolId, user.id, id, dto); }

  @Delete('subjects/:id') @HttpCode(204) @RequirePermissions('subject.delete')
  archiveSubject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.academicService.archiveSubject(user.schoolId, user.id, id); }

  @Get('classes') @RequirePermissions('class.read')
  listClasses(@CurrentUser() user: AuthenticatedUser, @Query('academicYearId') academicYearId?: string) { return this.academicService.listClasses(user, academicYearId); }

  @Post('classes') @RequirePermissions('class.create')
  createClass(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClassSectionDto) { return this.academicService.createClass(user.schoolId, user.id, dto); }

  @Patch('classes/:id') @RequirePermissions('class.update')
  updateClass(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateClassSectionDto) { return this.academicService.updateClass(user.schoolId, user.id, id, dto); }

  @Delete('classes/:id') @HttpCode(204) @RequirePermissions('class.delete')
  archiveClass(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.academicService.archiveClass(user.schoolId, user.id, id); }
}
