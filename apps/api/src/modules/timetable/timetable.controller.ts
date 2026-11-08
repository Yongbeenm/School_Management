import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateTimetableEntryDto, UpdateTimetableEntryDto } from './dto/timetable.dto';
import { TimetableService } from './timetable.service';

@ApiTags('Timetable') @ApiBearerAuth()
@Controller({ path: 'timetable', version: '1' })
export class TimetableController {
  constructor(private readonly timetable: TimetableService) {}
  @Get() @RequirePermissions('timetable.read') list(@CurrentUser() user: AuthenticatedUser, @Query('classSectionId') classSectionId?: string, @Query('semesterId') semesterId?: string, @Query('teacherId') teacherId?: string, @Query('roomId') roomId?: string) { return this.timetable.list(user, classSectionId, semesterId, teacherId, roomId); }
  @Post() @RequirePermissions('timetable.create') create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTimetableEntryDto) { return this.timetable.create(user.schoolId, user.id, dto); }
  @Patch(':id') @RequirePermissions('timetable.update') update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTimetableEntryDto) { return this.timetable.update(user.schoolId, user.id, id, dto); }
  @Delete(':id') @HttpCode(204) @RequirePermissions('timetable.delete') archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.timetable.archive(user.schoolId, user.id, id); }
}
