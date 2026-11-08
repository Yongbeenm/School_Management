import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';
import { TeachersService } from './teachers.service';

@ApiTags('Teachers') @ApiBearerAuth()
@Controller({ path: 'teachers', version: '1' })
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}
  @Get() @RequirePermissions('teacher.read') list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) { return this.teachersService.list(user, query); }
  @Post() @RequirePermissions('teacher.create') create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTeacherDto) { return this.teachersService.create(user.schoolId, user.id, dto); }
  @Get(':id') @RequirePermissions('teacher.read') getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.teachersService.getOne(user, id); }
  @Patch(':id') @RequirePermissions('teacher.update') update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTeacherDto) { return this.teachersService.update(user.schoolId, user.id, id, dto); }
  @Delete(':id') @HttpCode(204) @RequirePermissions('teacher.delete') archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.teachersService.archive(user.schoolId, user.id, id); }
}
