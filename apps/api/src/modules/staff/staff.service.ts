import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PermissionScope, Prisma } from '@school/database';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SchoolAccessService } from '../../common/services/school-access.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolAccess: SchoolAccessService,
    private readonly auditLogs: AuditLogsService,
    private readonly authorization: AuthorizationService,
  ) {}

  async list(user: AuthenticatedUser, query: PaginationQueryDto) {
    const scopeWhere = this.readWhere(user);
    const where: Prisma.StaffWhereInput = query.search ? { AND: [scopeWhere, { OR: [
      { employeeCode: { contains: query.search, mode: 'insensitive' } },
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
    ] }] } : scopeWhere;
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.staff.findMany({ where, skip, take: query.pageSize, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], include: { teacher: true } }),
      this.prisma.staff.count({ where }),
    ]);
    return { items, meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async create(schoolId: string, actorId: string, dto: CreateStaffDto) {
    const exists = await this.prisma.staff.findFirst({ where: { schoolId, employeeCode: dto.employeeCode.trim() } });
    if (exists) throw new ConflictException('Employee code already exists');
    if (dto.userId) await this.assertAvailableUser(dto.userId, schoolId);
    const staff = await this.prisma.staff.create({ data: this.dataForCreate(schoolId, dto) });
    await this.audit(schoolId, actorId, 'STAFF_CREATED', staff.id, undefined, staff);
    return staff;
  }

  async update(schoolId: string, actorId: string, id: string, dto: UpdateStaffDto) {
    const previous = await this.schoolAccess.staff(id, schoolId);
    if (dto.employeeCode && dto.employeeCode !== previous.employeeCode) {
      const exists = await this.prisma.staff.findFirst({ where: { schoolId, employeeCode: dto.employeeCode.trim(), id: { not: id } } });
      if (exists) throw new ConflictException('Employee code already exists');
    }
    if (dto.userId && dto.userId !== previous.userId) await this.assertAvailableUser(dto.userId, schoolId);
    const updated = await this.prisma.staff.update({ where: { id }, data: this.dataForUpdate(dto) });
    await this.audit(schoolId, actorId, 'STAFF_UPDATED', id, previous, updated);
    return updated;
  }

  async archive(schoolId: string, actorId: string, id: string) {
    const previous = await this.schoolAccess.staff(id, schoolId);
    const updated = await this.prisma.staff.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(schoolId, actorId, 'STAFF_ARCHIVED', id, previous, updated);
  }

  dataForCreate(schoolId: string, dto: CreateStaffDto): Prisma.StaffUncheckedCreateInput {
    return {
      schoolId, employeeCode: dto.employeeCode.trim(), firstName: dto.firstName.trim(), lastName: dto.lastName.trim(),
      email: dto.email?.toLowerCase(), phone: dto.phone?.trim(), department: dto.department?.trim(),
      employmentStatus: dto.employmentStatus, hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined, userId: dto.userId,
    };
  }

  dataForUpdate(dto: UpdateStaffDto): Prisma.StaffUncheckedUpdateInput {
    return {
      ...(dto.employeeCode ? { employeeCode: dto.employeeCode.trim() } : {}), ...(dto.firstName ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName ? { lastName: dto.lastName.trim() } : {}), ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}), ...(dto.department !== undefined ? { department: dto.department.trim() } : {}),
      ...(dto.employmentStatus ? { employmentStatus: dto.employmentStatus } : {}), ...(dto.hiredAt ? { hiredAt: new Date(dto.hiredAt) } : {}),
      ...(dto.userId ? { userId: dto.userId } : {}),
    };
  }

  private readWhere(user: AuthenticatedUser): Prisma.StaffWhereInput {
    if (this.authorization.hasSchoolAccess(user, 'teacher.read')) return { schoolId: user.schoolId, deletedAt: null };
    if (this.authorization.hasScope(user, 'teacher.read', PermissionScope.ASSIGNED, PermissionScope.OWN)) {
      return { schoolId: user.schoolId, userId: user.id, deletedAt: null };
    }
    throw new ForbiddenException('No applicable staff profile scope is granted');
  }

  private async assertAvailableUser(userId: string, schoolId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, schoolMemberships: { some: { schoolId } } }, include: { staffProfile: true },
    });
    if (!user) throw new NotFoundException('User was not found in this school');
    if (user.staffProfile) throw new ConflictException('The selected user is already linked to a staff profile');
  }

  private async audit(schoolId: string, userId: string, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    await this.auditLogs.record({ schoolId, userId, action, entityType: 'STAFF', entityId,
      ...(oldValue ? { oldValue: JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue } : {}),
      ...(newValue ? { newValue: JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue } : {}),
    });
  }
}
