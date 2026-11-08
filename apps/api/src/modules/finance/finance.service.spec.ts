import { ConflictException, NotFoundException } from '@nestjs/common';
import { FeeCurrency, FeePaymentMethod, Prisma } from '@school/database';
import { jest } from '@jest/globals';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { FinanceService } from './finance.service';

const user: AuthenticatedUser = {
  id: 'accountant-1',
  email: 'accountant@school.test',
  sessionId: 'session-1',
  schoolId: 'school-1',
  roles: ['ACCOUNTANT'],
  permissions: ['fee.read', 'payment.read', 'payment.create'],
  permissionScopes: {
    'fee.read': ['SCHOOL'],
    'payment.read': ['SCHOOL'],
    'payment.create': ['SCHOOL'],
  },
};

describe('FinanceService student balances', () => {
  const findCharges = jest.fn<() => Promise<unknown>>();
  const findStudent = jest.fn<() => Promise<unknown>>();
  const findPayment = jest.fn<() => Promise<unknown>>();
  const findRecent = jest.fn<() => Promise<unknown>>();
  const findChargeInTransaction = jest.fn<() => Promise<unknown>>();
  const createPayment = jest.fn();
  const transaction = jest.fn<(work: (tx: unknown) => Promise<unknown>) => Promise<unknown>>();
  const prisma = {
    feeCharge: { findMany: findCharges },
    feePayment: { findUnique: findPayment, findMany: findRecent },
    student: { findFirst: findStudent },
    $transaction: transaction,
  } as unknown as PrismaService;
  const assertSchoolAccess = jest.fn();
  const authorization = { assertSchoolAccess } as unknown as AuthorizationService;
  const service = new FinanceService(prisma, authorization);

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.mockImplementation(async (work) =>
      work({
        feeCharge: { findFirst: findChargeInTransaction },
        feePayment: { create: createPayment },
        auditLog: { create: jest.fn() },
      }),
    );
  });

  it('separates currencies and excludes voided payments from balances', async () => {
    findCharges.mockResolvedValue([
      {
        amount: new Prisma.Decimal('100.00'),
        currency: FeeCurrency.USD,
        dueOn: new Date('2026-12-01'),
        voidedAt: null,
        payments: [
          { amount: new Prisma.Decimal('40.00'), voidedAt: null },
          { amount: new Prisma.Decimal('10.00'), voidedAt: new Date() },
        ],
      },
      {
        amount: new Prisma.Decimal('1000.00'),
        currency: FeeCurrency.KHR,
        dueOn: new Date('2026-12-01'),
        voidedAt: null,
        payments: [],
      },
    ]);
    findRecent.mockResolvedValue([]);
    const summary = await service.summary(user);
    expect(summary.totals).toEqual([
      {
        currency: 'KHR',
        billed: '1000.00',
        collected: '0.00',
        outstanding: '1000.00',
        overdue: '0.00',
        chargeCount: 1,
      },
      {
        currency: 'USD',
        billed: '100.00',
        collected: '40.00',
        outstanding: '60.00',
        overdue: '0.00',
        chargeCount: 1,
      },
    ]);
    expect(assertSchoolAccess).toHaveBeenCalledWith(user, 'payment.read');
  });

  it('rejects a payment above the remaining balance before writing', async () => {
    findPayment.mockResolvedValue(null);
    findChargeInTransaction.mockResolvedValue({
      id: 'charge-1',
      schoolId: user.schoolId,
      voidedAt: null,
      amount: new Prisma.Decimal('100.00'),
      payments: [{ amount: new Prisma.Decimal('60.00'), voidedAt: null }],
    });
    await expect(
      service.recordPayment(user, 'charge-1', {
        amount: '50.00',
        method: FeePaymentMethod.CASH,
        idempotencyKey: '94acb070-61c1-4f4d-b240-0243dc4336e4',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(createPayment).not.toHaveBeenCalled();
  });

  it('replays an identical payment request without creating another payment', async () => {
    findPayment.mockResolvedValue({
      id: 'payment-1',
      schoolId: user.schoolId,
      chargeId: 'charge-1',
      amount: new Prisma.Decimal('25.00'),
      method: FeePaymentMethod.CASH,
      reference: null,
      note: null,
      receivedOn: new Date('2026-10-30'),
      voidedAt: null,
    });
    const payment = await service.recordPayment(user, 'charge-1', {
      amount: '25.00',
      method: FeePaymentMethod.CASH,
      receivedOn: '2026-10-30',
      idempotencyKey: '94acb070-61c1-4f4d-b240-0243dc4336e4',
    });
    expect(payment.id).toBe('payment-1');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not reveal a student outside the current school', async () => {
    findStudent.mockResolvedValue(null);
    await expect(service.studentLedger(user, 'other-student')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findCharges).not.toHaveBeenCalled();
  });
});
