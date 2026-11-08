import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionScope, SchoolStatus, UserStatus } from '@school/database';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  findForAuthentication(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        schoolMemberships: { include: { school: { select: { status: true } } } },
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
  }

  async buildAuthenticatedUser(
    userId: string,
    sessionId: string,
    schoolId: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        schoolMemberships: {
          where: { schoolId },
          include: { school: { select: { status: true } } },
        },
        userRoles: {
          where: { schoolId },
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    const isPlatformAdmin =
      user?.userRoles.some((assignment) => assignment.role.code === 'SUPER_ADMIN') ?? false;
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !user.schoolMemberships.length ||
      (user.schoolMemberships[0].school.status !== SchoolStatus.ACTIVE && !isPlatformAdmin)
    ) {
      throw new NotFoundException('Active user or school membership was not found');
    }

    const effectiveAssignments = isPlatformAdmin
      ? user.userRoles.filter((assignment) => assignment.role.code === 'SUPER_ADMIN')
      : user.userRoles;
    const roles = effectiveAssignments.map((assignment) => assignment.role.code);
    const permissionScopes: Record<string, PermissionScope[]> = {};
    for (const assignment of effectiveAssignments) {
      for (const rolePermission of assignment.role.rolePermissions) {
        const code = rolePermission.permission.code;
        const scopes = permissionScopes[code] ?? [];
        if (!scopes.includes(rolePermission.scope)) scopes.push(rolePermission.scope);
        permissionScopes[code] = scopes;
      }
    }
    const permissions = Object.keys(permissionScopes);

    return {
      id: user.id,
      email: user.email,
      sessionId,
      schoolId,
      roles,
      permissions,
      permissionScopes,
    };
  }

  async getPublicProfile(userId: string, schoolId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        schoolMemberships: {
          where: { schoolId },
          select: { school: { select: { id: true, name: true, code: true } } },
        },
      },
    });

    if (!user) throw new NotFoundException('User was not found');

    return user;
  }

  async list(schoolId: string, query: PaginationQueryDto) {
    const where = {
      deletedAt: null,
      schoolMemberships: { some: { schoolId } },
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          lastLoginAt: true,
          userRoles: {
            where: { schoolId },
            select: { role: { select: { code: true, name: true } } },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async create(schoolId: string, actorId: string, dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('A user with this email already exists');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        status: dto.status ?? UserStatus.ACTIVE,
        schoolMemberships: { create: { schoolId, isDefault: true } },
      },
      select: { id: true, email: true, firstName: true, lastName: true, status: true },
    });

    await this.auditLogs.record({
      schoolId,
      userId: actorId,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: user.id,
      newValue: { email: user.email, status: user.status },
    });
    return user;
  }

  async updateStatus(
    schoolId: string,
    actorId: string,
    userId: string,
    dto: UpdateUserStatusDto,
    actorIsSuperAdmin = false,
  ) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, schoolMemberships: { some: { schoolId } } },
      select: {
        id: true,
        status: true,
        userRoles: { where: { role: { code: 'SUPER_ADMIN' } }, select: { id: true } },
      },
    });
    if (!target) throw new NotFoundException('User was not found');
    if (target.userRoles.length && !actorIsSuperAdmin)
      throw new ForbiddenException('Only a Super Admin can change a Super Admin account');
    if (target.id === actorId && dto.status !== UserStatus.ACTIVE)
      throw new ForbiddenException('You cannot deactivate your own account');

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: dto.status,
          authorizationVersion: { increment: 1 },
        },
        select: { id: true, status: true },
      }),
      ...(dto.status === UserStatus.ACTIVE
        ? []
        : [
            this.prisma.authSession.updateMany({
              where: { userId, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]),
    ]);

    await this.auditLogs.record({
      schoolId,
      userId: actorId,
      action: 'USER_STATUS_CHANGED',
      entityType: 'USER',
      entityId: userId,
      oldValue: { status: target.status },
      newValue: { status: user.status },
    });
    return user;
  }

  async assignRoles(
    schoolId: string,
    actorId: string,
    userId: string,
    roleCodes: string[],
    actorIsSuperAdmin = false,
  ) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, schoolMemberships: { some: { schoolId } } },
      select: {
        id: true,
        userRoles: { where: { role: { code: 'SUPER_ADMIN' } }, select: { id: true } },
      },
    });
    if (!target) throw new NotFoundException('User was not found');

    const uniqueCodes = [...new Set(roleCodes)];
    const roles = await this.prisma.role.findMany({
      where: { code: { in: uniqueCodes } },
      include: { rolePermissions: { include: { permission: { select: { code: true } } } } },
    });
    if (roles.length !== uniqueCodes.length)
      throw new NotFoundException('One or more roles were not found');
    if ((target.userRoles.length || uniqueCodes.includes('SUPER_ADMIN')) && !actorIsSuperAdmin) {
      throw new ForbiddenException('Only a Super Admin can assign or remove the Super Admin role');
    }
    if (
      !actorIsSuperAdmin &&
      roles.some((role) =>
        role.rolePermissions.some(
          (grant) =>
            grant.scope === PermissionScope.GLOBAL ||
            ['role.manage', 'permission.manage', 'school.manage'].includes(grant.permission.code),
        ),
      )
    ) {
      throw new ForbiddenException(
        'Only a Super Admin can assign a role with platform administration access',
      );
    }
    if (target.id === actorId && target.userRoles.length && !uniqueCodes.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('You cannot remove your own Super Admin role');
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId, schoolId } }),
      this.prisma.userRole.createMany({
        data: roles.map((role) => ({ userId, roleId: role.id, schoolId })),
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { authorizationVersion: { increment: 1 } },
      }),
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditLogs.record({
      schoolId,
      userId: actorId,
      action: 'USER_ROLES_CHANGED',
      entityType: 'USER',
      entityId: userId,
      newValue: { roleCodes: uniqueCodes },
    });

    return { userId, roleCodes: uniqueCodes };
  }
}
