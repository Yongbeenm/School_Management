import { Module } from '@nestjs/common';
import { TeachingAssignmentsController } from './teaching-assignments.controller';
import { TeachingAssignmentsService } from './teaching-assignments.service';

@Module({ controllers: [TeachingAssignmentsController], providers: [TeachingAssignmentsService] })
export class TeachingAssignmentsModule {}
