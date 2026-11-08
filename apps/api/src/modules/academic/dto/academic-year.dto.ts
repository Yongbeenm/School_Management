import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AcademicYearStatus } from '@school/database';

export class CreateAcademicYearDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  name!: string;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsOptional()
  @IsEnum(AcademicYearStatus)
  status?: AcademicYearStatus;
}

export class UpdateAcademicYearDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  name?: string;

  @IsOptional()
  @IsDateString()
  startsOn?: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;

  @IsOptional()
  @IsEnum(AcademicYearStatus)
  status?: AcademicYearStatus;
}
