import { IsString, MaxLength } from 'class-validator';

export class UpdateDocumentDto {
  @IsString()
  @MaxLength(200)
  label!: string;
}
