import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateRoomDto {
  @IsString() @MaxLength(40) code!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsUUID() campusId?: string;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
}

export class UpdateRoomDto {
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsUUID() campusId?: string;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
}
