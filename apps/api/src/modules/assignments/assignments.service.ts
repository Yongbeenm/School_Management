import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentStatus, NotificationType, PermissionScope, Prisma, SubmissionStatus } from '@school/database';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { CreateAssignmentDto, GradeSubmissionDto, SubmitAssignmentDto, UpdateAssignmentDto } from './dto/assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogsService, private readonly authorization: AuthorizationService) {}
  async list(user: AuthenticatedUser, assignmentId?: string) {
    const where: Prisma.AssignmentWhereInput = { schoolId: user.schoolId, deletedAt: null, ...(assignmentId ? { id: assignmentId } : {}) };
    if (!this.authorization.hasSchoolAccess(user, 'assignment.read')) {
      const visibility: Prisma.AssignmentWhereInput[] = [];
      if (this.authorization.hasScope(user, 'assignment.read', PermissionScope.ASSIGNED)) visibility.push({ teachingAssignment: { teacher: { staff: { userId: user.id, schoolId: user.schoolId, deletedAt: null } } } });
      if (this.authorization.hasScope(user, 'assignment.read', PermissionScope.OWN)) visibility.push({ status: AssignmentStatus.PUBLISHED, teachingAssignment: { classSection: { enrollments: { some: { status: 'ACTIVE', student: { userId: user.id, schoolId: user.schoolId, deletedAt: null } } } } } });
      if (this.authorization.hasScope(user, 'assignment.read', PermissionScope.LINKED)) visibility.push({ status: AssignmentStatus.PUBLISHED, teachingAssignment: { classSection: { enrollments: { some: { status: 'ACTIVE', student: { guardians: { some: { parent: { userId: user.id, schoolId: user.schoolId, deletedAt: null } } } } } } } } });
      if (!visibility.length) throw new ForbiddenException('No applicable assignment scope is granted');
      where.AND = [{ OR: visibility }];
    }
    return this.prisma.assignment.findMany({ where, include: this.include(user), orderBy: { dueAt: 'asc' } });
  }
  async create(user: AuthenticatedUser, dto: CreateAssignmentDto) {
    const assignment = await this.prisma.teachingAssignment.findFirst({ where: { id: dto.teachingAssignmentId, schoolId: user.schoolId, deletedAt: null } });
    if (!assignment) throw new NotFoundException('Teaching assignment was not found');
    await this.authorization.assertTeachingAssignmentAccess(user, 'assignment.create', assignment.id);
    const created = await this.prisma.assignment.create({ data: { schoolId: user.schoolId, teachingAssignmentId: assignment.id, title: dto.title.trim(), description: dto.description?.trim(), dueAt: new Date(dto.dueAt), maxScore: dto.maxScore, attachmentDocumentId: dto.attachmentDocumentId }, include: this.include(user) });
    await this.audit.record({ schoolId: user.schoolId, userId: user.id, action: 'ASSIGNMENT_CREATED', entityType: 'ASSIGNMENT', entityId: created.id, newValue: { title: created.title, maxScore: created.maxScore } });
    return created;
  }
  async update(user: AuthenticatedUser, assignmentId: string, dto: UpdateAssignmentDto) {
    const assignment = await this.prisma.assignment.findFirst({ where: { id: assignmentId, schoolId: user.schoolId, deletedAt: null }, include: { teachingAssignment: true } });
    if (!assignment) throw new NotFoundException('Assignment was not found');
    await this.authorization.assertTeachingAssignmentAccess(user, 'assignment.update', assignment.teachingAssignmentId);
    if (dto.maxScore !== undefined && dto.maxScore < 0) throw new BadRequestException('Maximum score cannot be negative');
    const updated = await this.prisma.assignment.update({ where: { id: assignmentId }, data: { ...(dto.title ? { title: dto.title.trim() } : {}), ...(dto.description !== undefined ? { description: dto.description.trim() } : {}), ...(dto.dueAt ? { dueAt: new Date(dto.dueAt) } : {}), ...(dto.maxScore !== undefined ? { maxScore: dto.maxScore } : {}), ...(dto.attachmentDocumentId !== undefined ? { attachmentDocumentId: dto.attachmentDocumentId } : {}) }, include: this.include(user) });
    await this.audit.record({ schoolId: user.schoolId, userId: user.id, action: 'ASSIGNMENT_UPDATED', entityType: 'ASSIGNMENT', entityId: assignmentId, oldValue: { title: assignment.title, dueAt: assignment.dueAt }, newValue: { title: updated.title, dueAt: updated.dueAt } });
    return updated;
  }
  async archive(user: AuthenticatedUser, assignmentId: string) {
    const assignment = await this.prisma.assignment.findFirst({ where: { id: assignmentId, schoolId: user.schoolId, deletedAt: null }, include: { teachingAssignment: true } });
    if (!assignment) throw new NotFoundException('Assignment was not found');
    await this.authorization.assertTeachingAssignmentAccess(user, 'assignment.delete', assignment.teachingAssignmentId);
    await this.prisma.assignment.update({ where: { id: assignmentId }, data: { deletedAt: new Date(), status: AssignmentStatus.CLOSED } });
    await this.audit.record({ schoolId: user.schoolId, userId: user.id, action: 'ASSIGNMENT_ARCHIVED', entityType: 'ASSIGNMENT', entityId: assignmentId, oldValue: { title: assignment.title } });
  }
  async submit(user: AuthenticatedUser, assignmentId: string, dto: SubmitAssignmentDto) {
    const assignment = await this.prisma.assignment.findFirst({ where: { id: assignmentId, schoolId: user.schoolId, deletedAt: null }, include: { teachingAssignment: { include: { classSection: true } } } });
    if (!assignment) throw new NotFoundException('Assignment was not found');
    if (assignment.status !== AssignmentStatus.PUBLISHED) throw new ForbiddenException('This assignment is not accepting submissions');
    await this.authorization.assertStudentAccess(user, 'assignment.submit', dto.studentId);
    const enrollment = await this.prisma.enrollment.findFirst({ where: { schoolId: user.schoolId, studentId: dto.studentId, classSectionId: assignment.teachingAssignment.classSectionId, academicYearId: assignment.teachingAssignment.classSection.academicYearId, status: 'ACTIVE' } });
    if (!enrollment) throw new ForbiddenException('Student is not actively enrolled in the assigned class');
    const existing = await this.prisma.assignmentSubmission.findUnique({ where: { assignmentId_studentId: { assignmentId, studentId: dto.studentId } } });
    if (existing?.status === SubmissionStatus.GRADED) throw new BadRequestException('A graded submission cannot be replaced');
    const submittedAt = new Date(); const status = submittedAt > assignment.dueAt ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED;
    return this.prisma.assignmentSubmission.upsert({ where: { assignmentId_studentId: { assignmentId, studentId: dto.studentId } }, update: { content: dto.content?.trim(), attachmentDocumentId: dto.attachmentDocumentId, submittedAt, status, score: null, feedback: null, gradedAt: null }, create: { assignmentId, studentId: dto.studentId, content: dto.content?.trim(), attachmentDocumentId: dto.attachmentDocumentId, submittedAt, status }, include: { student: true } });
  }
  async setStatus(user: AuthenticatedUser, assignmentId: string, status: AssignmentStatus) {
    const assignment = await this.prisma.assignment.findFirst({ where: { id: assignmentId, schoolId: user.schoolId, deletedAt: null }, include: { teachingAssignment: true } });
    if (!assignment) throw new NotFoundException('Assignment was not found');
    const statusPermission = status === AssignmentStatus.PUBLISHED ? 'assignment.publish' : status === AssignmentStatus.CLOSED ? 'assignment.close' : 'assignment.update';
    await this.authorization.assertTeachingAssignmentAccess(user, statusPermission, assignment.teachingAssignmentId);
    const updated = await this.prisma.assignment.update({ where: { id: assignmentId }, data: { status, ...(status === AssignmentStatus.PUBLISHED && !assignment.publishedAt ? { publishedAt: new Date() } : {}) }, include: this.include(user) });
    if (status === AssignmentStatus.PUBLISHED && assignment.status !== AssignmentStatus.PUBLISHED) {
      const recipients = await this.prisma.student.findMany({ where: { schoolId: user.schoolId, deletedAt: null, enrollments: { some: { classSectionId: assignment.teachingAssignment.classSectionId, status: 'ACTIVE' } }, userId: { not: null } }, select: { userId: true } });
      await this.prisma.notification.createMany({ data: recipients.flatMap((student) => student.userId ? [{ userId: student.userId, title: `New assignment: ${updated.title}`, message: `Due ${updated.dueAt.toLocaleDateString()}`, type: NotificationType.ASSIGNMENT, referenceType: 'ASSIGNMENT', referenceId: updated.id }] : []), skipDuplicates: true });
    }
    await this.audit.record({ schoolId: user.schoolId, userId: user.id, action: 'ASSIGNMENT_STATUS_UPDATED', entityType: 'ASSIGNMENT', entityId: assignmentId, oldValue: { status: assignment.status }, newValue: { status } });
    return updated;
  }
  async grade(user: AuthenticatedUser, submissionId: string, dto: GradeSubmissionDto) {
    const submission = await this.prisma.assignmentSubmission.findFirst({ where: { id: submissionId, assignment: { schoolId: user.schoolId, deletedAt: null } }, include: { assignment: { include: { teachingAssignment: true } } } });
    if (!submission) throw new NotFoundException('Submission was not found');
    await this.authorization.assertTeachingAssignmentAccess(user, 'assignment.grade', submission.assignment.teachingAssignmentId);
    if (dto.score > submission.assignment.maxScore) throw new BadRequestException('Score cannot exceed the assignment maximum');
    const graded = await this.prisma.assignmentSubmission.update({ where: { id: submissionId }, data: { score: dto.score, feedback: dto.feedback?.trim(), gradedAt: new Date(), status: SubmissionStatus.GRADED }, include: { student: true } });
    await this.audit.record({ schoolId: user.schoolId, userId: user.id, action: 'ASSIGNMENT_SUBMISSION_GRADED', entityType: 'ASSIGNMENT_SUBMISSION', entityId: submissionId, newValue: { score: dto.score } });
    return graded;
  }
  private include(user: AuthenticatedUser) {
    const scopedSubmissions = this.submissionWhere(user);
    return {
      teachingAssignment: { include: { classSection: { include: { grade: true } }, subject: true, teacher: { include: { staff: true } }, semester: true } },
      submissions: { ...(scopedSubmissions ? { where: scopedSubmissions } : {}), include: { student: true }, orderBy: { submittedAt: 'desc' } },
    } satisfies Prisma.AssignmentInclude;
  }

  private submissionWhere(user: AuthenticatedUser): Prisma.AssignmentSubmissionWhereInput | undefined {
    if (this.authorization.hasSchoolAccess(user, 'assignment.read') || this.authorization.hasScope(user, 'assignment.read', PermissionScope.ASSIGNED)) return undefined;
    const alternatives: Prisma.AssignmentSubmissionWhereInput[] = [];
    if (this.authorization.hasScope(user, 'assignment.read', PermissionScope.OWN)) alternatives.push({ student: { schoolId: user.schoolId, userId: user.id, deletedAt: null } });
    if (this.authorization.hasScope(user, 'assignment.read', PermissionScope.LINKED)) alternatives.push({ student: { guardians: { some: { parent: { schoolId: user.schoolId, userId: user.id, deletedAt: null } } } } });
    return alternatives.length ? { OR: alternatives } : { id: '__unauthorized__' };
  }
}
