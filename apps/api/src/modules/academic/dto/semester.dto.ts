import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { SemesterStatus } from '@school/database';

export class CreateSemesterDto {
  @IsUUID()
  academicYearId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  sequence!: number;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsOptional()
  @IsEnum(SemesterStatus)
  status?: SemesterStatus;
}

export class UpdateSemesterDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  sequence?: number;

  @IsOptional()
  @IsDateString()
  startsOn?: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;

  @IsOptional()
  @IsEnum(SemesterStatus)
  status?: SemesterStatus;
}
