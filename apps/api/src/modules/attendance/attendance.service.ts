import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, PermissionScope, Prisma } from '@school/database';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { TakeAttendanceDto } from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService, private readonly auditLogs: AuditLogsService, private readonly authorization: AuthorizationService) {}

  async list(user: AuthenticatedUser, teachingAssignmentId?: string, attendanceDate?: string) {
    const scope = await this.readScope(user);
    return this.prisma.attendanceSession.findMany({
      where: { schoolId: user.schoolId, ...(teachingAssignmentId ? { teachingAssignmentId } : {}), ...(attendanceDate ? { attendanceDate: new Date(attendanceDate) } : {}), ...scope.sessionWhere },
      include: this.includeRelations(scope.recordWhere),
      orderBy: { attendanceDate: 'desc' },
    });
  }

  async take(user: AuthenticatedUser, dto: TakeAttendanceDto) {
    const assignment = await this.prisma.teachingAssignment.findFirst({
      where: { id: dto.teachingAssignmentId, schoolId: user.schoolId, deletedAt: null },
      include: { classSection: true },
    });
    if (!assignment) throw new NotFoundException('Teaching assignment was not found');
    await this.authorization.assertTeachingAssignmentAccess(user, 'attendance.create', assignment.id);

    const enrolledStudents = await this.prisma.enrollment.findMany({
      where: { schoolId: user.schoolId, classSectionId: assignment.classSectionId, academicYearId: assignment.classSection.academicYearId, status: 'ACTIVE' },
      select: { studentId: true },
    });
    const enrolledIds = new Set(enrolledStudents.map((enrollment) => enrollment.studentId));
    const submittedIds = dto.records.map((record) => record.studentId);
    if (new Set(submittedIds).size !== submittedIds.length || submittedIds.length !== enrolledIds.size || submittedIds.some((id) => !enrolledIds.has(id))) {
      throw new BadRequestException('Attendance must include every active student in the assigned class exactly once');
    }

    const date = new Date(dto.attendanceDate);
    const existing = await this.prisma.attendanceSession.findUnique({ where: { teachingAssignmentId_attendanceDate: { teachingAssignmentId: assignment.id, attendanceDate: date } } });
    const session = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.attendanceSession.upsert({
        where: { teachingAssignmentId_attendanceDate: { teachingAssignmentId: assignment.id, attendanceDate: date } },
        update: { takenByUserId: user.id, notes: dto.notes?.trim() },
        create: { schoolId: user.schoolId, teachingAssignmentId: assignment.id, takenByUserId: user.id, attendanceDate: date, notes: dto.notes?.trim() },
      });
      await tx.attendanceRecord.deleteMany({ where: { sessionId: saved.id } });
      await tx.attendanceRecord.createMany({
        data: dto.records.map((record) => ({ sessionId: saved.id, studentId: record.studentId, status: record.status, remarks: record.remarks?.trim() })),
      });
      return saved;
    });
    const result = await this.prisma.attendanceSession.findUniqueOrThrow({ where: { id: session.id }, include: this.includeRelations() });
    await this.auditLogs.record({
      schoolId: user.schoolId,
      userId: user.id,
      action: existing ? 'ATTENDANCE_UPDATED' : 'ATTENDANCE_TAKEN',
      entityType: 'ATTENDANCE_SESSION',
      entityId: session.id,
      ...(existing ? { oldValue: { attendanceDate: existing.attendanceDate } } : {}),
      newValue: { attendanceDate: date, records: dto.records.length },
    });
    return result;
  }

  async summary(user: AuthenticatedUser, studentId: string, semesterId?: string) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, schoolId: user.schoolId, deletedAt: null } });
    if (!student) throw new NotFoundException('Student was not found');
    await this.authorization.assertStudentAccess(user, 'attendance.read', studentId);
    const assignmentWhere: Prisma.TeachingAssignmentWhereInput = {
      ...(semesterId ? { semesterId } : {}),
      ...(!this.authorization.hasSchoolAccess(user, 'attendance.read') && this.authorization.hasScope(user, 'attendance.read', PermissionScope.ASSIGNED)
        ? { teacher: { staff: { userId: user.id, schoolId: user.schoolId, deletedAt: null } } } : {}),
    };
    const groups = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { studentId, session: { schoolId: user.schoolId, teachingAssignment: assignmentWhere } },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(groups.map((group) => [group.status, group._count._all])) as Partial<Record<AttendanceStatus, number>>;
    const total = groups.reduce((sum, group) => sum + group._count._all, 0);
    const attended = (counts.PRESENT ?? 0) + (counts.LATE ?? 0);
    return { studentId, total, attended, percentage: total ? Math.round((attended / total) * 10000) / 100 : 0, counts };
  }

  private async readScope(user: AuthenticatedUser): Promise<{ sessionWhere: Prisma.AttendanceSessionWhereInput; recordWhere?: Prisma.AttendanceRecordWhereInput }> {
    if (this.authorization.hasSchoolAccess(user, 'attendance.read')) return { sessionWhere: {} };
    if (this.authorization.hasScope(user, 'attendance.read', PermissionScope.ASSIGNED)) return { sessionWhere: { teachingAssignment: { teacher: { staff: { userId: user.id, schoolId: user.schoolId, deletedAt: null } } } } };
    if (this.authorization.hasScope(user, 'attendance.read', PermissionScope.OWN)) {
      const recordWhere = { student: { userId: user.id, schoolId: user.schoolId, deletedAt: null } };
      return { sessionWhere: { records: { some: recordWhere } }, recordWhere };
    }
    if (this.authorization.hasScope(user, 'attendance.read', PermissionScope.LINKED)) {
      const recordWhere = { student: { guardians: { some: { parent: { userId: user.id, schoolId: user.schoolId, deletedAt: null } } } } };
      return { sessionWhere: { records: { some: recordWhere } }, recordWhere };
    }
    throw new ForbiddenException('No applicable attendance scope is granted');
  }

  private includeRelations(recordWhere?: Prisma.AttendanceRecordWhereInput) {
    return {
      teachingAssignment: { include: { classSection: { include: { grade: true } }, subject: true, teacher: { include: { staff: true } }, semester: true } },
      takenBy: { select: { id: true, firstName: true, lastName: true } },
      records: { ...(recordWhere ? { where: recordWhere } : {}), include: { student: { select: { id: true, studentCode: true, firstName: true, lastName: true } } }, orderBy: { student: { lastName: 'asc' } } },
    } satisfies Prisma.AttendanceSessionInclude;
  }
}
