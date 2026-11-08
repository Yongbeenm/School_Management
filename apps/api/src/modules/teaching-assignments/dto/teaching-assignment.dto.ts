import { IsUUID } from 'class-validator';

export class CreateTeachingAssignmentDto {
  @IsUUID()
  classSectionId!: string;

  @IsUUID()
  subjectId!: string;

  @IsUUID()
  teacherId!: string;

  @IsUUID()
  semesterId!: string;
}

export class UpdateTeachingAssignmentDto {
  @IsUUID()
  teacherId!: string;
}
