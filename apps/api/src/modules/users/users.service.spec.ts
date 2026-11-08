import { ForbiddenException } from '@nestjs/common';
import { PermissionScope, SchoolStatus, UserStatus } from '@school/database';
import { jest } from '@jest/globals';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UsersService } from './users.service';

describe('UsersService protected role assignments', () => {
  const findUser = jest.fn<() => Promise<unknown>>();
  const findUniqueUser = jest.fn<() => Promise<unknown>>();
  const findRoles = jest.fn<() => Promise<unknown>>();
  const transaction = jest.fn<() => Promise<unknown>>();
  const prisma = {
    user: { findFirst: findUser, findUnique: findUniqueUser },
    role: { findMany: findRoles },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new UsersService(prisma, { record: jest.fn() } as unknown as AuditLogsService);

  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue({ id: 'target-1', status: UserStatus.ACTIVE, userRoles: [] });
  });

  it('prevents an administrator from assigning Super Admin', async () => {
    findRoles.mockResolvedValue([{ id: 'super-role', code: 'SUPER_ADMIN', rolePermissions: [] }]);
    await expect(
      service.assignRoles('school-1', 'admin-1', 'target-1', ['SUPER_ADMIN'], false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('prevents an administrator from assigning a role with global access', async () => {
    findRoles.mockResolvedValue([
      {
        id: 'custom-role',
        code: 'CUSTOM',
        rolePermissions: [{ scope: PermissionScope.GLOBAL, permission: { code: 'student.read' } }],
      },
    ]);
    await expect(
      service.assignRoles('school-1', 'admin-1', 'target-1', ['CUSTOM'], false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('prevents an administrator from deactivating a Super Admin account', async () => {
    findUser.mockResolvedValue({
      id: 'target-1',
      status: UserStatus.ACTIVE,
      userRoles: [{ id: 'assignment-1' }],
    });
    await expect(
      service.updateStatus(
        'school-1',
        'admin-1',
        'target-1',
        { status: UserStatus.SUSPENDED },
        false,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not merge a legacy school role into a Super Admin session', async () => {
    findUniqueUser.mockResolvedValue({
      id: 'platform-admin-1',
      email: 'platform@example.test',
      status: UserStatus.ACTIVE,
      schoolMemberships: [{ school: { status: SchoolStatus.ACTIVE } }],
      userRoles: [
        {
          role: {
            code: 'SUPER_ADMIN',
            rolePermissions: [
              {
                scope: PermissionScope.GLOBAL,
                permission: { code: 'school.manage' },
              },
            ],
          },
        },
        {
          role: {
            code: 'ADMIN',
            rolePermissions: [
              {
                scope: PermissionScope.SCHOOL,
                permission: { code: 'student.create' },
              },
            ],
          },
        },
      ],
    });

    const context = await service.buildAuthenticatedUser(
      'platform-admin-1',
      'session-1',
      'school-1',
    );
    expect(context.roles).toEqual(['SUPER_ADMIN']);
    expect(context.permissions).toEqual(['school.manage']);
    expect(context.permissions).not.toContain('student.create');
  });
});
