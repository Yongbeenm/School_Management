import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateSchoolDto {
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_-]{1,19}$/)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsEmail()
  @MaxLength(254)
  adminEmail!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  adminFirstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  adminLastName!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  adminPassword!: string;
}
