import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ExamStatus, ExamType } from '@school/database';
export class CreateExamDto { @IsUUID() semesterId!: string; @IsString() @MaxLength(150) name!: string; @IsEnum(ExamType) type!: ExamType; @IsDateString() startsOn!: string; }
export class CreateExamSubjectDto { @IsUUID() teachingAssignmentId!: string; @IsNumber() @Min(1) @Max(10000) maximumScore!: number; @IsNumber() @Min(0.01) @Max(1000) weight = 1; @IsDateString() scheduledAt!: string; }
export class UpdateExamStatusDto { @IsEnum(ExamStatus) status!: ExamStatus; }
export class UpsertMarkDto { @IsUUID() studentId!: string; @IsNumber() @Min(0) @Max(10000) score!: number; @IsOptional() @IsString() @MaxLength(1000) remarks?: string; }
export class UpsertGradingScaleDto { @IsString() @MaxLength(10) letter!: string; @IsNumber() @Min(0) @Max(100) minimum!: number; @IsNumber() @Min(0) @Max(100) maximum!: number; @IsNumber() @Min(0) @Max(4) gradePoint!: number; }
