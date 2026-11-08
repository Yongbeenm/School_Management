import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const DOCUMENT_ENTITY_TYPES = ['STUDENT', 'PARENT', 'TEACHER', 'STAFF'] as const;
export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

export class DocumentUploadDto {
  @IsIn(DOCUMENT_ENTITY_TYPES)
  entityType!: DocumentEntityType;

  @IsUUID()
  entityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
