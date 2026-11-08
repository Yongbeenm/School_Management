import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { TakeAttendanceDto } from './dto/attendance.dto';
import { AttendanceService } from './attendance.service';

@ApiTags('Attendance') @ApiBearerAuth()
@Controller({ path: 'attendance', version: '1' })
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}
  @Get('sessions') @RequirePermissions('attendance.read') list(@CurrentUser() user: AuthenticatedUser, @Query('teachingAssignmentId') assignmentId?: string, @Query('date') date?: string) { return this.attendance.list(user, assignmentId, date); }
  @Get('summary') @RequirePermissions('attendance.read') summary(@CurrentUser() user: AuthenticatedUser, @Query('studentId') studentId: string, @Query('semesterId') semesterId?: string) { return this.attendance.summary(user, studentId, semesterId); }
  @Post('sessions') @RequirePermissions('attendance.create') take(@CurrentUser() user: AuthenticatedUser, @Body() dto: TakeAttendanceDto) { return this.attendance.take(user, dto); }
}
