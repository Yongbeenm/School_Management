import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Prisma, ReportCardStatus } from '@school/database';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly authorization: AuthorizationService,
  ) {}

  async generate(user: AuthenticatedUser, studentId: string, semesterId: string) {
    this.authorization.assertSchoolAccess(user, 'report_card.generate');
    const schoolId = user.schoolId;
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId, deletedAt: null },
      include: { enrollments: { where: { status: 'ACTIVE' }, include: { classSection: { include: { grade: true } } } } },
    });
    if (!student) throw new NotFoundException('Student was not found');

    const semester = await this.prisma.semester.findFirst({
      where: { id: semesterId, academicYear: { schoolId } }, include: { academicYear: true },
    });
    if (!semester) throw new NotFoundException('Semester was not found');

    const [scales, marks, attendance] = await Promise.all([
      this.prisma.gradingScale.findMany({ where: { schoolId }, orderBy: { minimum: 'desc' } }),
      this.prisma.mark.findMany({
        where: { studentId, examSubject: { exam: { semesterId, schoolId, deletedAt: null } } },
        include: { examSubject: { include: { teachingAssignment: { include: { subject: true } }, exam: true } } },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['status'], where: { studentId, session: { schoolId, teachingAssignment: { semesterId } } }, _count: { _all: true },
      }),
    ]);

    const subjects = marks.map((mark) => {
      const percentage = mark.examSubject.maximumScore ? (mark.score / mark.examSubject.maximumScore) * 100 : 0;
      const scale = scales.find((item) => percentage >= item.minimum && percentage <= item.maximum);
      return { subject: mark.examSubject.teachingAssignment.subject.name, exam: mark.examSubject.exam.name, score: mark.score,
        maximumScore: mark.examSubject.maximumScore, weight: mark.examSubject.weight, percentage: Math.round(percentage * 100) / 100,
        letter: scale?.letter ?? '—', gradePoint: scale?.gradePoint ?? 0 };
    });
    const totalWeight = subjects.reduce((sum, item) => sum + item.weight, 0);
    const average = totalWeight ? subjects.reduce((sum, item) => sum + item.percentage * item.weight, 0) / totalWeight : 0;
    const gpa = totalWeight ? subjects.reduce((sum, item) => sum + item.gradePoint * item.weight, 0) / totalWeight : 0;
    const totalAttendance = attendance.reduce((sum, item) => sum + item._count._all, 0);
    const attended = (attendance.find((item) => item.status === AttendanceStatus.PRESENT)?._count._all ?? 0)
      + (attendance.find((item) => item.status === AttendanceStatus.LATE)?._count._all ?? 0);
    const currentEnrollment = student.enrollments[0];
    const payload = {
      student: { id: student.id, code: student.studentCode, name: `${student.firstName} ${student.lastName}`,
        currentClass: currentEnrollment ? `${currentEnrollment.classSection.grade.name} ${currentEnrollment.classSection.name}` : null },
      academicYear: semester.academicYear.name, semester: semester.name, subjects,
      average: Math.round(average * 100) / 100, gpa: Math.round(gpa * 100) / 100,
      attendance: { total: totalAttendance, present: attended, percentage: totalAttendance ? Math.round((attended / totalAttendance) * 10000) / 100 : 0 },
    };
    const card = await this.prisma.reportCard.upsert({
      where: { studentId_semesterId: { studentId, semesterId } },
      update: { average: payload.average, gpa: payload.gpa, payload: payload as Prisma.InputJsonValue, generatedAt: new Date() },
      create: { schoolId, studentId, semesterId, average: payload.average, gpa: payload.gpa, payload: payload as Prisma.InputJsonValue },
    });
    await this.audit.record({ schoolId, userId: user.id, action: 'REPORT_CARD_GENERATED', entityType: 'REPORT_CARD', entityId: card.id,
      newValue: { studentId, semesterId, gpa: card.gpa } });
    return card;
  }

  async list(user: AuthenticatedUser, studentId?: string, semesterId?: string) {
    const studentScope = await this.authorization.studentWhere(user, 'report_card.read');
    return this.prisma.reportCard.findMany({
      where: { schoolId: user.schoolId, student: studentScope, ...(studentId ? { studentId } : {}), ...(semesterId ? { semesterId } : {}), ...(!this.authorization.hasSchoolAccess(user, 'report_card.read') ? { status: { in: [ReportCardStatus.PUBLISHED, ReportCardStatus.APPROVED] } } : {}) },
      include: { student: true, semester: { include: { academicYear: true } } }, orderBy: { generatedAt: 'desc' },
    });
  }

  async publish(user: AuthenticatedUser, reportCardId: string) {
    this.authorization.assertSchoolAccess(user, 'report_card.publish');
    return this.setStatus(user, reportCardId, ReportCardStatus.PUBLISHED, 'REPORT_CARD_PUBLISHED');
  }

  async approve(user: AuthenticatedUser, reportCardId: string) {
    this.authorization.assertSchoolAccess(user, 'report_card.approve');
    return this.setStatus(user, reportCardId, ReportCardStatus.APPROVED, 'REPORT_CARD_APPROVED');
  }

  private async setStatus(user: AuthenticatedUser, reportCardId: string, status: ReportCardStatus, action: string) {
    const previous = await this.prisma.reportCard.findFirst({ where: { id: reportCardId, schoolId: user.schoolId } });
    if (!previous) throw new NotFoundException('Report card was not found');
    const updated = await this.prisma.reportCard.update({ where: { id: reportCardId }, data: { status, publishedAt: previous.publishedAt ?? new Date() } });
    await this.audit.record({ schoolId: user.schoolId, userId: user.id, action, entityType: 'REPORT_CARD', entityId: reportCardId, oldValue: { status: previous.status }, newValue: { status } });
    return updated;
  }
}
