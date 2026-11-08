import { ForbiddenException } from '@nestjs/common';
import { PermissionScope } from '@school/database';
import { jest } from '@jest/globals';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RolesService } from './roles.service';

describe('RolesService permission changes', () => {
  const findRole = jest.fn<() => Promise<unknown>>();
  const findPermissions = jest.fn<() => Promise<unknown>>();
  const deleteGrants = jest.fn();
  const createGrants = jest.fn();
  const updateUsers = jest.fn();
  const transaction = jest.fn<() => Promise<unknown>>();
  const record = jest.fn<() => Promise<unknown>>();
  const prisma = {
    role: { findUnique: findRole },
    permission: { findMany: findPermissions },
    rolePermission: { deleteMany: deleteGrants, createMany: createGrants },
    user: { updateMany: updateUsers },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new RolesService(prisma, { record } as unknown as AuditLogsService);

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.mockResolvedValue([]);
    record.mockResolvedValue(undefined);
  });

  it('keeps the Super Admin role immutable', async () => {
    findRole.mockResolvedValue({ id: 'super-role', code: 'SUPER_ADMIN' });
    await expect(service.setPermissions('school-1', 'actor-1', 'super-role', [])).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('replaces grants and invalidates sessions for affected role members', async () => {
    findRole.mockResolvedValue({ id: 'teacher-role', code: 'TEACHER' });
    findPermissions.mockResolvedValue([{ id: 'permission-1', code: 'assignment.grade' }]);
    await service.setPermissions('school-1', 'actor-1', 'teacher-role', [
      { code: 'assignment.grade', scope: PermissionScope.ASSIGNED },
    ]);

    expect(deleteGrants).toHaveBeenCalledWith({ where: { roleId: 'teacher-role' } });
    expect(createGrants).toHaveBeenCalledWith({ data: [{ roleId: 'teacher-role', permissionId: 'permission-1', scope: PermissionScope.ASSIGNED }] });
    expect(updateUsers).toHaveBeenCalledWith({
      where: { userRoles: { some: { roleId: 'teacher-role' } } },
      data: { authorizationVersion: { increment: 1 } },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ROLE_PERMISSIONS_CHANGED' }));
  });
});
