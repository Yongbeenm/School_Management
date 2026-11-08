import { FeeCurrency, FeePaymentMethod, Prisma } from '@school/database';
import { jest } from '@jest/globals';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { FinanceReportsService } from './finance-reports.service';

const user = { id: 'accountant', schoolId: 'school-1' } as AuthenticatedUser;
const student = { id: 'student-1', firstName: 'Alex', lastName: 'Anderson', studentCode: 'S001' };
const decimal = (value: string) => new Prisma.Decimal(value);

describe('FinanceReportsService', () => {
  const charges = jest.fn<() => Promise<unknown>>();
  const payments = jest.fn<() => Promise<unknown>>();
  const prisma = {
    feeCharge: { findMany: charges },
    feePayment: { findMany: payments },
  } as unknown as PrismaService;
  const authorize = { assertSchoolAccess: jest.fn() } as unknown as AuthorizationService;
  const service = new FinanceReportsService(prisma, authorize);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('separates currencies, deducts partial payments and ages outstanding balances', async () => {
    charges.mockResolvedValue([
      {
        id: 'one',
        studentId: student.id,
        student,
        amount: decimal('100'),
        currency: FeeCurrency.USD,
        dueOn: new Date('2026-10-20'),
        payments: [{ amount: decimal('25'), voidedAt: null }],
      },
      {
        id: 'two',
        studentId: student.id,
        student,
        amount: decimal('50'),
        currency: FeeCurrency.USD,
        dueOn: new Date('2026-08-01'),
        payments: [],
      },
      {
        id: 'three',
        studentId: student.id,
        student,
        amount: decimal('500'),
        currency: FeeCurrency.KHR,
        dueOn: new Date('2026-11-02'),
        payments: [],
      },
    ]);
    payments.mockResolvedValue([
      {
        amount: decimal('25'),
        method: FeePaymentMethod.CASH,
        receivedOn: new Date('2026-10-29'),
        charge: { currency: FeeCurrency.USD },
      },
    ]);
    const report = await service.insights(user);
    const usd = report.currencies.find((row) => row.currency === 'USD')!;
    const khr = report.currencies.find((row) => row.currency === 'KHR')!;
    expect(usd).toMatchObject({
      billed: '150.00',
      collected: '25.00',
      outstanding: '125.00',
      overdue: '125.00',
      dueSoon: '0.00',
      collectionRate: '16.7',
    });
    expect(usd.aging).toMatchObject({ days1to30: '75.00', days61to90: '50.00' });
    expect(usd.priority[0]).toMatchObject({ amount: '125.00', feeCount: 2 });
    expect(khr).toMatchObject({
      billed: '500.00',
      outstanding: '500.00',
      overdue: '0.00',
      dueSoon: '500.00',
    });
    expect(khr.aging.current).toBe('500.00');
  });

  it('filters overdue rows and escapes spreadsheet formulas in CSV', async () => {
    charges.mockResolvedValue([
      {
        id: 'one',
        studentId: student.id,
        student,
        title: '=1+1',
        amount: decimal('100'),
        currency: FeeCurrency.USD,
        dueOn: new Date('2026-10-20'),
        createdAt: new Date(),
        payments: [{ amount: decimal('25'), voidedAt: null }],
      },
      {
        id: 'two',
        studentId: student.id,
        student,
        title: 'Future fee',
        amount: decimal('50'),
        currency: FeeCurrency.USD,
        dueOn: new Date('2026-11-20'),
        createdAt: new Date(),
        payments: [],
      },
    ]);
    const query = { page: 1, pageSize: 20, status: 'OVERDUE' as const };
    const report = await service.receivables(user, query);
    expect(report.meta.total).toBe(1);
    expect(report.items[0]).toMatchObject({ balance: '75.00', status: 'OVERDUE', daysPastDue: 10 });
    const exported = await service.receivablesCsv(user, query);
    expect(exported).toContain('"\'=1+1"');
    expect(exported).not.toContain('Future fee');
    const partial = await service.receivables(user, { page: 1, pageSize: 20, status: 'PARTIAL' });
    expect(partial.items.map((row) => row.id)).toEqual(['one']);
  });

  it('excludes voided payments from active collection totals', async () => {
    payments.mockResolvedValue([
      {
        id: 'active',
        amount: decimal('20'),
        method: FeePaymentMethod.CASH,
        reference: null,
        receivedOn: new Date('2026-10-30'),
        createdAt: new Date(),
        voidedAt: null,
        chargeId: 'fee',
        charge: { title: 'Tuition', currency: FeeCurrency.USD, student },
      },
      {
        id: 'voided',
        amount: decimal('15'),
        method: FeePaymentMethod.CARD,
        reference: null,
        receivedOn: new Date('2026-10-30'),
        createdAt: new Date(),
        voidedAt: new Date(),
        chargeId: 'fee',
        charge: { title: 'Tuition', currency: FeeCurrency.USD, student },
      },
    ]);
    const report = await service.collections(user, { page: 1, pageSize: 20, status: 'ALL' });
    expect(report.totals.find((row) => row.currency === 'USD')).toMatchObject({
      amount: '20.00',
      count: 1,
    });
    expect(report.items[1].status).toBe('VOIDED');
  });
});
