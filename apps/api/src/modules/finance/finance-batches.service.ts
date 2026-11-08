import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus, FeeBatch, Prisma } from '@school/database';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { CreateClassFeeBatchDto } from './dto/finance.dto';

@Injectable()
export class FinanceBatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async classes(user: AuthenticatedUser) {
    this.authorization.assertSchoolAccess(user, 'fee.create');
    const classes = await this.prisma.classSection.findMany({
      where: { schoolId: user.schoolId, deletedAt: null },
      select: {
        id: true,
        name: true,
        grade: { select: { name: true } },
        academicYear: { select: { name: true, status: true } },
        _count: {
          select: {
            enrollments: {
              where: { status: EnrollmentStatus.ACTIVE, student: { deletedAt: null } },
            },
          },
        },
      },
      orderBy: [{ academicYear: { startsOn: 'desc' } }, { name: 'asc' }],
    });
    return classes.map((item) => ({
      id: item.id,
      name: item.name,
      grade: item.grade.name,
      academicYear: item.academicYear.name,
      yearStatus: item.academicYear.status,
      studentCount: item._count.enrollments,
    }));
  }

  async batches(user: AuthenticatedUser) {
    this.authorization.assertSchoolAccess(user, 'fee.read');
    const batches = await this.prisma.feeBatch.findMany({
      where: { schoolId: user.schoolId },
      include: {
        classSection: {
          select: {
            name: true,
            grade: { select: { name: true } },
            academicYear: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return batches.map((batch) => this.view(batch));
  }

  private view(
    batch: FeeBatch & {
      classSection?: { name: string; grade: { name: string }; academicYear: { name: string } };
    },
  ) {
    return {
      id: batch.id,
      classSectionId: batch.classSectionId,
      className: batch.classSection?.name,
      grade: batch.classSection?.grade.name,
      academicYear: batch.classSection?.academicYear.name,
      title: batch.title,
      description: batch.description,
      amount: batch.amount.toFixed(2),
      currency: batch.currency,
      dueOn: batch.dueOn.toISOString().slice(0, 10),
      studentCount: batch.studentCount,
      total: batch.amount.mul(batch.studentCount).toFixed(2),
      createdAt: batch.createdAt,
      voidedAt: batch.voidedAt,
    };
  }

  private replay(
    batch: FeeBatch,
    user: AuthenticatedUser,
    dto: CreateClassFeeBatchDto,
    amount: Prisma.Decimal,
  ) {
    if (
      batch.schoolId !== user.schoolId ||
      batch.classSectionId !== dto.classSectionId ||
      batch.title !== dto.title.trim() ||
      batch.description !== (dto.description?.trim() || null) ||
      !batch.amount.eq(amount) ||
      batch.currency !== dto.currency ||
      batch.dueOn.toISOString().slice(0, 10) !== dto.dueOn
    )
      throw new ConflictException('Batch request key has already been used');
    return this.view(batch);
  }

  async create(user: AuthenticatedUser, dto: CreateClassFeeBatchDto) {
    this.authorization.assertSchoolAccess(user, 'fee.create');
    if (dto.title.trim().length < 2)
      throw new BadRequestException('Fee name must contain at least two characters');
    const amount = new Prisma.Decimal(dto.amount);
    if (!amount.isFinite() || amount.lte(0))
      throw new BadRequestException('Amount must be greater than zero');
    const dueOn = new Date(`${dto.dueOn}T00:00:00.000Z`);
    if (Number.isNaN(dueOn.getTime()) || dueOn.toISOString().slice(0, 10) !== dto.dueOn)
      throw new BadRequestException('Enter a valid due date');
    const existing = await this.prisma.feeBatch.findUnique({ where: { id: dto.batchId } });
    if (existing) return this.replay(existing, user, dto, amount);
    try {
      return await this.serializable(async (tx) => {
        const classSection = await tx.classSection.findFirst({
          where: { id: dto.classSectionId, schoolId: user.schoolId, deletedAt: null },
          select: { id: true },
        });
        if (!classSection) throw new NotFoundException('Class was not found');
        const duplicate = await tx.feeBatch.findFirst({
          where: {
            schoolId: user.schoolId,
            classSectionId: dto.classSectionId,
            title: dto.title.trim(),
            amount,
            currency: dto.currency,
            dueOn,
            voidedAt: null,
          },
          select: { id: true },
        });
        if (duplicate)
          throw new ConflictException(
            'A matching class charge already exists. Review recent class charges before posting another.',
          );
        const enrollments = await tx.enrollment.findMany({
          where: {
            schoolId: user.schoolId,
            classSectionId: dto.classSectionId,
            status: EnrollmentStatus.ACTIVE,
            student: { deletedAt: null },
          },
          select: { studentId: true },
        });
        const studentIds = [...new Set(enrollments.map((item) => item.studentId))];
        if (!studentIds.length) throw new BadRequestException('This class has no active students');
        if (studentIds.length > 5_000)
          throw new BadRequestException('A fee batch can include at most 5,000 students');
        const batch = await tx.feeBatch.create({
          data: {
            id: dto.batchId,
            schoolId: user.schoolId,
            classSectionId: classSection.id,
            title: dto.title.trim(),
            description: dto.description?.trim() || null,
            amount,
            currency: dto.currency,
            dueOn,
            studentCount: studentIds.length,
          },
        });
        await tx.feeCharge.createMany({
          data: studentIds.map((studentId) => ({
            schoolId: user.schoolId,
            studentId,
            batchId: batch.id,
            title: batch.title,
            description: batch.description,
            amount,
            currency: batch.currency,
            dueOn,
          })),
        });
        await tx.auditLog.create({
          data: {
            schoolId: user.schoolId,
            userId: user.id,
            action: 'FEE_BATCH_CREATED',
            entityType: 'FEE_BATCH',
            entityId: batch.id,
            newValue: {
              classSectionId: batch.classSectionId,
              studentCount: batch.studentCount,
              amount: amount.toFixed(2),
              currency: batch.currency,
              dueOn: dto.dueOn,
            },
          },
        });
        return this.view(batch);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const batch = await this.prisma.feeBatch.findUnique({ where: { id: dto.batchId } });
        if (batch) return this.replay(batch, user, dto, amount);
      }
      throw error;
    }
  }

  async void(user: AuthenticatedUser, batchId: string, reason: string) {
    this.authorization.assertSchoolAccess(user, 'fee.update');
    if (reason.trim().length < 3)
      throw new BadRequestException('A reason is required to void a class charge');
    return this.serializable(async (tx) => {
      const batch = await tx.feeBatch.findFirst({
        where: { id: batchId, schoolId: user.schoolId },
        include: {
          charges: { include: { payments: { where: { voidedAt: null }, select: { id: true } } } },
        },
      });
      if (!batch) throw new NotFoundException('Class charge was not found');
      if (batch.voidedAt) throw new ConflictException('Class charge is already voided');
      if (batch.charges.some((charge) => charge.payments.length))
        throw new ConflictException('Void all recorded payments before voiding this class charge');
      const now = new Date();
      await tx.feeCharge.updateMany({
        where: { batchId, schoolId: user.schoolId, voidedAt: null },
        data: { voidedAt: now, voidReason: reason.trim() },
      });
      await tx.feeBatch.update({
        where: { id: batchId },
        data: { voidedAt: now, voidReason: reason.trim() },
      });
      await tx.auditLog.create({
        data: {
          schoolId: user.schoolId,
          userId: user.id,
          action: 'FEE_BATCH_VOIDED',
          entityType: 'FEE_BATCH',
          entityId: batchId,
          newValue: { reason: reason.trim(), studentCount: batch.studentCount },
        },
      });
      return { id: batchId, voidedAt: now };
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
