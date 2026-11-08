import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeeCharge, FeeCurrency, FeePayment, Prisma } from '@school/database';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { CreateFeeChargeDto, CreateFeePaymentDto, UpdateFeeChargeDto } from './dto/finance.dto';

type ChargeWithPayments = FeeCharge & { payments: FeePayment[] };

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  private assertSchoolAccess(user: AuthenticatedUser, permission: string) {
    this.authorization.assertSchoolAccess(user, permission);
  }

  private amount(input: string): Prisma.Decimal {
    const amount = new Prisma.Decimal(input);
    if (!amount.isFinite() || amount.lte(0))
      throw new BadRequestException('Amount must be greater than zero');
    return amount;
  }

  private date(input: string): Date {
    const date = new Date(`${input}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
      throw new BadRequestException('Enter a valid date');
    }
    return date;
  }

  private paid(charge: ChargeWithPayments): Prisma.Decimal {
    return charge.payments
      .filter((payment) => !payment.voidedAt)
      .reduce((total, payment) => total.plus(payment.amount), new Prisma.Decimal(0));
  }

  private chargeView(charge: ChargeWithPayments) {
    const paid = this.paid(charge);
    const balance = charge.amount.minus(paid);
    const today = new Date().toISOString().slice(0, 10);
    const status = charge.voidedAt
      ? 'VOIDED'
      : balance.eq(0)
        ? 'PAID'
        : charge.dueOn.toISOString().slice(0, 10) < today
          ? 'OVERDUE'
          : paid.gt(0)
            ? 'PARTIAL'
            : 'UNPAID';
    return {
      ...charge,
      amount: charge.amount.toFixed(2),
      paid: paid.toFixed(2),
      balance: balance.toFixed(2),
      status,
      payments: charge.payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toFixed(2),
      })),
    };
  }

  private totals(charges: ChargeWithPayments[]) {
    const byCurrency = new Map<
      FeeCurrency,
      {
        currency: FeeCurrency;
        billed: Prisma.Decimal;
        collected: Prisma.Decimal;
        outstanding: Prisma.Decimal;
        overdue: Prisma.Decimal;
        chargeCount: number;
      }
    >();
    const today = new Date().toISOString().slice(0, 10);
    for (const charge of charges) {
      if (charge.voidedAt) continue;
      let row = byCurrency.get(charge.currency);
      if (!row) {
        row = {
          currency: charge.currency,
          billed: new Prisma.Decimal(0),
          collected: new Prisma.Decimal(0),
          outstanding: new Prisma.Decimal(0),
          overdue: new Prisma.Decimal(0),
          chargeCount: 0,
        };
        byCurrency.set(charge.currency, row);
      }
      const paid = this.paid(charge);
      const balance = charge.amount.minus(paid);
      row.billed = row.billed.plus(charge.amount);
      row.collected = row.collected.plus(paid);
      row.outstanding = row.outstanding.plus(balance);
      if (balance.gt(0) && charge.dueOn.toISOString().slice(0, 10) < today)
        row.overdue = row.overdue.plus(balance);
      row.chargeCount += 1;
    }
    return [...byCurrency.values()]
      .sort((a, b) => a.currency.localeCompare(b.currency))
      .map((row) => ({
        currency: row.currency,
        billed: row.billed.toFixed(2),
        collected: row.collected.toFixed(2),
        outstanding: row.outstanding.toFixed(2),
        overdue: row.overdue.toFixed(2),
        chargeCount: row.chargeCount,
      }));
  }

  async summary(user: AuthenticatedUser) {
    this.assertSchoolAccess(user, 'fee.read');
    this.assertSchoolAccess(user, 'payment.read');
    const [charges, recentPayments] = await Promise.all([
      this.prisma.feeCharge.findMany({
        where: { schoolId: user.schoolId },
        include: { payments: true },
      }),
      this.prisma.feePayment.findMany({
        where: { schoolId: user.schoolId, voidedAt: null, charge: { voidedAt: null } },
        include: {
          charge: {
            include: {
              student: { select: { id: true, firstName: true, lastName: true, studentCode: true } },
            },
          },
        },
        orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
    ]);
    return {
      totals: this.totals(charges),
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        amount: payment.amount.toFixed(2),
        currency: payment.charge.currency,
        method: payment.method,
        receivedOn: payment.receivedOn,
        title: payment.charge.title,
        student: payment.charge.student,
      })),
    };
  }

  async studentLedger(user: AuthenticatedUser, studentId: string) {
    this.assertSchoolAccess(user, 'fee.read');
    this.assertSchoolAccess(user, 'payment.read');
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: user.schoolId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, studentCode: true },
    });
    if (!student) throw new NotFoundException('Student was not found');
    const charges = await this.prisma.feeCharge.findMany({
      where: { schoolId: user.schoolId, studentId },
      include: { payments: { orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }] } },
      orderBy: [{ dueOn: 'desc' }, { createdAt: 'desc' }],
    });
    return {
      student,
      totals: this.totals(charges),
      charges: charges.map((charge) => this.chargeView(charge)),
    };
  }

  async createCharge(user: AuthenticatedUser, dto: CreateFeeChargeDto) {
    this.assertSchoolAccess(user, 'fee.create');
    if (dto.title.trim().length < 2)
      throw new BadRequestException('Fee name must contain at least two characters');
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, schoolId: user.schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student was not found');
    const amount = this.amount(dto.amount);
    const dueOn = this.date(dto.dueOn);
    return this.prisma.$transaction(async (tx) => {
      const charge = await tx.feeCharge.create({
        data: {
          schoolId: user.schoolId,
          studentId: student.id,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          amount,
          currency: dto.currency,
          dueOn,
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          userId: user.id,
          action: 'FEE_CHARGE_CREATED',
          entityType: 'FEE_CHARGE',
          entityId: charge.id,
          newValue: {
            studentId: student.id,
            title: charge.title,
            amount: amount.toFixed(2),
            currency: dto.currency,
            dueOn: dto.dueOn,
          },
        },
      });
      return { ...charge, amount: charge.amount.toFixed(2) };
    });
  }

  async updateCharge(user: AuthenticatedUser, chargeId: string, dto: UpdateFeeChargeDto) {
    this.assertSchoolAccess(user, 'fee.update');
    if (!Object.keys(dto).length)
      throw new BadRequestException('Provide at least one field to update');
    if (dto.title !== undefined && dto.title.trim().length < 2)
      throw new BadRequestException('Fee name must contain at least two characters');
    return this.serializable(async (tx) => {
      const charge = await tx.feeCharge.findFirst({
        where: { id: chargeId, schoolId: user.schoolId },
        include: { payments: { where: { voidedAt: null } } },
      });
      if (!charge) throw new NotFoundException('Fee charge was not found');
      if (charge.voidedAt) throw new ConflictException('A voided fee cannot be edited');
      const amount = dto.amount !== undefined ? this.amount(dto.amount) : charge.amount;
      if (amount.lt(this.paid(charge)))
        throw new ConflictException('Fee amount cannot be less than payments already recorded');
      const updated = await tx.feeCharge.update({
        where: { id: charge.id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.amount !== undefined ? { amount } : {}),
          ...(dto.dueOn !== undefined ? { dueOn: this.date(dto.dueOn) } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          userId: user.id,
          action: 'FEE_CHARGE_UPDATED',
          entityType: 'FEE_CHARGE',
          entityId: charge.id,
          oldValue: {
            title: charge.title,
            amount: charge.amount.toFixed(2),
            dueOn: charge.dueOn.toISOString().slice(0, 10),
          },
          newValue: {
            title: updated.title,
            amount: updated.amount.toFixed(2),
            dueOn: updated.dueOn.toISOString().slice(0, 10),
          },
        },
      });
      return { ...updated, amount: updated.amount.toFixed(2) };
    });
  }

  async voidCharge(user: AuthenticatedUser, chargeId: string, reason: string) {
    this.assertSchoolAccess(user, 'fee.update');
    if (reason.trim().length < 3)
      throw new BadRequestException('A reason is required to void a fee');
    return this.serializable(async (tx) => {
      const charge = await tx.feeCharge.findFirst({
        where: { id: chargeId, schoolId: user.schoolId },
        include: { payments: { where: { voidedAt: null } } },
      });
      if (!charge) throw new NotFoundException('Fee charge was not found');
      if (charge.voidedAt) throw new ConflictException('Fee charge is already voided');
      if (charge.payments.length)
        throw new ConflictException('Void recorded payments before voiding this fee');
      const updated = await tx.feeCharge.update({
        where: { id: charge.id },
        data: { voidedAt: new Date(), voidReason: reason.trim() },
      });
      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          userId: user.id,
          action: 'FEE_CHARGE_VOIDED',
          entityType: 'FEE_CHARGE',
          entityId: charge.id,
          newValue: { reason: reason.trim() },
        },
      });
      return { id: updated.id, voidedAt: updated.voidedAt };
    });
  }

  async recordPayment(user: AuthenticatedUser, chargeId: string, dto: CreateFeePaymentDto) {
    this.assertSchoolAccess(user, 'payment.create');
    const amount = this.amount(dto.amount);
    const existing = await this.prisma.feePayment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return this.replayedPayment(existing, user.schoolId, chargeId, amount, dto);
    const receivedOn = dto.receivedOn ? this.date(dto.receivedOn) : new Date();
    try {
      return await this.serializable(async (tx) => {
        const charge = await tx.feeCharge.findFirst({
          where: { id: chargeId, schoolId: user.schoolId },
          include: { payments: { where: { voidedAt: null } } },
        });
        if (!charge) throw new NotFoundException('Fee charge was not found');
        if (charge.voidedAt) throw new ConflictException('Cannot pay a voided fee');
        if (amount.gt(charge.amount.minus(this.paid(charge))))
          throw new ConflictException('Payment exceeds the remaining balance');
        const payment = await tx.feePayment.create({
          data: {
            schoolId: user.schoolId,
            chargeId,
            amount,
            method: dto.method,
            idempotencyKey: dto.idempotencyKey,
            reference: dto.reference?.trim() || null,
            note: dto.note?.trim() || null,
            receivedOn,
          },
        });
        await tx.auditLog.create({
          data: {
            schoolId: user.schoolId,
            userId: user.id,
            action: 'FEE_PAYMENT_RECORDED',
            entityType: 'FEE_PAYMENT',
            entityId: payment.id,
            newValue: { chargeId, amount: amount.toFixed(2), method: dto.method },
          },
        });
        return { ...payment, amount: payment.amount.toFixed(2) };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.prisma.feePayment.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (replay) return this.replayedPayment(replay, user.schoolId, chargeId, amount, dto);
      }
      throw error;
    }
  }

  private replayedPayment(
    payment: FeePayment,
    schoolId: string,
    chargeId: string,
    amount: Prisma.Decimal,
    dto: CreateFeePaymentDto,
  ) {
    if (
      payment.schoolId !== schoolId ||
      payment.chargeId !== chargeId ||
      !payment.amount.eq(amount) ||
      payment.method !== dto.method ||
      payment.voidedAt ||
      (dto.receivedOn && payment.receivedOn.toISOString().slice(0, 10) !== dto.receivedOn) ||
      payment.reference !== (dto.reference?.trim() || null) ||
      payment.note !== (dto.note?.trim() || null)
    ) {
      throw new ConflictException('Payment request key has already been used');
    }
    return { ...payment, amount: payment.amount.toFixed(2) };
  }

  async voidPayment(user: AuthenticatedUser, paymentId: string, reason: string) {
    this.assertSchoolAccess(user, 'payment.void');
    if (reason.trim().length < 3)
      throw new BadRequestException('A reason is required to void a payment');
    return this.serializable(async (tx) => {
      const payment = await tx.feePayment.findFirst({
        where: { id: paymentId, schoolId: user.schoolId },
      });
      if (!payment) throw new NotFoundException('Payment was not found');
      if (payment.voidedAt) throw new ConflictException('Payment is already voided');
      const updated = await tx.feePayment.update({
        where: { id: payment.id },
        data: { voidedAt: new Date(), voidReason: reason.trim() },
      });
      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          userId: user.id,
          action: 'FEE_PAYMENT_VOIDED',
          entityType: 'FEE_PAYMENT',
          entityId: payment.id,
          newValue: {
            reason: reason.trim(),
            chargeId: payment.chargeId,
            amount: payment.amount.toFixed(2),
          },
        },
      });
      return { id: updated.id, voidedAt: updated.voidedAt };
    });
  }

  private async serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') ||
          attempt === 2
        )
          throw error;
      }
    }
    throw new ConflictException('Please retry this transaction');
  }
}
