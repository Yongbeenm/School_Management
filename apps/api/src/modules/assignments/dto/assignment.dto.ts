import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { AssignmentStatus } from '@school/database';

export class CreateAssignmentDto {
  @IsUUID() teachingAssignmentId!: string;
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsDateString() dueAt!: string;
  @IsNumber() @Min(0) @Max(10000) maxScore!: number;
  @IsOptional() @IsUUID() attachmentDocumentId?: string;
}
export class UpdateAssignmentDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(10000) maxScore?: number;
  @IsOptional() @IsUUID() attachmentDocumentId?: string;
}
export class SubmitAssignmentDto {
  @IsUUID() studentId!: string;
  @IsOptional() @IsString() @MaxLength(10000) content?: string;
  @IsOptional() @IsUUID() attachmentDocumentId?: string;
}

export class UpdateAssignmentStatusDto { @IsEnum(AssignmentStatus) status!: AssignmentStatus; }
export class GradeSubmissionDto {
  @IsNumber() @Min(0) @Max(10000) score!: number;
  @IsOptional() @IsString() @MaxLength(5000) feedback?: string;
}
