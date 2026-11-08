import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString, Matches } from 'class-validator';

export class AssignRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(/^[A-Z][A-Z0-9_]{1,49}$/, { each: true })
  roleCodes!: string[];
}
