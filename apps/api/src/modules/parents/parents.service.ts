import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@school/database';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SchoolAccessService } from '../../common/services/school-access.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateParentDto, UpdateParentDto } from './dto/parent.dto';

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolAccess: SchoolAccessService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(schoolId: string, query: PaginationQueryDto) {
    const where: Prisma.ParentWhereInput = {
      schoolId, deletedAt: null,
      ...(query.search ? { OR: [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.parent.findMany({
        where, skip, take: query.pageSize, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: { students: { include: { student: { select: { id: true, studentCode: true, firstName: true, lastName: true } } } } },
      }),
      this.prisma.parent.count({ where }),
    ]);
    return { items, meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async getOne(schoolId: string, id: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { id, schoolId, deletedAt: null },
      include: { students: { include: { student: true } } },
    });
    if (!parent) throw new NotFoundException('Parent was not found');
    return parent;
  }

  async create(schoolId: string, actorId: string, dto: CreateParentDto) {
    if (dto.userId) await this.assertAvailableUser(dto.userId, schoolId);
    const created = await this.prisma.parent.create({
      data: {
        schoolId,
        firstName: dto.firstName.trim(), lastName: dto.lastName.trim(),
        email: dto.email?.toLowerCase(), phone: dto.phone?.trim(), occupation: dto.occupation?.trim(), address: dto.address?.trim(), userId: dto.userId,
      },
    });
    await this.audit(schoolId, actorId, 'PARENT_CREATED', created.id, undefined, created);
    return created;
  }

  async update(schoolId: string, actorId: string, id: string, dto: UpdateParentDto) {
    const previous = await this.schoolAccess.parent(id, schoolId);
    if (dto.userId && dto.userId !== previous.userId) await this.assertAvailableUser(dto.userId, schoolId);
    const updated = await this.prisma.parent.update({
      where: { id },
      data: {
        ...(dto.firstName ? { firstName: dto.firstName.trim() } : {}), ...(dto.lastName ? { lastName: dto.lastName.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}), ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
        ...(dto.occupation !== undefined ? { occupation: dto.occupation.trim() } : {}), ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
        ...(dto.userId ? { userId: dto.userId } : {}),
      },
    });
    await this.audit(schoolId, actorId, 'PARENT_UPDATED', id, previous, updated);
    return updated;
  }

  async archive(schoolId: string, actorId: string, id: string) {
    const previous = await this.schoolAccess.parent(id, schoolId);
    const updated = await this.prisma.parent.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(schoolId, actorId, 'PARENT_ARCHIVED', id, previous, updated);
  }

  private async assertAvailableUser(userId: string, schoolId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, schoolMemberships: { some: { schoolId } } }, include: { parentProfile: true },
    });
    if (!user) throw new NotFoundException('User was not found in this school');
    if (user.parentProfile) throw new ConflictException('The selected user is already linked to a parent profile');
  }

  private async audit(schoolId: string, userId: string, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    await this.auditLogs.record({ schoolId, userId, action, entityType: 'PARENT', entityId,
      ...(oldValue ? { oldValue: JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue } : {}),
      ...(newValue ? { newValue: JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue } : {}),
    });
  }
}
