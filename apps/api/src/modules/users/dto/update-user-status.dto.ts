import { IsEnum } from 'class-validator';
import { UserStatus } from '@school/database';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
