import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EnrollmentStatus } from '@school/database';

export class CreateEnrollmentDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  classSectionId!: string;

  @IsUUID()
  academicYearId!: string;

  @IsOptional()
  @IsDateString()
  enrolledOn?: string;
}

export class UpdateEnrollmentStatusDto {
  @IsEnum(EnrollmentStatus)
  status!: EnrollmentStatus;

  @IsOptional()
  @IsDateString()
  leftOn?: string;
}
