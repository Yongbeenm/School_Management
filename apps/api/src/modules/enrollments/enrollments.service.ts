import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, Prisma } from '@school/database';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SchoolAccessService } from '../../common/services/school-access.service';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateEnrollmentDto, UpdateEnrollmentStatusDto } from './dto/create-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolAccess: SchoolAccessService,
    private readonly authorization: AuthorizationService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(user: AuthenticatedUser, query: PaginationQueryDto, academicYearId?: string, classSectionId?: string, studentId?: string) {
    const studentScope = await this.authorization.studentWhere(user, 'enrollment.read');
    const where: Prisma.EnrollmentWhereInput = {
      schoolId: user.schoolId,
      student: studentScope,
      ...(academicYearId ? { academicYearId } : {}),
      ...(classSectionId ? { classSectionId } : {}),
      ...(studentId ? { studentId } : {}),
      ...(query.search ? { student: { OR: [
        { studentCode: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ] } } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where, skip, take: query.pageSize, orderBy: [{ academicYear: { startsOn: 'desc' } }, { student: { lastName: 'asc' } }],
        include: { student: true, classSection: { include: { grade: true } }, academicYear: true },
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    return { items, meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async create(schoolId: string, actorId: string, dto: CreateEnrollmentDto) {
    const [student, academicYear, classSection] = await Promise.all([
      this.schoolAccess.student(dto.studentId, schoolId),
      this.schoolAccess.academicYear(dto.academicYearId, schoolId),
      this.schoolAccess.classSection(dto.classSectionId, schoolId),
    ]);
    if (classSection.academicYearId !== academicYear.id) {
      throw new BadRequestException('The selected class does not belong to the selected academic year');
    }
    const existing = await this.prisma.enrollment.findUnique({
      where: { studentId_academicYearId: { studentId: student.id, academicYearId: academicYear.id } },
    });
    if (existing) throw new ConflictException('This student already has enrollment history for the selected academic year');

    if (classSection.capacity) {
      const activeCount = await this.prisma.enrollment.count({ where: { classSectionId: classSection.id, status: EnrollmentStatus.ACTIVE } });
      if (activeCount >= classSection.capacity) throw new ConflictException('The selected class is at capacity');
    }
    const enrolledOn = dto.enrolledOn ? new Date(dto.enrolledOn) : new Date();
    if (enrolledOn < academicYear.startsOn || enrolledOn > academicYear.endsOn) {
      throw new BadRequestException('Enrollment date must be inside the academic year');
    }
    const enrollment = await this.prisma.enrollment.create({
      data: { schoolId, studentId: student.id, classSectionId: classSection.id, academicYearId: academicYear.id, enrolledOn },
      include: { student: true, classSection: { include: { grade: true } }, academicYear: true },
    });
    await this.audit(schoolId, actorId, 'ENROLLMENT_CREATED', enrollment.id, undefined, enrollment);
    return enrollment;
  }

  async updateStatus(schoolId: string, actorId: string, id: string, dto: UpdateEnrollmentStatusDto) {
    const previous = await this.prisma.enrollment.findFirst({ where: { id, schoolId } });
    if (!previous) throw new NotFoundException('Enrollment was not found');
    const statusRequiresExit = dto.status !== EnrollmentStatus.ACTIVE;
    if (statusRequiresExit && !dto.leftOn) throw new BadRequestException('An end date is required for this enrollment status');
    const updated = await this.prisma.enrollment.update({
      where: { id },
      data: { status: dto.status, leftOn: dto.leftOn ? new Date(dto.leftOn) : statusRequiresExit ? new Date() : null },
      include: { student: true, classSection: { include: { grade: true } }, academicYear: true },
    });
    await this.audit(schoolId, actorId, 'ENROLLMENT_STATUS_UPDATED', id, previous, updated);
    return updated;
  }

  private async audit(schoolId: string, userId: string, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    await this.auditLogs.record({ schoolId, userId, action, entityType: 'ENROLLMENT', entityId,
      ...(oldValue ? { oldValue: JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue } : {}),
      ...(newValue ? { newValue: JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue } : {}),
    });
  }
}
