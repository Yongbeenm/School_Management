import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { GuardianRelationship } from '@school/database';

export class LinkGuardianDto {
  @IsUUID()
  parentId!: string;

  @IsEnum(GuardianRelationship)
  relationship!: GuardianRelationship;

  @IsOptional() @IsBoolean() isPrimaryContact?: boolean;
  @IsOptional() @IsBoolean() isLegalGuardian?: boolean;
  @IsOptional() @IsBoolean() pickupAuthorized?: boolean;
}
