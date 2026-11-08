import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AnnouncementAudience } from '@school/database';
export class CreateAnnouncementDto { @IsString() @MaxLength(200) title!: string; @IsString() @MaxLength(10000) content!: string; @IsEnum(AnnouncementAudience) audience!: AnnouncementAudience; @IsOptional() @IsUUID() classSectionId?: string; @IsOptional() @IsDateString() expiresAt?: string; }
