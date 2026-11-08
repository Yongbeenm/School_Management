import { SchoolStatus } from '@school/database';
import { IsEnum } from 'class-validator';

export class UpdateSchoolStatusDto {
  @IsEnum(SchoolStatus)
  status!: SchoolStatus;
}
