import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AcademicYearStatus,
  EnrollmentStatus,
  ExamStatus,
  FeeCurrency,
  Prisma,
  ReportCardStatus,
  StaffEmploymentStatus,
} from '@school/database';
import { PrismaService } from '../../database/prisma.service';

type FinancialRollupRow = {
  schoolId: string;
  currency: FeeCurrency;
  billed: Prisma.Decimal;
  collected: Prisma.Decimal;
  outstanding: Prisma.Decimal;
  overdue: Prisma.Decimal;
  chargeCount: bigint;
};

type CollectionTrendRow = {
  month: Date;
  currency: FeeCurrency;
  amount: Prisma.Decimal;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async adminSummary(schoolId: string) {
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, status: AcademicYearStatus.ACTIVE },
    });
    const [students, teachers, classes, activeEnrollments, recentStudents] =
      await this.prisma.$transaction([
        this.prisma.student.count({ where: { schoolId, deletedAt: null, status: 'ACTIVE' } }),
        this.prisma.teacher.count({
          where: {
            staff: { schoolId, deletedAt: null, employmentStatus: StaffEmploymentStatus.ACTIVE },
          },
        }),
        this.prisma.classSection.count({
          where: {
            schoolId,
            deletedAt: null,
            ...(activeYear ? { academicYearId: activeYear.id } : {}),
          },
        }),
        this.prisma.enrollment.count({
          where: {
            schoolId,
            status: EnrollmentStatus.ACTIVE,
            ...(activeYear ? { academicYearId: activeYear.id } : {}),
          },
        }),
        this.prisma.student.findMany({
          where: { schoolId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, studentCode: true, firstName: true, lastName: true, createdAt: true },
        }),
      ]);
    const sections = await this.prisma.classSection.findMany({
      where: {
        schoolId,
        deletedAt: null,
        ...(activeYear ? { academicYearId: activeYear.id } : {}),
      },
      include: {
        grade: true,
        _count: { select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } } } },
      },
      orderBy: [{ grade: { sequence: 'asc' } }, { name: 'asc' }],
    });
    const classCounts = sections.map((section) => ({
      classId: section.id,
      className: `${section.grade.name} ${section.name}`,
      enrolledStudents: section._count.enrollments,
    }));
    return {
      activeAcademicYear: activeYear,
      stats: { students, teachers, classes, activeEnrollments },
      recentStudents,
      classCounts,
    };
  }

  async superAdminSummary(schoolId: string) {
    const [
      platform,
      platformSchools,
      activeSchools,
      userAccounts,
      activeUserAccounts,
      students,
      staff,
      schoolAdmins,
      roles,
      financialRows,
      collectionTrendRows,
      recentActivity,
    ] = await Promise.all([
      this.prisma.school.findUnique({
        where: { id: schoolId },
        select: { organization: { select: { id: true, name: true } } },
      }),
      this.prisma.school.findMany({
        where: { deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              userSchools: { where: { user: { deletedAt: null } } },
              students: { where: { deletedAt: null } },
              staff: { where: { deletedAt: null } },
              enrollments: { where: { status: EnrollmentStatus.ACTIVE } },
            },
          },
          userRoles: {
            where: {
              role: { code: 'ADMIN' },
              user: { deletedAt: null, status: 'ACTIVE' },
            },
            take: 1,
            select: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
        },
      }),
      this.prisma.school.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.user.count({
        where: { deletedAt: null, schoolMemberships: { some: { school: { deletedAt: null } } } },
      }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          schoolMemberships: { some: { school: { deletedAt: null } } },
        },
      }),
      this.prisma.student.count({ where: { deletedAt: null } }),
      this.prisma.staff.count({ where: { deletedAt: null } }),
      this.prisma.userRole.count({
        where: {
          role: { code: 'ADMIN' },
          user: { deletedAt: null, status: 'ACTIVE' },
          school: { deletedAt: null },
        },
      }),
      this.prisma.role.count(),
      this.prisma.$queryRaw<FinancialRollupRow[]>(Prisma.sql`
          WITH payment_totals AS (
            SELECT "chargeId", SUM(amount) AS paid
            FROM "FeePayment"
            WHERE "voidedAt" IS NULL
            GROUP BY "chargeId"
          )
          SELECT
            charge."schoolId" AS "schoolId",
            charge.currency::text AS currency,
            COALESCE(SUM(charge.amount), 0) AS billed,
            COALESCE(SUM(LEAST(charge.amount, COALESCE(payment.paid, 0))), 0) AS collected,
            COALESCE(SUM(GREATEST(charge.amount - COALESCE(payment.paid, 0), 0)), 0) AS outstanding,
            COALESCE(SUM(
              CASE WHEN charge."dueOn" < CURRENT_DATE
                THEN GREATEST(charge.amount - COALESCE(payment.paid, 0), 0)
                ELSE 0
              END
            ), 0) AS overdue,
            COUNT(*)::bigint AS "chargeCount"
          FROM "FeeCharge" AS charge
          LEFT JOIN payment_totals AS payment ON payment."chargeId" = charge.id
          WHERE charge."voidedAt" IS NULL
          GROUP BY charge."schoolId", charge.currency
        `),
      this.prisma.$queryRaw<CollectionTrendRow[]>(Prisma.sql`
          SELECT
            DATE_TRUNC('month', payment."receivedOn") AS month,
            charge.currency::text AS currency,
            COALESCE(SUM(payment.amount), 0) AS amount
          FROM "FeePayment" AS payment
          INNER JOIN "FeeCharge" AS charge ON charge.id = payment."chargeId"
          WHERE payment."voidedAt" IS NULL
            AND charge."voidedAt" IS NULL
            AND payment."receivedOn" >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
          GROUP BY DATE_TRUNC('month', payment."receivedOn"), charge.currency
          ORDER BY month ASC
        `),
      this.prisma.auditLog.findMany({
        where: {
          action: {
            in: [
              'SCHOOL_CREATED',
              'SCHOOL_STATUS_CHANGED',
              'ROLE_CREATED',
              'ROLE_PERMISSIONS_CHANGED',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
          school: { select: { name: true, code: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const currencies = Object.values(FeeCurrency);
    const financialBySchool = new Map(
      financialRows.map((row) => [`${row.schoolId}:${row.currency}`, row]),
    );
    const formatAmount = (value: Prisma.Decimal | number) => Number(value).toFixed(2);
    const buildFinance = (targetSchoolId?: string) =>
      currencies.map((currency) => {
        const rows = targetSchoolId
          ? [financialBySchool.get(`${targetSchoolId}:${currency}`)].filter(
              (row): row is FinancialRollupRow => Boolean(row),
            )
          : financialRows.filter((row) => row.currency === currency);
        const billed = rows.reduce((total, row) => total + Number(row.billed), 0);
        const collected = rows.reduce((total, row) => total + Number(row.collected), 0);
        const outstanding = rows.reduce((total, row) => total + Number(row.outstanding), 0);
        const overdue = rows.reduce((total, row) => total + Number(row.overdue), 0);
        const chargeCount = rows.reduce((total, row) => total + Number(row.chargeCount), 0);
        return {
          currency,
          billed: formatAmount(billed),
          collected: formatAmount(collected),
          outstanding: formatAmount(outstanding),
          overdue: formatAmount(overdue),
          chargeCount,
          collectionRate: billed ? ((collected / billed) * 100).toFixed(1) : '0.0',
        };
      });

    const monthStarts = Array.from({ length: 6 }, (_, index) => {
      const value = new Date();
      value.setUTCDate(1);
      value.setUTCHours(0, 0, 0, 0);
      value.setUTCMonth(value.getUTCMonth() - (5 - index));
      return value.toISOString().slice(0, 7);
    });

    return {
      platform: platform?.organization ?? null,
      generatedAt: new Date().toISOString(),
      stats: {
        schools: platformSchools.length,
        activeSchools,
        userAccounts,
        activeUserAccounts,
        students,
        staff,
        schoolAdmins,
        roles,
      },
      finance: buildFinance(),
      collectionTrend: currencies.map((currency) => ({
        currency,
        points: monthStarts.map((month) => ({
          month,
          amount: formatAmount(
            collectionTrendRows
              .filter(
                (row) => row.currency === currency && row.month.toISOString().slice(0, 7) === month,
              )
              .reduce((total, row) => total + Number(row.amount), 0),
          ),
        })),
      })),
      schoolPerformance: platformSchools.map(({ userRoles, ...school }) => ({
        ...school,
        administrator: userRoles[0]?.user ?? null,
        finance: buildFinance(school.id),
      })),
      recentSchools: platformSchools.slice(0, 5).map(({ userRoles, ...school }) => ({
        ...school,
        administrator: userRoles[0]?.user ?? null,
      })),
      recentActivity,
    };
  }

  async principalSummary(schoolId: string) {
    const weekStart = new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    weekStart.setUTCHours(0, 0, 0, 0);
    const [
      school,
      pendingApprovals,
      approvedCards,
      scheduledExams,
      completedExams,
      attendanceGroups,
      reportCards,
      upcomingExams,
    ] = await Promise.all([
      this.adminSummary(schoolId),
      this.prisma.reportCard.count({ where: { schoolId, status: ReportCardStatus.PUBLISHED } }),
      this.prisma.reportCard.count({ where: { schoolId, status: ReportCardStatus.APPROVED } }),
      this.prisma.exam.count({
        where: { schoolId, deletedAt: null, status: ExamStatus.SCHEDULED },
      }),
      this.prisma.exam.count({
        where: { schoolId, deletedAt: null, status: ExamStatus.COMPLETED },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { session: { schoolId, attendanceDate: { gte: weekStart } } },
        _count: { _all: true },
      }),
      this.prisma.reportCard.findMany({
        where: { schoolId, status: ReportCardStatus.PUBLISHED },
        orderBy: { generatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          gpa: true,
          average: true,
          student: { select: { firstName: true, lastName: true, studentCode: true } },
          semester: { select: { name: true } },
        },
      }),
      this.prisma.exam.findMany({
        where: {
          schoolId,
          deletedAt: null,
          status: ExamStatus.SCHEDULED,
          startsOn: { gte: new Date() },
        },
        orderBy: { startsOn: 'asc' },
        take: 5,
        select: { id: true, name: true, startsOn: true },
      }),
    ]);
    const attendanceTotal = attendanceGroups.reduce((sum, group) => sum + group._count._all, 0);
    const present = attendanceGroups
      .filter((group) => group.status === 'PRESENT' || group.status === 'LATE')
      .reduce((sum, group) => sum + group._count._all, 0);
    return {
      school: { activeAcademicYear: school.activeAcademicYear, stats: school.stats },
      stats: {
        pendingApprovals,
        approvedCards,
        scheduledExams,
        completedExams,
        attendanceRecords: attendanceTotal,
        attendanceRate: attendanceTotal ? Math.round((present / attendanceTotal) * 100) : null,
      },
      reportCards,
      upcomingExams,
    };
  }

  async teacherSummary(schoolId: string, userId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { staff: { schoolId, userId, deletedAt: null } },
      include: { staff: true },
    });
    if (!teacher) throw new NotFoundException('No teacher profile is linked to this account');
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { schoolId, teacherId: teacher.id, deletedAt: null, semester: { status: 'ACTIVE' } },
      include: { classSection: { include: { grade: true } }, subject: true, semester: true },
      orderBy: [{ classSection: { grade: { sequence: 'asc' } } }, { subject: { name: 'asc' } }],
    });
    const assignmentIds = assignments.map((item) => item.id);
    const [timetable, upcomingAssignments, pendingSubmissions, attendanceSessions] =
      await Promise.all([
        this.prisma.timetableEntry.findMany({
          where: { schoolId, teachingAssignmentId: { in: assignmentIds }, deletedAt: null },
          include: {
            room: true,
            teachingAssignment: {
              include: { classSection: { include: { grade: true } }, subject: true },
            },
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        }),
        this.prisma.assignment.findMany({
          where: {
            schoolId,
            teachingAssignmentId: { in: assignmentIds },
            deletedAt: null,
            dueAt: { gte: new Date() },
          },
          orderBy: { dueAt: 'asc' },
          take: 8,
          include: {
            teachingAssignment: {
              include: { subject: true, classSection: { include: { grade: true } } },
            },
          },
        }),
        this.prisma.assignmentSubmission.count({
          where: {
            assignment: { schoolId, teachingAssignmentId: { in: assignmentIds }, deletedAt: null },
            status: { not: 'GRADED' },
          },
        }),
        this.prisma.attendanceSession.count({
          where: { schoolId, teachingAssignmentId: { in: assignmentIds } },
        }),
      ]);
    return {
      profile: {
        id: teacher.id,
        name: `${teacher.staff.firstName} ${teacher.staff.lastName}`,
        employeeCode: teacher.staff.employeeCode,
      },
      assignments,
      timetable,
      upcomingAssignments,
      stats: {
        assignedClasses: new Set(assignments.map((item) => item.classSectionId)).size,
        assignedSubjects: assignments.length,
        pendingSubmissions,
        attendanceSessions,
      },
    };
  }

  async studentSummary(schoolId: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { schoolId, userId, deletedAt: null },
      include: {
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          include: { classSection: { include: { grade: true } } },
        },
      },
    });
    if (!student) throw new NotFoundException('No student profile is linked to this account');
    const enrollment = student.enrollments[0];
    const classSectionId = enrollment?.classSectionId;
    const [timetable, assignments, marks, reportCards, attendanceGroups] = await Promise.all([
      classSectionId
        ? this.prisma.timetableEntry.findMany({
            where: { schoolId, deletedAt: null, teachingAssignment: { classSectionId } },
            include: { room: true, teachingAssignment: { include: { subject: true } } },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          })
        : [],
      classSectionId
        ? this.prisma.assignment.findMany({
            where: {
              schoolId,
              deletedAt: null,
              status: 'PUBLISHED',
              teachingAssignment: { classSectionId },
              dueAt: { gte: new Date() },
            },
            include: {
              teachingAssignment: { include: { subject: true } },
              submissions: { where: { studentId: student.id } },
            },
            orderBy: { dueAt: 'asc' },
            take: 10,
          })
        : [],
      this.prisma.mark.findMany({
        where: { studentId: student.id, examSubject: { exam: { status: ExamStatus.PUBLISHED } } },
        include: {
          examSubject: {
            include: { exam: true, teachingAssignment: { include: { subject: true } } },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 12,
      }),
      this.prisma.reportCard.findMany({
        where: {
          schoolId,
          studentId: student.id,
          status: { in: [ReportCardStatus.PUBLISHED, ReportCardStatus.APPROVED] },
        },
        include: { semester: { include: { academicYear: true } } },
        orderBy: { generatedAt: 'desc' },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { studentId: student.id },
        _count: { _all: true },
      }),
    ]);
    const attendanceTotal = attendanceGroups.reduce((sum, item) => sum + item._count._all, 0);
    const attended =
      (attendanceGroups.find((item) => item.status === 'PRESENT')?._count._all ?? 0) +
      (attendanceGroups.find((item) => item.status === 'LATE')?._count._all ?? 0);
    return {
      profile: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        studentCode: student.studentCode,
        className: enrollment
          ? `${enrollment.classSection.grade.name} ${enrollment.classSection.name}`
          : null,
      },
      timetable,
      assignments,
      marks,
      reportCards,
      attendance: {
        total: attendanceTotal,
        percentage: attendanceTotal ? Math.round((attended / attendanceTotal) * 10000) / 100 : 0,
        counts: Object.fromEntries(attendanceGroups.map((item) => [item.status, item._count._all])),
      },
    };
  }

  async parentSummary(schoolId: string, userId: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { schoolId, userId, deletedAt: null },
      include: {
        students: {
          include: {
            student: {
              include: {
                enrollments: {
                  where: { status: EnrollmentStatus.ACTIVE },
                  include: { classSection: { include: { grade: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!parent) throw new NotFoundException('No parent profile is linked to this account');
    const children = await Promise.all(
      parent.students.map(async ({ relationship, student }) => {
        const [attendance, upcoming, cards, timetable, marks] = await Promise.all([
          this.prisma.attendanceRecord.groupBy({
            by: ['status'],
            where: { studentId: student.id },
            _count: { _all: true },
          }),
          this.prisma.assignment.findMany({
            where: {
              schoolId,
              deletedAt: null,
              status: 'PUBLISHED',
              dueAt: { gte: new Date() },
              teachingAssignment: {
                classSectionId: { in: student.enrollments.map((item) => item.classSectionId) },
              },
            },
            include: {
              teachingAssignment: { include: { subject: true } },
              submissions: { where: { studentId: student.id } },
            },
            orderBy: { dueAt: 'asc' },
            take: 5,
          }),
          this.prisma.reportCard.findMany({
            where: {
              schoolId,
              studentId: student.id,
              status: { in: [ReportCardStatus.PUBLISHED, ReportCardStatus.APPROVED] },
            },
            include: { semester: true },
            orderBy: { generatedAt: 'desc' },
            take: 2,
          }),
          this.prisma.timetableEntry.findMany({
            where: {
              schoolId,
              deletedAt: null,
              teachingAssignment: {
                classSectionId: { in: student.enrollments.map((item) => item.classSectionId) },
              },
            },
            include: { room: true, teachingAssignment: { include: { subject: true } } },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
            take: 12,
          }),
          this.prisma.mark.findMany({
            where: {
              studentId: student.id,
              examSubject: { exam: { status: ExamStatus.PUBLISHED } },
            },
            include: {
              examSubject: {
                include: { exam: true, teachingAssignment: { include: { subject: true } } },
              },
            },
            orderBy: { updatedAt: 'desc' },
            take: 12,
          }),
        ]);
        const total = attendance.reduce((sum, item) => sum + item._count._all, 0);
        const attended =
          (attendance.find((item) => item.status === 'PRESENT')?._count._all ?? 0) +
          (attendance.find((item) => item.status === 'LATE')?._count._all ?? 0);
        const enrollment = student.enrollments[0];
        return {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          studentCode: student.studentCode,
          relationship,
          className: enrollment
            ? `${enrollment.classSection.grade.name} ${enrollment.classSection.name}`
            : null,
          attendance: {
            total,
            percentage: total ? Math.round((attended / total) * 10000) / 100 : 0,
          },
          upcoming,
          reportCards: cards,
          timetable,
          marks,
        };
      }),
    );
    return { profile: { id: parent.id, name: `${parent.firstName} ${parent.lastName}` }, children };
  }
}
