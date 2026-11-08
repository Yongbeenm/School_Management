import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { AttendanceStatus } from '@school/database';

export class AttendanceRecordInputDto {
  @IsUUID()
  studentId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class TakeAttendanceDto {
  @IsUUID()
  teachingAssignmentId!: string;

  @IsDateString()
  attendanceDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordInputDto)
  records!: AttendanceRecordInputDto[];
}
