import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateGradeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  sequence!: number;
}

export class UpdateGradeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  sequence?: number;
}
