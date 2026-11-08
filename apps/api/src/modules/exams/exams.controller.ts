import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator'; import { RequirePermissions } from '../../common/decorators/permissions.decorator'; import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ExamsService } from './exams.service'; import { CreateExamDto, CreateExamSubjectDto, UpdateExamStatusDto, UpsertGradingScaleDto, UpsertMarkDto } from './dto/exam.dto';
@ApiTags('Exams and Marks') @ApiBearerAuth() @Controller({path:'',version:'1'}) export class ExamsController { constructor(private readonly exams:ExamsService) {}
@Get('exams') @RequirePermissions('exam.read') list(@CurrentUser()u:AuthenticatedUser){return this.exams.list(u)}
@Post('exams') @RequirePermissions('exam.create') create(@CurrentUser()u:AuthenticatedUser,@Body()d:CreateExamDto){return this.exams.create(u.schoolId,u.id,d)}
@Post('exams/:id/subjects') @RequirePermissions('exam.update') subject(@CurrentUser()u:AuthenticatedUser,@Param('id')id:string,@Body()d:CreateExamSubjectDto){return this.exams.addSubject(u.schoolId,u.id,id,d)}
@Patch('exams/:id/status') @RequirePermissions('exam.update') status(@CurrentUser()u:AuthenticatedUser,@Param('id')id:string,@Body()d:UpdateExamStatusDto){return this.exams.setStatus(u.schoolId,u.id,id,d.status)}
@Post('exam-subjects/:id/marks') @RequirePermissions('mark.create') mark(@CurrentUser()u:AuthenticatedUser,@Param('id')id:string,@Body()d:UpsertMarkDto){return this.exams.upsertMark(u,id,d)}
@Get('grading-scales') @RequirePermissions('grading_scale.read') scales(@CurrentUser()u:AuthenticatedUser){return this.exams.scales(u.schoolId)}
@Post('grading-scales') @RequirePermissions('grading_scale.manage') scale(@CurrentUser()u:AuthenticatedUser,@Body()d:UpsertGradingScaleDto){return this.exams.upsertScale(u.schoolId,u.id,d)} }
