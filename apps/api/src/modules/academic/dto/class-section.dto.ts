import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateClassSectionDto {
  @IsUUID()
  gradeId!: string;

  @IsUUID()
  academicYearId!: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  capacity?: number;
}

export class UpdateClassSectionDto {
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  campusId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  capacity?: number;
}
