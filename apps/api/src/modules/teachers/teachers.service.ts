import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PermissionScope, Prisma } from '@school/database';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService, private readonly auditLogs: AuditLogsService, private readonly authorization: AuthorizationService) {}

  async list(user: AuthenticatedUser, query: PaginationQueryDto) {
    const scopeWhere = this.readWhere(user);
    const where: Prisma.TeacherWhereInput = query.search
      ? { AND: [scopeWhere, { OR: [
        { staff: { employeeCode: { contains: query.search, mode: 'insensitive' } } },
        { staff: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { staff: { lastName: { contains: query.search, mode: 'insensitive' } } },
      ] }] }
      : scopeWhere;
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.teacher.findMany({ where, skip, take: query.pageSize, include: { staff: true }, orderBy: { staff: { lastName: 'asc' } } }),
      this.prisma.teacher.count({ where }),
    ]);
    return { items, meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async getOne(user: AuthenticatedUser, id: string) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id, ...this.readWhere(user) }, include: { staff: true } });
    if (!teacher) throw new NotFoundException('Teacher was not found');
    return teacher;
  }

  async create(schoolId: string, actorId: string, dto: CreateTeacherDto) {
    const duplicate = await this.prisma.staff.findFirst({ where: { schoolId, employeeCode: dto.employeeCode.trim() } });
    if (duplicate) throw new ConflictException('Employee code already exists');
    if (dto.userId) await this.assertAvailableUser(dto.userId, schoolId);

    const teacher = await this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.create({
        data: {
          schoolId, employeeCode: dto.employeeCode.trim(), firstName: dto.firstName.trim(), lastName: dto.lastName.trim(),
          email: dto.email?.toLowerCase(), phone: dto.phone?.trim(), department: dto.department?.trim(),
          employmentStatus: dto.employmentStatus, hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined, userId: dto.userId,
        },
      });
      return tx.teacher.create({
        data: { staffId: staff.id, qualifications: dto.qualifications?.trim(), specialization: dto.specialization?.trim() },
        include: { staff: true },
      });
    });
    await this.audit(schoolId, actorId, 'TEACHER_CREATED', teacher.id, undefined, teacher);
    return teacher;
  }

  async update(schoolId: string, actorId: string, id: string, dto: UpdateTeacherDto) {
    const previous = await this.prisma.teacher.findFirst({ where: { id, staff: { schoolId, deletedAt: null } }, include: { staff: true } });
    if (!previous) throw new NotFoundException('Teacher was not found');
    if (dto.employeeCode && dto.employeeCode !== previous.staff.employeeCode) {
      const duplicate = await this.prisma.staff.findFirst({ where: { schoolId, employeeCode: dto.employeeCode.trim(), id: { not: previous.staffId } } });
      if (duplicate) throw new ConflictException('Employee code already exists');
    }
    if (dto.userId && dto.userId !== previous.staff.userId) await this.assertAvailableUser(dto.userId, schoolId);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.staff.update({
        where: { id: previous.staffId },
        data: {
          ...(dto.employeeCode ? { employeeCode: dto.employeeCode.trim() } : {}), ...(dto.firstName ? { firstName: dto.firstName.trim() } : {}),
          ...(dto.lastName ? { lastName: dto.lastName.trim() } : {}), ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}), ...(dto.department !== undefined ? { department: dto.department.trim() } : {}),
          ...(dto.employmentStatus ? { employmentStatus: dto.employmentStatus } : {}), ...(dto.hiredAt ? { hiredAt: new Date(dto.hiredAt) } : {}),
          ...(dto.userId ? { userId: dto.userId } : {}),
        },
      });
      return tx.teacher.update({
        where: { id },
        data: { ...(dto.qualifications !== undefined ? { qualifications: dto.qualifications.trim() } : {}), ...(dto.specialization !== undefined ? { specialization: dto.specialization.trim() } : {}) },
        include: { staff: true },
      });
    });
    await this.audit(schoolId, actorId, 'TEACHER_UPDATED', id, previous, updated);
    return updated;
  }

  async archive(schoolId: string, actorId: string, id: string): Promise<void> {
    const previous = await this.prisma.teacher.findFirst({ where: { id, staff: { schoolId, deletedAt: null } }, include: { staff: true } });
    if (!previous) throw new NotFoundException('Teacher was not found');
    const updated = await this.prisma.staff.update({ where: { id: previous.staffId }, data: { deletedAt: new Date() } });
    await this.audit(schoolId, actorId, 'TEACHER_ARCHIVED', id, previous, updated);
  }

  private async assertAvailableUser(userId: string, schoolId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null, schoolMemberships: { some: { schoolId } } }, include: { staffProfile: true } });
    if (!user) throw new NotFoundException('User was not found in this school');
    if (user.staffProfile) throw new ConflictException('The selected user is already linked to a staff profile');
  }

  private readWhere(user: AuthenticatedUser): Prisma.TeacherWhereInput {
    if (this.authorization.hasSchoolAccess(user, 'teacher.read')) return { staff: { schoolId: user.schoolId, deletedAt: null } };
    if (this.authorization.hasScope(user, 'teacher.read', PermissionScope.ASSIGNED, PermissionScope.OWN)) {
      return { staff: { schoolId: user.schoolId, userId: user.id, deletedAt: null } };
    }
    throw new ForbiddenException('No applicable teacher profile scope is granted');
  }

  private async audit(schoolId: string, userId: string, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    await this.auditLogs.record({ schoolId, userId, action, entityType: 'TEACHER', entityId,
      ...(oldValue ? { oldValue: JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue } : {}),
      ...(newValue ? { newValue: JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue } : {}),
    });
  }
}
