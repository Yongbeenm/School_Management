import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PermissionScope } from '@school/database';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  list() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { rolePermissions: { include: { permission: { select: { code: true, name: true, module: true, action: true } } } } },
    });
  }

  async create(schoolId: string, actorId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('A role with this code already exists');

    const role = await this.prisma.role.create({
      data: { code: dto.code, name: dto.name.trim(), description: dto.description?.trim(), isSystem: false },
    });
    await this.auditLogs.record({
      schoolId,
      userId: actorId,
      action: 'ROLE_CREATED',
      entityType: 'ROLE',
      entityId: role.id,
      newValue: { code: role.code },
    });
    return role;
  }

  async setPermissions(schoolId: string, actorId: string, roleId: string, grants: Array<{ code: string; scope: PermissionScope }>) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role was not found');
    if (role.code === 'SUPER_ADMIN') throw new ForbiddenException('The Super Admin role cannot be changed');

    const grantByCode = new Map<string, PermissionScope>();
    for (const grant of grants) {
      if (grantByCode.has(grant.code)) throw new BadRequestException(`Permission ${grant.code} was supplied more than once`);
      grantByCode.set(grant.code, grant.scope);
    }
    const uniqueCodes = [...grantByCode.keys()];
    const permissions = await this.prisma.permission.findMany({ where: { code: { in: uniqueCodes } } });
    if (permissions.length !== uniqueCodes.length) throw new NotFoundException('One or more permissions were not found');

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId, permissionId: permission.id, scope: grantByCode.get(permission.code)! })),
      }),
      this.prisma.user.updateMany({
        where: { userRoles: { some: { roleId } } },
        data: { authorizationVersion: { increment: 1 } },
      }),
    ]);

    await this.auditLogs.record({
      schoolId,
      userId: actorId,
      action: 'ROLE_PERMISSIONS_CHANGED',
      entityType: 'ROLE',
      entityId: roleId,
      newValue: { grants: [...grantByCode].map(([code, scope]) => ({ code, scope })) },
    });
    return { roleId, grants: [...grantByCode].map(([code, scope]) => ({ code, scope })) };
  }
}
