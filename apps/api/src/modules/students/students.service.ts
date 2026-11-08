import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@school/database';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SchoolAccessService } from '../../common/services/school-access.service';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { LinkGuardianDto } from './dto/link-guardian.dto';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolAccess: SchoolAccessService,
    private readonly authorization: AuthorizationService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(user: AuthenticatedUser, query: PaginationQueryDto) {
    const scopeWhere = await this.authorization.studentWhere(user, 'student.read');
    const searchWhere: Prisma.StudentWhereInput | undefined = query.search ? { OR: [
      { studentCode: { contains: query.search, mode: 'insensitive' } },
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
    ] } : undefined;
    const where: Prisma.StudentWhereInput = searchWhere ? { AND: [scopeWhere, searchWhere] } : scopeWhere;
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          guardians: { include: { parent: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
          enrollments: { where: { status: 'ACTIVE' }, include: { classSection: { include: { grade: true, academicYear: true } } } },
        },
      }),
      this.prisma.student.count({ where }),
    ]);
    return { items, meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
  }

  async getOne(user: AuthenticatedUser, id: string) {
    await this.authorization.assertStudentAccess(user, 'student.read', id);
    const student = await this.prisma.student.findFirst({
      where: { id, schoolId: user.schoolId, deletedAt: null },
      include: {
        guardians: { include: { parent: true } },
        enrollments: { include: { classSection: { include: { grade: true } }, academicYear: true }, orderBy: { enrolledOn: 'desc' } },
      },
    });
    if (!student) throw new NotFoundException('Student was not found');
    return student;
  }

  async create(schoolId: string, actorId: string, dto: CreateStudentDto) {
    const existing = await this.prisma.student.findFirst({ where: { schoolId, studentCode: dto.studentCode.trim() } });
    if (existing) throw new ConflictException('Student code already exists');
    if (dto.userId) await this.assertAvailableUser(dto.userId, schoolId, 'studentProfile');

    const student = await this.prisma.student.create({
      data: {
        schoolId,
        studentCode: dto.studentCode.trim(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender?.trim(),
        email: dto.email?.toLowerCase(),
        phone: dto.phone?.trim(),
        address: dto.address?.trim(),
        userId: dto.userId,
      },
    });
    await this.audit(schoolId, actorId, 'STUDENT_CREATED', student.id, undefined, student);
    return student;
  }

  async update(schoolId: string, actorId: string, id: string, dto: UpdateStudentDto) {
    const previous = await this.schoolAccess.student(id, schoolId);
    if (dto.userId && dto.userId !== previous.userId) await this.assertAvailableUser(dto.userId, schoolId, 'studentProfile');
    if (dto.studentCode && dto.studentCode !== previous.studentCode) {
      const exists = await this.prisma.student.findFirst({ where: { schoolId, studentCode: dto.studentCode.trim(), id: { not: id } } });
      if (exists) throw new ConflictException('Student code already exists');
    }
    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.studentCode ? { studentCode: dto.studentCode.trim() } : {}),
        ...(dto.firstName ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName ? { lastName: dto.lastName.trim() } : {}),
        ...(dto.dateOfBirth ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.userId ? { userId: dto.userId } : {}),
      },
    });
    await this.audit(schoolId, actorId, 'STUDENT_UPDATED', id, previous, updated);
    return updated;
  }

  async archive(schoolId: string, actorId: string, id: string) {
    const previous = await this.schoolAccess.student(id, schoolId);
    const updated = await this.prisma.student.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
    await this.audit(schoolId, actorId, 'STUDENT_ARCHIVED', id, previous, updated);
  }

  async linkGuardian(schoolId: string, actorId: string, studentId: string, dto: LinkGuardianDto) {
    await Promise.all([this.schoolAccess.student(studentId, schoolId), this.schoolAccess.parent(dto.parentId, schoolId)]);
    const existing = await this.prisma.studentParent.findUnique({ where: { studentId_parentId: { studentId, parentId: dto.parentId } } });
    if (existing) throw new ConflictException('This guardian is already linked to the student');

    if (dto.isPrimaryContact) {
      await this.prisma.studentParent.updateMany({ where: { studentId }, data: { isPrimaryContact: false } });
    }
    const guardian = await this.prisma.studentParent.create({
      data: {
        studentId,
        parentId: dto.parentId,
        relationship: dto.relationship,
        isPrimaryContact: dto.isPrimaryContact ?? false,
        isLegalGuardian: dto.isLegalGuardian ?? false,
        pickupAuthorized: dto.pickupAuthorized ?? false,
      },
      include: { parent: true },
    });
    await this.audit(schoolId, actorId, 'STUDENT_GUARDIAN_LINKED', studentId, undefined, guardian);
    return guardian;
  }

  async unlinkGuardian(schoolId: string, actorId: string, studentId: string, parentId: string) {
    await this.schoolAccess.student(studentId, schoolId);
    const guardian = await this.prisma.studentParent.findUnique({ where: { studentId_parentId: { studentId, parentId } } });
    if (!guardian) throw new NotFoundException('Guardian relationship was not found');
    await this.prisma.studentParent.delete({ where: { studentId_parentId: { studentId, parentId } } });
    await this.audit(schoolId, actorId, 'STUDENT_GUARDIAN_UNLINKED', studentId, guardian, undefined);
  }

  async setProfilePhoto(schoolId: string, actorId: string, studentId: string, documentId: string) {
    const student = await this.schoolAccess.student(studentId, schoolId);
    const document = await this.prisma.document.findFirst({ where: { id: documentId, schoolId, deletedAt: null } });
    if (!document) throw new NotFoundException('Document was not found');
    if (!document.mimeType.startsWith('image/')) throw new BadRequestException('Student profile photo must be an image');
    const updated = await this.prisma.student.update({ where: { id: studentId }, data: { profilePhotoId: documentId } });
    await this.audit(schoolId, actorId, 'STUDENT_PHOTO_UPDATED', studentId, student, updated);
    return updated;
  }

  private async assertAvailableUser(userId: string, schoolId: string, profileRelation: 'studentProfile') {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, schoolMemberships: { some: { schoolId } } },
      include: { studentProfile: true },
    });
    if (!user) throw new NotFoundException('User was not found in this school');
    if (user[profileRelation]) throw new ConflictException('The selected user is already linked to a student profile');
  }

  private async audit(schoolId: string, userId: string, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    await this.auditLogs.record({
      schoolId, userId, action, entityType: 'STUDENT', entityId,
      ...(oldValue ? { oldValue: this.jsonValue(oldValue) } : {}),
      ...(newValue ? { newValue: this.jsonValue(newValue) } : {}),
    });
  }

  private jsonValue(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
}
