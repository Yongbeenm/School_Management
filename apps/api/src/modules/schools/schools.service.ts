import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SchoolStatus, UserStatus } from '@school/database';
import * as argon2 from 'argon2';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Injectable()
export class SchoolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(actorSchoolId: string, query: PaginationQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.SchoolWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total, allSchools, activeSchools, schoolAdmins] = await this.prisma.$transaction([
      this.prisma.school.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          status: true,
          createdAt: true,
          organization: { select: { name: true } },
          _count: {
            select: {
              students: { where: { deletedAt: null } },
              staff: { where: { deletedAt: null } },
              userSchools: { where: { user: { deletedAt: null } } },
            },
          },
          userRoles: {
            where: { role: { code: 'ADMIN' }, user: { deletedAt: null } },
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  status: true,
                  lastLoginAt: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.school.count({ where }),
      this.prisma.school.count({ where: { deletedAt: null } }),
      this.prisma.school.count({ where: { deletedAt: null, status: SchoolStatus.ACTIVE } }),
      this.prisma.userRole.count({
        where: {
          role: { code: 'ADMIN' },
          user: { deletedAt: null, status: UserStatus.ACTIVE },
          school: { deletedAt: null },
        },
      }),
    ]);
    return {
      items: items.map(({ userRoles, ...school }) => ({
        ...school,
        platformAnchor: school.id === actorSchoolId,
        administrators: userRoles.map((assignment) => assignment.user),
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
      stats: { schools: allSchools, activeSchools, schoolAdmins },
    };
  }

  async create(actorSchoolId: string, actorId: string, dto: CreateSchoolDto) {
    const code = dto.code.trim().toUpperCase();
    const adminEmail = dto.adminEmail.trim().toLowerCase();
    const [actorSchool, existingSchool, existingUser, adminRole] = await Promise.all([
      this.prisma.school.findUnique({
        where: { id: actorSchoolId },
        select: { organizationId: true },
      }),
      this.prisma.school.findUnique({ where: { code }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } }),
      this.prisma.role.findUnique({ where: { code: 'ADMIN' }, select: { id: true } }),
    ]);
    if (!actorSchool) throw new NotFoundException('Platform organization was not found');
    if (existingSchool) throw new ConflictException('A school with this code already exists');
    if (existingUser) {
      throw new ConflictException('An account with the administrator email already exists');
    }
    if (!adminRole) throw new NotFoundException('School Admin role was not found');
    const passwordHash = await argon2.hash(dto.adminPassword, { type: argon2.argon2id });

    return this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          organizationId: actorSchool.organizationId,
          code,
          name: dto.name.trim(),
          email: dto.email?.trim().toLowerCase() || null,
          phone: dto.phone?.trim() || null,
          address: dto.address?.trim() || null,
          status: SchoolStatus.ACTIVE,
        },
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          status: true,
          createdAt: true,
        },
      });
      const administrator = await tx.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          firstName: dto.adminFirstName.trim(),
          lastName: dto.adminLastName.trim(),
          status: UserStatus.ACTIVE,
          schoolMemberships: { create: { schoolId: school.id, isDefault: true } },
          userRoles: { create: { schoolId: school.id, roleId: adminRole.id } },
        },
        select: { id: true, email: true, firstName: true, lastName: true, status: true },
      });
      await tx.auditLog.create({
        data: {
          schoolId: actorSchoolId,
          userId: actorId,
          action: 'SCHOOL_CREATED',
          entityType: 'SCHOOL',
          entityId: school.id,
          newValue: {
            code: school.code,
            name: school.name,
            administratorId: administrator.id,
            administratorEmail: administrator.email,
          },
        },
      });
      return { ...school, administrators: [administrator] };
    });
  }

  async updateStatus(
    actorSchoolId: string,
    actorId: string,
    schoolId: string,
    status: SchoolStatus,
  ) {
    if (schoolId === actorSchoolId && status === SchoolStatus.INACTIVE) {
      throw new ForbiddenException(
        'The school used for platform administration cannot be deactivated',
      );
    }
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId, deletedAt: null },
      select: { id: true, status: true, name: true, code: true },
    });
    if (!school) throw new NotFoundException('School was not found');
    if (school.status === status) return school;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.school.update({
        where: { id: schoolId },
        data: { status },
        select: { id: true, code: true, name: true, status: true },
      });
      if (status === SchoolStatus.INACTIVE) {
        const memberIds = (
          await tx.userSchool.findMany({
            where: { schoolId },
            select: { userId: true },
          })
        ).map((membership) => membership.userId);
        if (memberIds.length) {
          await tx.user.updateMany({
            where: { id: { in: memberIds } },
            data: { authorizationVersion: { increment: 1 } },
          });
          await tx.authSession.updateMany({
            where: { userId: { in: memberIds }, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      }
      await tx.auditLog.create({
        data: {
          schoolId: actorSchoolId,
          userId: actorId,
          action: 'SCHOOL_STATUS_CHANGED',
          entityType: 'SCHOOL',
          entityId: schoolId,
          oldValue: { status: school.status },
          newValue: { status },
        },
      });
      return updated;
    });
  }

  async current(schoolId: string) {
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId, deletedAt: null },
      include: { organization: true, campuses: { where: { deletedAt: null } } },
    });
    if (!school) throw new NotFoundException('School was not found');
    return school;
  }

  async update(schoolId: string, actorId: string, dto: UpdateSchoolDto) {
    const previous = await this.current(schoolId);
    const updated = await this.prisma.school.update({
      where: { id: schoolId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
      },
      include: { organization: true, campuses: { where: { deletedAt: null } } },
    });
    await this.auditLogs.record({
      schoolId,
      userId: actorId,
      action: 'SCHOOL_UPDATED',
      entityType: 'SCHOOL',
      entityId: schoolId,
      oldValue: JSON.parse(JSON.stringify(previous)) as Prisma.InputJsonValue,
      newValue: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue,
    });
    return updated;
  }
}
