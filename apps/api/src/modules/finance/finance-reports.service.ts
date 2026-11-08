import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FeeCurrency, FeePaymentMethod, Prisma } from '@school/database';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { CollectionsQueryDto, ReceivablesQueryDto } from './dto/finance.dto';

const DAY = 86_400_000;
const ZERO = new Prisma.Decimal(0);

function csvCell(value: string | number | null | undefined): string {
  let text = String(value ?? '');
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows: Array<Array<string | number | null | undefined>>): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

@Injectable()
export class FinanceReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  private assertFeeReader(user: AuthenticatedUser) {
    this.authorization.assertSchoolAccess(user, 'fee.read');
    this.authorization.assertSchoolAccess(user, 'payment.read');
  }

  private paid(payments: Array<{ amount: Prisma.Decimal; voidedAt: Date | null }>) {
    return payments.reduce(
      (sum, payment) => (payment.voidedAt ? sum : sum.plus(payment.amount)),
      ZERO,
    );
  }

  private date(input: string): Date {
    const date = new Date(`${input}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input)
      throw new BadRequestException('Enter a valid date');
    return date;
  }

  async insights(user: AuthenticatedUser) {
    this.assertFeeReader(user);
    const [charges, payments] = await Promise.all([
      this.prisma.feeCharge.findMany({
        where: { schoolId: user.schoolId, voidedAt: null },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
          payments: { where: { voidedAt: null }, select: { amount: true, voidedAt: true } },
        },
      }),
      this.prisma.feePayment.findMany({
        where: { schoolId: user.schoolId, voidedAt: null, charge: { voidedAt: null } },
        select: {
          amount: true,
          method: true,
          receivedOn: true,
          charge: { select: { currency: true } },
        },
      }),
    ]);
    const today = new Date();
    const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const todayIso = new Date(todayStart).toISOString().slice(0, 10);
    const soonIso = new Date(todayStart + 7 * DAY).toISOString().slice(0, 10);
    const last30Iso = new Date(todayStart - 29 * DAY).toISOString().slice(0, 10);
    const monthKeys = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (5 - index), 1));
      return date.toISOString().slice(0, 7);
    });
    const currencies = [FeeCurrency.USD, FeeCurrency.KHR].map((currency) => {
      let billed = ZERO,
        collected = ZERO,
        outstanding = ZERO,
        overdue = ZERO,
        dueSoon = ZERO;
      const aging = {
        current: ZERO,
        days1to30: ZERO,
        days31to60: ZERO,
        days61to90: ZERO,
        days91plus: ZERO,
      };
      const byStudent = new Map<
        string,
        {
          student: (typeof charges)[number]['student'];
          amount: Prisma.Decimal;
          oldestDue: string;
          feeCount: number;
        }
      >();
      for (const charge of charges) {
        if (charge.currency !== currency) continue;
        const paid = this.paid(charge.payments);
        const balance = charge.amount.minus(paid);
        billed = billed.plus(charge.amount);
        collected = collected.plus(paid);
        outstanding = outstanding.plus(balance);
        if (balance.lte(0)) continue;
        const due = charge.dueOn.toISOString().slice(0, 10);
        const daysPastDue = Math.floor((todayStart - charge.dueOn.getTime()) / DAY);
        if (daysPastDue <= 0) aging.current = aging.current.plus(balance);
        else if (daysPastDue <= 30) aging.days1to30 = aging.days1to30.plus(balance);
        else if (daysPastDue <= 60) aging.days31to60 = aging.days31to60.plus(balance);
        else if (daysPastDue <= 90) aging.days61to90 = aging.days61to90.plus(balance);
        else aging.days91plus = aging.days91plus.plus(balance);
        if (due < todayIso) {
          overdue = overdue.plus(balance);
          const item = byStudent.get(charge.studentId);
          if (item) {
            item.amount = item.amount.plus(balance);
            item.feeCount += 1;
            if (due < item.oldestDue) item.oldestDue = due;
          } else
            byStudent.set(charge.studentId, {
              student: charge.student,
              amount: balance,
              oldestDue: due,
              feeCount: 1,
            });
        } else if (due <= soonIso) dueSoon = dueSoon.plus(balance);
      }
      const trend = monthKeys.map((month) => ({
        month,
        amount: payments
          .filter(
            (payment) =>
              payment.charge.currency === currency &&
              payment.receivedOn.toISOString().startsWith(month),
          )
          .reduce((sum, payment) => sum.plus(payment.amount), ZERO)
          .toFixed(2),
      }));
      const methods = Object.values(FeePaymentMethod).map((method) => ({
        method,
        amount: payments
          .filter(
            (payment) =>
              payment.charge.currency === currency &&
              payment.method === method &&
              payment.receivedOn.toISOString().slice(0, 10) >= last30Iso,
          )
          .reduce((sum, payment) => sum.plus(payment.amount), ZERO)
          .toFixed(2),
      }));
      const priority = [...byStudent.values()]
        .sort((a, b) => b.amount.comparedTo(a.amount))
        .slice(0, 8)
        .map((item) => ({
          student: item.student,
          amount: item.amount.toFixed(2),
          oldestDue: item.oldestDue,
          feeCount: item.feeCount,
        }));
      return {
        currency,
        billed: billed.toFixed(2),
        collected: collected.toFixed(2),
        outstanding: outstanding.toFixed(2),
        overdue: overdue.toFixed(2),
        dueSoon: dueSoon.toFixed(2),
        collectionRate: billed.gt(0)
          ? collected.div(billed).mul(100).toDecimalPlaces(1).toString()
          : '0',
        aging: Object.fromEntries(
          Object.entries(aging).map(([key, value]) => [key, value.toFixed(2)]),
        ),
        trend,
        methods,
        priority,
      };
    });
    return { asOf: todayIso, activeCharges: charges.length, currencies };
  }

  private async receivableRows(user: AuthenticatedUser, query: ReceivablesQueryDto) {
    this.assertFeeReader(user);
    const search = query.search?.trim();
    const where: Prisma.FeeChargeWhereInput = {
      schoolId: user.schoolId,
      voidedAt: null,
      ...(query.currency ? { currency: query.currency } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { student: { studentCode: { contains: search, mode: 'insensitive' } } },
              { student: { firstName: { contains: search, mode: 'insensitive' } } },
              { student: { lastName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const charges = await this.prisma.feeCharge.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
        payments: { where: { voidedAt: null }, select: { amount: true, voidedAt: true } },
      },
      orderBy: [{ dueOn: 'asc' }, { createdAt: 'asc' }],
    });
    const today = new Date();
    const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const todayIso = new Date(todayStart).toISOString().slice(0, 10);
    const soonIso = new Date(todayStart + 7 * DAY).toISOString().slice(0, 10);
    const rows = charges
      .map((charge) => {
        const paid = this.paid(charge.payments);
        const balance = charge.amount.minus(paid);
        const dueOn = charge.dueOn.toISOString().slice(0, 10);
        const status = balance.eq(0)
          ? 'PAID'
          : dueOn < todayIso
            ? 'OVERDUE'
            : paid.gt(0)
              ? 'PARTIAL'
              : 'UNPAID';
        return {
          id: charge.id,
          student: charge.student,
          title: charge.title,
          dueOn,
          currency: charge.currency,
          amount: charge.amount.toFixed(2),
          paid: paid.toFixed(2),
          balance: balance.toFixed(2),
          status,
          daysPastDue: Math.max(0, Math.floor((todayStart - charge.dueOn.getTime()) / DAY)),
          dueSoon: balance.gt(0) && dueOn >= todayIso && dueOn <= soonIso,
        };
      })
      .filter((row) => {
        if (!query.status || query.status === 'ALL') return true;
        if (query.status === 'DUE_SOON') return row.dueSoon;
        if (query.status === 'UNPAID') return Number(row.paid) === 0 && Number(row.balance) > 0;
        if (query.status === 'PARTIAL') return Number(row.paid) > 0 && Number(row.balance) > 0;
        return row.status === query.status;
      });
    return rows;
  }

  async receivables(user: AuthenticatedUser, query: ReceivablesQueryDto) {
    const rows = await this.receivableRows(user, query);
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: rows.length,
        totalPages: Math.ceil(rows.length / query.pageSize),
      },
    };
  }

  async receivablesCsv(user: AuthenticatedUser, query: ReceivablesQueryDto) {
    const rows = await this.receivableRows(user, query);
    return csv([
      [
        'Student code',
        'Student',
        'Fee',
        'Due date',
        'Currency',
        'Billed',
        'Paid',
        'Balance',
        'Status',
        'Days past due',
      ],
      ...rows.map((row) => [
        row.student.studentCode,
        `${row.student.firstName} ${row.student.lastName}`,
        row.title,
        row.dueOn,
        row.currency,
        row.amount,
        row.paid,
        row.balance,
        row.status,
        row.daysPastDue,
      ]),
    ]);
  }

  private async collectionRows(user: AuthenticatedUser, query: CollectionsQueryDto) {
    this.assertFeeReader(user);
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException('Start date must be before end date');
    const where: Prisma.FeePaymentWhereInput = {
      schoolId: user.schoolId,
      ...(query.status === 'VOIDED'
        ? { voidedAt: { not: null } }
        : query.status === 'ALL'
          ? {}
          : { voidedAt: null }),
      ...(query.currency || (query.status !== 'VOIDED' && query.status !== 'ALL')
        ? {
            charge: {
              ...(query.currency ? { currency: query.currency } : {}),
              ...(query.status !== 'VOIDED' && query.status !== 'ALL' ? { voidedAt: null } : {}),
            },
          }
        : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.from || query.to
        ? {
            receivedOn: {
              ...(query.from ? { gte: this.date(query.from) } : {}),
              ...(query.to ? { lte: this.date(query.to) } : {}),
            },
          }
        : {}),
    };
    const search = query.search?.trim();
    if (search)
      where.AND = [
        {
          OR: [
            { reference: { contains: search, mode: 'insensitive' } },
            { charge: { title: { contains: search, mode: 'insensitive' } } },
            { charge: { student: { studentCode: { contains: search, mode: 'insensitive' } } } },
            { charge: { student: { firstName: { contains: search, mode: 'insensitive' } } } },
            { charge: { student: { lastName: { contains: search, mode: 'insensitive' } } } },
          ],
        },
      ];
    const payments = await this.prisma.feePayment.findMany({
      where,
      include: {
        charge: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
          },
        },
      },
      orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }],
    });
    return payments.map((payment) => ({
      id: payment.id,
      student: payment.charge.student,
      title: payment.charge.title,
      chargeId: payment.chargeId,
      amount: payment.amount.toFixed(2),
      currency: payment.charge.currency,
      method: payment.method,
      reference: payment.reference,
      receivedOn: payment.receivedOn.toISOString().slice(0, 10),
      status: payment.voidedAt ? 'VOIDED' : 'ACTIVE',
    }));
  }

  async collections(user: AuthenticatedUser, query: CollectionsQueryDto) {
    const rows = await this.collectionRows(user, query);
    const totals = Object.values(FeeCurrency).map((currency) => ({
      currency,
      amount: rows
        .filter((row) => row.currency === currency && row.status === 'ACTIVE')
        .reduce((sum, row) => sum.plus(row.amount), ZERO)
        .toFixed(2),
      count: rows.filter((row) => row.currency === currency && row.status === 'ACTIVE').length,
    }));
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize),
      totals,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: rows.length,
        totalPages: Math.ceil(rows.length / query.pageSize),
      },
    };
  }

  async collectionsCsv(user: AuthenticatedUser, query: CollectionsQueryDto) {
    const rows = await this.collectionRows(user, query);
    return csv([
      [
        'Date received',
        'Student code',
        'Student',
        'Fee',
        'Currency',
        'Amount',
        'Method',
        'Reference',
        'Status',
        'Receipt ID',
      ],
      ...rows.map((row) => [
        row.receivedOn,
        row.student.studentCode,
        `${row.student.firstName} ${row.student.lastName}`,
        row.title,
        row.currency,
        row.amount,
        row.method,
        row.reference,
        row.status,
        row.id,
      ]),
    ]);
  }

  async receipt(user: AuthenticatedUser, paymentId: string) {
    this.assertFeeReader(user);
    const payment = await this.prisma.feePayment.findFirst({
      where: { id: paymentId, schoolId: user.schoolId },
      include: {
        school: { select: { name: true, code: true, address: true, phone: true, email: true } },
        charge: {
          include: {
            student: { select: { id: true, studentCode: true, firstName: true, lastName: true } },
            payments: { where: { voidedAt: null }, select: { amount: true, voidedAt: true } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment was not found');
    const balance = payment.charge.amount.minus(this.paid(payment.charge.payments));
    return {
      id: payment.id,
      school: payment.school,
      student: payment.charge.student,
      fee: {
        title: payment.charge.title,
        amount: payment.charge.amount.toFixed(2),
        dueOn: payment.charge.dueOn.toISOString().slice(0, 10),
        currency: payment.charge.currency,
        balance: balance.toFixed(2),
      },
      payment: {
        amount: payment.amount.toFixed(2),
        method: payment.method,
        reference: payment.reference,
        note: payment.note,
        receivedOn: payment.receivedOn.toISOString().slice(0, 10),
        createdAt: payment.createdAt,
        voidedAt: payment.voidedAt,
        voidReason: payment.voidReason,
      },
    };
  }
}
