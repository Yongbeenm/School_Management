import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementAudience, NotificationType, Prisma } from '@school/database';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateAnnouncementDto } from './dto/announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogsService) {}

  async list(user: AuthenticatedUser) {
    const where: Prisma.AnnouncementWhereInput = { schoolId: user.schoolId, deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
    const audience = await this.audienceFilter(user);
    if (audience) where.AND = [audience];
    return this.prisma.announcement.findMany({ where, include: { classSection: { include: { grade: true } } }, orderBy: { publishedAt: 'desc' } });
  }

  async create(schoolId: string, userId: string, dto: CreateAnnouncementDto) {
    if (dto.audience === AnnouncementAudience.CLASS && !dto.classSectionId) throw new BadRequestException('A class is required for a class announcement');
    if (dto.classSectionId) {
      const classSection = await this.prisma.classSection.findFirst({ where: { id: dto.classSectionId, schoolId, deletedAt: null } });
      if (!classSection) throw new NotFoundException('Class was not found');
    }
    const row = await this.prisma.announcement.create({ data: { schoolId, title: dto.title.trim(), content: dto.content.trim(), audience: dto.audience, classSectionId: dto.classSectionId, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined } });
    const userIds = await this.recipients(schoolId, dto.audience, dto.classSectionId);
    await this.prisma.notification.createMany({ data: userIds.map((id) => ({ userId: id, title: row.title, message: row.content, type: NotificationType.ANNOUNCEMENT, referenceType: 'ANNOUNCEMENT', referenceId: row.id })) });
    await this.audit.record({ schoolId, userId, action: 'ANNOUNCEMENT_CREATED', entityType: 'ANNOUNCEMENT', entityId: row.id, newValue: { audience: row.audience, title: row.title } });
    return row;
  }

  async archive(schoolId: string, userId: string, id: string) {
    const row = await this.prisma.announcement.findFirst({ where: { id, schoolId, deletedAt: null } });
    if (!row) throw new NotFoundException('Announcement was not found');
    await this.prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({ schoolId, userId, action: 'ANNOUNCEMENT_ARCHIVED', entityType: 'ANNOUNCEMENT', entityId: id, oldValue: { title: row.title } });
  }

  private async audienceFilter(user: AuthenticatedUser): Promise<Prisma.AnnouncementWhereInput | undefined> {
    if (user.roles.some((role) => ['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL'].includes(role))) return undefined;
    if (user.roles.includes('STUDENT')) {
      const student = await this.prisma.student.findFirst({ where: { schoolId: user.schoolId, userId: user.id, deletedAt: null }, select: { enrollments: { where: { status: 'ACTIVE' }, select: { classSectionId: true } } } });
      const classIds = student?.enrollments.map((item) => item.classSectionId) ?? [];
      return { OR: [{ audience: AnnouncementAudience.ALL }, { audience: AnnouncementAudience.STUDENTS }, { audience: AnnouncementAudience.CLASS, classSectionId: { in: classIds } }] };
    }
    if (user.roles.includes('PARENT')) {
      const parent = await this.prisma.parent.findFirst({ where: { schoolId: user.schoolId, userId: user.id, deletedAt: null }, select: { students: { select: { student: { select: { enrollments: { where: { status: 'ACTIVE' }, select: { classSectionId: true } } } } } } } });
      const classIds = parent?.students.flatMap((link) => link.student.enrollments.map((enrollment) => enrollment.classSectionId)) ?? [];
      return { OR: [{ audience: AnnouncementAudience.ALL }, { audience: AnnouncementAudience.PARENTS }, { audience: AnnouncementAudience.CLASS, classSectionId: { in: classIds } }] };
    }
    if (user.roles.includes('TEACHER')) {
      const teacher = await this.prisma.teacher.findFirst({ where: { staff: { schoolId: user.schoolId, userId: user.id, deletedAt: null } }, select: { teachingAssignments: { where: { deletedAt: null }, select: { classSectionId: true } } } });
      const classIds = teacher?.teachingAssignments.map((item) => item.classSectionId) ?? [];
      return { OR: [{ audience: AnnouncementAudience.ALL }, { audience: AnnouncementAudience.TEACHERS }, { audience: AnnouncementAudience.CLASS, classSectionId: { in: classIds } }] };
    }
    return { audience: AnnouncementAudience.ALL };
  }

  private async recipients(schoolId: string, audience: AnnouncementAudience, classId?: string) {
    const where: Prisma.UserWhereInput = { deletedAt: null, schoolMemberships: { some: { schoolId } } };
    if (audience === AnnouncementAudience.TEACHERS) where.staffProfile = { is: { teacher: { isNot: null }, deletedAt: null } };
    if (audience === AnnouncementAudience.STUDENTS) where.studentProfile = { is: { deletedAt: null } };
    if (audience === AnnouncementAudience.PARENTS) where.parentProfile = { is: { deletedAt: null } };
    if (audience === AnnouncementAudience.CLASS && classId) where.OR = [{ studentProfile: { is: { enrollments: { some: { classSectionId: classId, status: 'ACTIVE' } } } } }, { parentProfile: { is: { students: { some: { student: { enrollments: { some: { classSectionId: classId, status: 'ACTIVE' } } } } } } } }];
    const users = await this.prisma.user.findMany({ where, select: { id: true } });
    return users.map((item) => item.id);
  }
}
