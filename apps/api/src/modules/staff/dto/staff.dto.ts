import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { StaffEmploymentStatus } from '@school/database';

export class CreateStaffDto {
  @IsString() @MinLength(1) @MaxLength(50) employeeCode!: string;
  @IsString() @MinLength(1) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(100) lastName!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) department?: string;
  @IsOptional() @IsEnum(StaffEmploymentStatus) employmentStatus?: StaffEmploymentStatus;
  @IsOptional() @IsDateString() hiredAt?: string;
  @IsOptional() @IsUUID() userId?: string;
}

export class UpdateStaffDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) employeeCode?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) lastName?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) department?: string;
  @IsOptional() @IsEnum(StaffEmploymentStatus) employmentStatus?: StaffEmploymentStatus;
  @IsOptional() @IsDateString() hiredAt?: string;
  @IsOptional() @IsUUID() userId?: string;
}
