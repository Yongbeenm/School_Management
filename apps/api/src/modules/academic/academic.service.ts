import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AcademicYearStatus, PermissionScope, Prisma, SemesterStatus } from '@school/database';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { SchoolAccessService } from '../../common/services/school-access.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './dto/academic-year.dto';
import { CreateClassSectionDto, UpdateClassSectionDto } from './dto/class-section.dto';
import { CreateGradeDto, UpdateGradeDto } from './dto/grade.dto';
import { CreateSemesterDto, UpdateSemesterDto } from './dto/semester.dto';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';

@Injectable()
export class AcademicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolAccess: SchoolAccessService,
    private readonly auditLogs: AuditLogsService,
    private readonly authorization: AuthorizationService,
  ) {}

  listAcademicYears(schoolId: string) {
    return this.prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startsOn: 'desc' },
      include: { _count: { select: { classes: true, enrollments: true, semesters: true } } },
    });
  }

  async createAcademicYear(schoolId: string, actorId: string, dto: CreateAcademicYearDto) {
    this.assertDateRange(dto.startsOn, dto.endsOn, 'Academic year');
    const existing = await this.prisma.academicYear.findFirst({ where: { schoolId, name: dto.name.trim() } });
    if (existing) throw new ConflictException('An academic year with this name already exists');

    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.status === AcademicYearStatus.ACTIVE) {
        await tx.academicYear.updateMany({
          where: { schoolId, status: AcademicYearStatus.ACTIVE },
          data: { status: AcademicYearStatus.CLOSED },
        });
      }
      return tx.academicYear.create({
        data: {
          schoolId,
          name: dto.name.trim(),
          startsOn: new Date(dto.startsOn),
          endsOn: new Date(dto.endsOn),
          status: dto.status ?? AcademicYearStatus.DRAFT,
        },
      });
    });
    await this.audit(schoolId, actorId, 'ACADEMIC_YEAR_CREATED', 'ACADEMIC_YEAR', created.id, undefined, created);
    return created;
  }

  async updateAcademicYear(schoolId: string, actorId: string, id: string, dto: UpdateAcademicYearDto) {
    const previous = await this.schoolAccess.academicYear(id, schoolId);
    const startsOn = dto.startsOn ?? previous.startsOn.toISOString();
    const endsOn = dto.endsOn ?? previous.endsOn.toISOString();
    this.assertDateRange(startsOn, endsOn, 'Academic year');

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.status === AcademicYearStatus.ACTIVE) {
        await tx.academicYear.updateMany({
          where: { schoolId, status: AcademicYearStatus.ACTIVE, id: { not: id } },
          data: { status: AcademicYearStatus.CLOSED },
        });
      }
      return tx.academicYear.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.startsOn ? { startsOn: new Date(dto.startsOn) } : {}),
          ...(dto.endsOn ? { endsOn: new Date(dto.endsOn) } : {}),
          ...(dto.status ? { status: dto.status } : {}),
        },
      });
    });
    await this.audit(schoolId, actorId, 'ACADEMIC_YEAR_UPDATED', 'ACADEMIC_YEAR', id, previous, updated);
    return updated;
  }

  async listSemesters(schoolId: string, academicYearId?: string) {
    if (academicYearId) await this.schoolAccess.academicYear(academicYearId, schoolId);
    return this.prisma.semester.findMany({
      where: { academicYear: { schoolId }, ...(academicYearId ? { academicYearId } : {}) },
      include: { academicYear: { select: { id: true, name: true, status: true } } },
      orderBy: [{ academicYear: { startsOn: 'desc' } }, { sequence: 'asc' }],
    });
  }

  async createSemester(schoolId: string, actorId: string, dto: CreateSemesterDto) {
    const academicYear = await this.schoolAccess.academicYear(dto.academicYearId, schoolId);
    this.assertDateRange(dto.startsOn, dto.endsOn, 'Semester');
    if (new Date(dto.startsOn) < academicYear.startsOn || new Date(dto.endsOn) > academicYear.endsOn) {
      throw new BadRequestException('Semester dates must be within the academic year');
    }
    const existing = await this.prisma.semester.findFirst({
      where: { academicYearId: dto.academicYearId, sequence: dto.sequence },
    });
    if (existing) throw new ConflictException('A semester with this sequence already exists');

    const created = await this.prisma.semester.create({
      data: {
        academicYearId: dto.academicYearId,
        name: dto.name.trim(),
        sequence: dto.sequence,
        startsOn: new Date(dto.startsOn),
        endsOn: new Date(dto.endsOn),
        status: dto.status ?? SemesterStatus.DRAFT,
      },
    });
    await this.audit(schoolId, actorId, 'SEMESTER_CREATED', 'SEMESTER', created.id, undefined, created);
    return created;
  }

  async updateSemester(schoolId: string, actorId: string, id: string, dto: UpdateSemesterDto) {
    const previous = await this.prisma.semester.findFirst({ where: { id, academicYear: { schoolId } }, include: { academicYear: true } });
    if (!previous) throw new NotFoundException('Semester was not found');
    const startsOn = dto.startsOn ?? previous.startsOn.toISOString();
    const endsOn = dto.endsOn ?? previous.endsOn.toISOString();
    this.assertDateRange(startsOn, endsOn, 'Semester');
    if (new Date(startsOn) < previous.academicYear.startsOn || new Date(endsOn) > previous.academicYear.endsOn) {
      throw new BadRequestException('Semester dates must be within the academic year');
    }
    const updated = await this.prisma.semester.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.sequence ? { sequence: dto.sequence } : {}),
        ...(dto.startsOn ? { startsOn: new Date(dto.startsOn) } : {}),
        ...(dto.endsOn ? { endsOn: new Date(dto.endsOn) } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
    await this.audit(schoolId, actorId, 'SEMESTER_UPDATED', 'SEMESTER', id, previous, updated);
    return updated;
  }

  listGrades(schoolId: string) {
    return this.prisma.grade.findMany({ where: { schoolId, deletedAt: null }, orderBy: { sequence: 'asc' } });
  }

  async createGrade(schoolId: string, actorId: string, dto: CreateGradeDto) {
    const exists = await this.prisma.grade.findFirst({ where: { schoolId, OR: [{ code: dto.code.trim() }, { sequence: dto.sequence }] } });
    if (exists) throw new ConflictException('Grade code or sequence already exists');
    const created = await this.prisma.grade.create({ data: { schoolId, code: dto.code.trim(), name: dto.name.trim(), sequence: dto.sequence } });
    await this.audit(schoolId, actorId, 'GRADE_CREATED', 'GRADE', created.id, undefined, created);
    return created;
  }

  async updateGrade(schoolId: string, actorId: string, id: string, dto: UpdateGradeDto) {
    const previous = await this.schoolAccess.grade(id, schoolId);
    const updated = await this.prisma.grade.update({
      where: { id },
      data: { ...(dto.code ? { code: dto.code.trim() } : {}), ...(dto.name ? { name: dto.name.trim() } : {}), ...(dto.sequence ? { sequence: dto.sequence } : {}) },
    });
    await this.audit(schoolId, actorId, 'GRADE_UPDATED', 'GRADE', id, previous, updated);
    return updated;
  }

  async archiveGrade(schoolId: string, actorId: string, id: string): Promise<void> {
    const previous = await this.schoolAccess.grade(id, schoolId);
    const activeClasses = await this.prisma.classSection.count({ where: { gradeId: id, deletedAt: null } });
    if (activeClasses) throw new ConflictException('Archive or move this grade’s class sections before archiving the grade');
    const updated = await this.prisma.grade.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(schoolId, actorId, 'GRADE_ARCHIVED', 'GRADE', id, previous, updated);
  }

  listSubjects(user: AuthenticatedUser) {
    return this.prisma.subject.findMany({ where: this.subjectReadWhere(user), orderBy: { name: 'asc' } });
  }

  async createSubject(schoolId: string, actorId: string, dto: CreateSubjectDto) {
    const exists = await this.prisma.subject.findFirst({ where: { schoolId, code: dto.code.trim() } });
    if (exists) throw new ConflictException('Subject code already exists');
    const created = await this.prisma.subject.create({ data: { schoolId, code: dto.code.trim(), name: dto.name.trim(), description: dto.description?.trim() } });
    await this.audit(schoolId, actorId, 'SUBJECT_CREATED', 'SUBJECT', created.id, undefined, created);
    return created;
  }

  async updateSubject(schoolId: string, actorId: string, id: string, dto: UpdateSubjectDto) {
    const previous = await this.schoolAccess.subject(id, schoolId);
    const updated = await this.prisma.subject.update({
      where: { id },
      data: { ...(dto.code ? { code: dto.code.trim() } : {}), ...(dto.name ? { name: dto.name.trim() } : {}), ...(dto.description !== undefined ? { description: dto.description.trim() } : {}) },
    });
    await this.audit(schoolId, actorId, 'SUBJECT_UPDATED', 'SUBJECT', id, previous, updated);
    return updated;
  }

  async archiveSubject(schoolId: string, actorId: string, id: string): Promise<void> {
    const previous = await this.schoolAccess.subject(id, schoolId);
    const updated = await this.prisma.subject.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(schoolId, actorId, 'SUBJECT_ARCHIVED', 'SUBJECT', id, previous, updated);
  }

  listClasses(user: AuthenticatedUser, academicYearId?: string) {
    return this.prisma.classSection.findMany({
      where: { ...this.classReadWhere(user), ...(academicYearId ? { academicYearId } : {}) },
      include: { grade: true, academicYear: true, campus: true, _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } } },
      orderBy: [{ academicYear: { startsOn: 'desc' } }, { grade: { sequence: 'asc' } }, { name: 'asc' }],
    });
  }

  async createClass(schoolId: string, actorId: string, dto: CreateClassSectionDto) {
    await Promise.all([this.schoolAccess.grade(dto.gradeId, schoolId), this.schoolAccess.academicYear(dto.academicYearId, schoolId)]);
    if (dto.campusId) {
      const campus = await this.prisma.campus.findFirst({ where: { id: dto.campusId, schoolId, deletedAt: null } });
      if (!campus) throw new NotFoundException('Campus was not found');
    }
    const exists = await this.prisma.classSection.findFirst({ where: { academicYearId: dto.academicYearId, gradeId: dto.gradeId, name: dto.name.trim() } });
    if (exists) throw new ConflictException('A class with this name already exists for the grade and year');
    const created = await this.prisma.classSection.create({
      data: { schoolId, gradeId: dto.gradeId, academicYearId: dto.academicYearId, campusId: dto.campusId, name: dto.name.trim(), capacity: dto.capacity },
      include: { grade: true, academicYear: true },
    });
    await this.audit(schoolId, actorId, 'CLASS_CREATED', 'CLASS_SECTION', created.id, undefined, created);
    return created;
  }

  async updateClass(schoolId: string, actorId: string, id: string, dto: UpdateClassSectionDto) {
    const previous = await this.schoolAccess.classSection(id, schoolId);
    if (dto.gradeId) await this.schoolAccess.grade(dto.gradeId, schoolId);
    if (dto.campusId) {
      const campus = await this.prisma.campus.findFirst({ where: { id: dto.campusId, schoolId, deletedAt: null } });
      if (!campus) throw new NotFoundException('Campus was not found');
    }
    const updated = await this.prisma.classSection.update({
      where: { id },
      data: {
        ...(dto.gradeId ? { gradeId: dto.gradeId } : {}),
        ...(dto.campusId ? { campusId: dto.campusId } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      },
      include: { grade: true, academicYear: true },
    });
    await this.audit(schoolId, actorId, 'CLASS_UPDATED', 'CLASS_SECTION', id, previous, updated);
    return updated;
  }

  async archiveClass(schoolId: string, actorId: string, id: string): Promise<void> {
    const previous = await this.schoolAccess.classSection(id, schoolId);
    const activeEnrollments = await this.prisma.enrollment.count({ where: { classSectionId: id, status: 'ACTIVE' } });
    if (activeEnrollments) throw new ConflictException('End or transfer active enrollments before archiving this class');
    const updated = await this.prisma.classSection.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(schoolId, actorId, 'CLASS_ARCHIVED', 'CLASS_SECTION', id, previous, updated);
  }

  private assertDateRange(start: string, end: string, label: string): void {
    if (new Date(start) >= new Date(end)) throw new BadRequestException(`${label} start date must be before its end date`);
  }

  private subjectReadWhere(user: AuthenticatedUser): Prisma.SubjectWhereInput {
    if (this.authorization.hasSchoolAccess(user, 'subject.read')) return { schoolId: user.schoolId, deletedAt: null };
    if (this.authorization.hasScope(user, 'subject.read', PermissionScope.ASSIGNED)) {
      return { schoolId: user.schoolId, deletedAt: null, teachingAssignments: { some: { deletedAt: null, teacher: { staff: { schoolId: user.schoolId, userId: user.id, deletedAt: null } } } } };
    }
    throw new ForbiddenException('No applicable subject scope is granted');
  }

  private classReadWhere(user: AuthenticatedUser): Prisma.ClassSectionWhereInput {
    if (this.authorization.hasSchoolAccess(user, 'class.read')) return { schoolId: user.schoolId, deletedAt: null };
    if (this.authorization.hasScope(user, 'class.read', PermissionScope.ASSIGNED)) {
      return { schoolId: user.schoolId, deletedAt: null, teachingAssignments: { some: { deletedAt: null, teacher: { staff: { schoolId: user.schoolId, userId: user.id, deletedAt: null } } } } };
    }
    throw new ForbiddenException('No applicable class scope is granted');
  }

  private async audit(schoolId: string, userId: string, action: string, entityType: string, entityId: string, oldValue: unknown, newValue: unknown) {
    await this.auditLogs.record({
      schoolId,
      userId,
      action,
      entityType,
      entityId,
      ...(oldValue ? { oldValue: JSON.parse(JSON.stringify(oldValue)) as never } : {}),
      newValue: JSON.parse(JSON.stringify(newValue)) as never,
    });
  }
}
