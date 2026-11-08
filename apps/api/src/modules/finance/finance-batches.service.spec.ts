import { ConflictException } from '@nestjs/common';
import { FeeCurrency, Prisma } from '@school/database';
import { jest } from '@jest/globals';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { FinanceBatchesService } from './finance-batches.service';

const user = { id: 'accountant', schoolId: 'school-1' } as AuthenticatedUser;
const dto = {
  batchId: 'ee5815ca-cef9-450c-8a42-df7f061dcf0d',
  classSectionId: '0e933f4b-8078-401e-8624-a6260b559280',
  title: 'Semester tuition',
  amount: '50.00',
  currency: FeeCurrency.USD,
  dueOn: '2026-11-15',
};

describe('FinanceBatchesService', () => {
  const findExisting = jest.fn<() => Promise<unknown>>();
  const createMany = jest.fn<() => Promise<unknown>>();
  const transaction = jest.fn<(work: (tx: unknown) => Promise<unknown>) => Promise<unknown>>();
  const batch = {
    ...dto,
    id: dto.batchId,
    schoolId: user.schoolId,
    amount: new Prisma.Decimal(dto.amount),
    dueOn: new Date(dto.dueOn),
    description: null,
    studentCount: 2,
    createdAt: new Date(),
    voidedAt: null,
    voidReason: null,
  };
  const prisma = {
    feeBatch: { findUnique: findExisting },
    $transaction: transaction,
  } as unknown as PrismaService;
  const authorize = { assertSchoolAccess: jest.fn() } as unknown as AuthorizationService;
  const service = new FinanceBatchesService(prisma, authorize);

  beforeEach(() => {
    jest.clearAllMocks();
    findExisting.mockResolvedValue(null);
    transaction.mockImplementation(async (work) =>
      work({
        classSection: { findFirst: async () => ({ id: dto.classSectionId }) },
        enrollment: {
          findMany: async () => [
            { studentId: 'student-1' },
            { studentId: 'student-2' },
            { studentId: 'student-1' },
          ],
        },
        feeBatch: { findFirst: async () => null, create: async () => batch },
        feeCharge: { createMany },
        auditLog: { create: async () => ({}) },
      }),
    );
  });

  it('creates exactly one charge for each distinct active student in one transaction', async () => {
    const result = await service.create(user, dto);
    expect(result).toMatchObject({ studentCount: 2, total: '100.00' });
    const chargeData = (
      createMany.mock.calls[0] as unknown as [
        { data: Array<{ studentId: string; batchId: string }> },
      ]
    )[0].data;
    expect(chargeData.map((row) => row.studentId)).toEqual(['student-1', 'student-2']);
    expect(chargeData.every((row) => row.batchId === dto.batchId)).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('replays the same request key without creating another charge', async () => {
    findExisting.mockResolvedValue(batch);
    const result = await service.create(user, dto);
    expect(result.id).toBe(dto.batchId);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a changed request with a reused key', async () => {
    findExisting.mockResolvedValue(batch);
    await expect(service.create(user, { ...dto, amount: '60.00' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('blocks a second active charge with the same class, fee and due date', async () => {
    transaction.mockImplementation(async (work) =>
      work({
        classSection: { findFirst: async () => ({ id: dto.classSectionId }) },
        feeBatch: { findFirst: async () => ({ id: 'another-batch' }) },
      }),
    );
    await expect(service.create(user, dto)).rejects.toBeInstanceOf(ConflictException);
    expect(createMany).not.toHaveBeenCalled();
  });
});
