import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PermissionScope, Prisma } from '@school/database';
import { SchoolAccessService } from '../../common/services/school-access.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { CreateTeachingAssignmentDto, UpdateTeachingAssignmentDto } from './dto/teaching-assignment.dto';

@Injectable()
export class TeachingAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolAccess: SchoolAccessService,
    private readonly authorization: AuthorizationService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(user: AuthenticatedUser, semesterId?: string, classSectionId?: string) {
    const accessWhere = this.accessWhere(user, 'class_subject.read');
    return this.prisma.teachingAssignment.findMany({
      where: { schoolId: user.schoolId, deletedAt: null, ...accessWhere, ...(semesterId ? { semesterId } : {}), ...(classSectionId ? { classSectionId } : {}) },
      include: {
        classSection: { include: { grade: true, academicYear: true } },
        subject: true,
        teacher: { include: { staff: true } },
        semester: { include: { academicYear: true } },
      },
      orderBy: [{ semester: { sequence: 'asc' } }, { classSection: { name: 'asc' } }, { subject: { name: 'asc' } }],
    });
  }

  async create(schoolId: string, actorId: string, dto: CreateTeachingAssignmentDto) {
    const [classSection, subject, semester, teacher] = await Promise.all([
      this.schoolAccess.classSection(dto.classSectionId, schoolId),
      this.schoolAccess.subject(dto.subjectId, schoolId),
      this.findSemester(schoolId, dto.semesterId),
      this.findTeacher(schoolId, dto.teacherId),
    ]);
    if (classSection.academicYearId !== semester.academicYearId) {
      throw new BadRequestException('The class and semester must belong to the same academic year');
    }

    const existing = await this.prisma.teachingAssignment.findUnique({
      where: { classSectionId_subjectId_semesterId: { classSectionId: classSection.id, subjectId: subject.id, semesterId: semester.id } },
    });
    if (existing && !existing.deletedAt) throw new ConflictException('This class-subject already has a teacher for the selected semester');

    const assignment = await this.prisma.teachingAssignment.upsert({
      where: { classSectionId_subjectId_semesterId: { classSectionId: classSection.id, subjectId: subject.id, semesterId: semester.id } },
      update: { teacherId: teacher.id, deletedAt: null },
      create: { schoolId, classSectionId: classSection.id, subjectId: subject.id, teacherId: teacher.id, semesterId: semester.id },
      include: this.includeRelations(),
    });
    await this.audit(schoolId, actorId, existing ? 'TEACHING_ASSIGNMENT_RESTORED' : 'TEACHING_ASSIGNMENT_CREATED', assignment.id, existing, assignment);
    return assignment;
  }

  async update(schoolId: string, actorId: string, id: string, dto: UpdateTeachingAssignmentDto) {
    const previous = await this.findAssignment(schoolId, id);
    const teacher = await this.findTeacher(schoolId, dto.teacherId);
    const updated = await this.prisma.teachingAssignment.update({
      where: { id },
      data: { teacherId: teacher.id },
      include: this.includeRelations(),
    });
    await this.audit(schoolId, actorId, 'TEACHING_ASSIGNMENT_UPDATED', id, previous, updated);
    return updated;
  }

  async archive(schoolId: string, actorId: string, id: string): Promise<void> {
    const previous = await this.findAssignment(schoolId, id);
    const updated = await this.prisma.teachingAssignment.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(schoolId, actorId, 'TEACHING_ASSIGNMENT_ARCHIVED', id, previous, updated);
  }

  private findTeacher(schoolId: string, teacherId: string) {
    return this.prisma.teacher.findFirst({ where: { id: teacherId, staff: { schoolId, deletedAt: null } } })
      .then((teacher) => {
        if (!teacher) throw new NotFoundException('Teacher was not found');
        return teacher;
      });
  }

  private accessWhere(user: AuthenticatedUser, permission: string): Prisma.TeachingAssignmentWhereInput {
    if (this.authorization.hasSchoolAccess(user, permission)) return {};
    const alternatives: Prisma.TeachingAssignmentWhereInput[] = [];
    if (this.authorization.hasScope(user, permission, PermissionScope.ASSIGNED)) {
      alternatives.push({ teacher: { staff: { schoolId: user.schoolId, userId: user.id, deletedAt: null } } });
    }
    if (this.authorization.hasScope(user, permission, PermissionScope.OWN)) {
      alternatives.push({ classSection: { enrollments: { some: { status: 'ACTIVE', student: { schoolId: user.schoolId, userId: user.id, deletedAt: null } } } } });
    }
    if (this.authorization.hasScope(user, permission, PermissionScope.LINKED)) {
      alternatives.push({ classSection: { enrollments: { some: { status: 'ACTIVE', student: { guardians: { some: { parent: { schoolId: user.schoolId, userId: user.id, deletedAt: null } } } } } } } });
    }
    if (!alternatives.length) throw new ForbiddenException('No applicable class-subject scope is granted');
    return { OR: alternatives };
  }

  private findSemester(schoolId: string, semesterId: string) {
    return this.prisma.semester.findFirst({ where: { id: semesterId, academicYear: { schoolId } } })
      .then((semester) => {
        if (!semester) throw new NotFoundException('Semester was not found');
        return semester;
      });
  }

  private findAssignment(schoolId: string, id: string) {
    return this.prisma.teachingAssignment.findFirst({ where: { id, schoolId, deletedAt: null }, include: this.includeRelations() })
      .then((assignment) => {
        if (!assignment) throw new NotFoundException('Teaching assignment was not found');
        return assignment;
      });
  }

  private includeRelations() {
    return {
      classSection: { include: { grade: true, academicYear: true } },
      subject: true,
      teacher: { include: { staff: true } },
      semester: { include: { academicYear: true } },
    } satisfies Prisma.TeachingAssignmentInclude;
  }

  private async audit(schoolId: string, userId: string, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    await this.auditLogs.record({
      schoolId,
      userId,
      action,
      entityType: 'TEACHING_ASSIGNMENT',
      entityId,
      ...(oldValue ? { oldValue: JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue } : {}),
      ...(newValue ? { newValue: JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue } : {}),
    });
  }
}
