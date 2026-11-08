import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { Weekday } from '@school/database';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateTimetableEntryDto {
  @IsUUID()
  teachingAssignmentId!: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsEnum(Weekday)
  dayOfWeek!: Weekday;

  @IsString()
  @Matches(timePattern, { message: 'startTime must use HH:mm format' })
  startTime!: string;

  @IsString()
  @Matches(timePattern, { message: 'endTime must use HH:mm format' })
  endTime!: string;
}

export class UpdateTimetableEntryDto {
  @IsOptional() @IsUUID()
  teachingAssignmentId?: string;

  @IsOptional() @IsUUID()
  roomId?: string;

  @IsOptional() @IsEnum(Weekday)
  dayOfWeek?: Weekday;

  @IsOptional() @IsString() @Matches(timePattern, { message: 'startTime must use HH:mm format' })
  startTime?: string;

  @IsOptional() @IsString() @Matches(timePattern, { message: 'endTime must use HH:mm format' })
  endTime?: string;
}
