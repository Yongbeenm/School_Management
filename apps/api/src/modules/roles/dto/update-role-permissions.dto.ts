import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { PermissionScope } from '@school/database';

export class RolePermissionGrantDto {
  @IsString() @MaxLength(100)
  code!: string;

  @IsEnum(PermissionScope)
  scope!: PermissionScope;
}

export class UpdateRolePermissionsDto {
  /** Legacy input: defaults every supplied permission to SCHOOL scope. */
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(100, { each: true })
  permissionCodes?: string[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RolePermissionGrantDto)
  grants?: RolePermissionGrantDto[];
}
