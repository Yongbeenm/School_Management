import { ForbiddenException } from '@nestjs/common';
import { SchoolStatus } from '@school/database';
import { jest } from '@jest/globals';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { SchoolsService } from './schools.service';

describe('SchoolsService platform boundary', () => {
  const actorSchoolId = '11111111-1111-4111-8111-111111111111';
  const actorId = '22222222-2222-4222-8222-222222222222';
  const newSchoolId = '33333333-3333-4333-8333-333333333333';
  const adminRoleId = '44444444-4444-4444-8444-444444444444';
  const schoolFindUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const userFindUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const roleFindUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const schoolCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const userCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const auditCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  type TransactionClient = {
    school: { create: typeof schoolCreate };
    user: { create: typeof userCreate };
    auditLog: { create: typeof auditCreate };
  };
  const transaction =
    jest.fn<(work: (client: TransactionClient) => Promise<unknown>) => Promise<unknown>>();
  const prisma = {
    school: { findUnique: schoolFindUnique },
    user: { findUnique: userFindUnique },
    role: { findUnique: roleFindUnique },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new SchoolsService(prisma, { record: jest.fn() } as unknown as AuditLogsService);

  beforeEach(() => {
    jest.clearAllMocks();
    schoolFindUnique
      .mockResolvedValueOnce({ organizationId: 'organization-1' })
      .mockResolvedValueOnce(null);
    userFindUnique.mockResolvedValue(null);
    roleFindUnique.mockResolvedValue({ id: adminRoleId });
    schoolCreate.mockResolvedValue({
      id: newSchoolId,
      code: 'NORTH01',
      name: 'North School',
      email: null,
      phone: null,
      address: null,
      status: SchoolStatus.ACTIVE,
      createdAt: new Date(),
    });
    userCreate.mockResolvedValue({
      id: 'admin-user-1',
      email: 'admin@north.test',
      firstName: 'North',
      lastName: 'Admin',
      status: 'ACTIVE',
    });
    auditCreate.mockResolvedValue({});
    transaction.mockImplementation(async (work) =>
      work({
        school: { create: schoolCreate },
        user: { create: userCreate },
        auditLog: { create: auditCreate },
      }),
    );
  });

  it('creates a school, membership and first School Admin in one transaction', async () => {
    const result = await service.create(actorSchoolId, actorId, {
      code: 'NORTH01',
      name: 'North School',
      adminEmail: 'admin@north.test',
      adminFirstName: 'North',
      adminLastName: 'Admin',
      adminPassword: 'StrongPassword123!',
    });

    expect(result.id).toBe(newSchoolId);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin@north.test',
          schoolMemberships: { create: { schoolId: newSchoolId, isDefault: true } },
          userRoles: { create: { schoolId: newSchoolId, roleId: adminRoleId } },
        }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'SCHOOL_CREATED' }) }),
    );
  });

  it('does not allow the platform anchor school to be deactivated', async () => {
    await expect(
      service.updateStatus(actorSchoolId, actorId, actorSchoolId, SchoolStatus.INACTIVE),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
