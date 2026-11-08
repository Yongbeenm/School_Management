import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PermissionScope, Prisma } from '@school/database';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { CreateTimetableEntryDto, UpdateTimetableEntryDto } from './dto/timetable.dto';

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService, private readonly auditLogs: AuditLogsService, private readonly authorization: AuthorizationService) {}

  async list(user: AuthenticatedUser, classSectionId?: string, semesterId?: string, teacherId?: string, roomId?: string) {
    const accessWhere = this.accessWhere(user, 'timetable.read');
    return this.prisma.timetableEntry.findMany({
      where: {
        schoolId: user.schoolId,
        deletedAt: null,
        ...accessWhere,
        ...(roomId ? { roomId } : {}),
        ...(classSectionId || semesterId || teacherId ? { teachingAssignment: { ...(classSectionId ? { classSectionId } : {}), ...(semesterId ? { semesterId } : {}), ...(teacherId ? { teacherId } : {}) } } : {}),
      },
      include: this.includeRelations(),
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async create(schoolId: string, actorId: string, dto: CreateTimetableEntryDto) {
    const { assignment, startTime, endTime } = await this.validateSchedule(schoolId, dto);
    const created = await this.prisma.timetableEntry.create({
      data: { schoolId, teachingAssignmentId: assignment.id, roomId: dto.roomId, dayOfWeek: dto.dayOfWeek, startTime, endTime },
      include: this.includeRelations(),
    });
    await this.audit(schoolId, actorId, 'TIMETABLE_ENTRY_CREATED', created.id, undefined, created);
    return created;
  }

  async update(schoolId: string, actorId: string, id: string, dto: UpdateTimetableEntryDto) {
    const previous = await this.prisma.timetableEntry.findFirst({ where: { id, schoolId, deletedAt: null } });
    if (!previous) throw new NotFoundException('Timetable entry was not found');
    const input: CreateTimetableEntryDto = {
      teachingAssignmentId: dto.teachingAssignmentId ?? previous.teachingAssignmentId,
      roomId: dto.roomId ?? previous.roomId ?? undefined,
      dayOfWeek: dto.dayOfWeek ?? previous.dayOfWeek,
      startTime: dto.startTime ?? previous.startTime.toISOString().slice(11, 16),
      endTime: dto.endTime ?? previous.endTime.toISOString().slice(11, 16),
    };
    const { assignment, startTime, endTime } = await this.validateSchedule(schoolId, input, id);
    const updated = await this.prisma.timetableEntry.update({
      where: { id }, data: { teachingAssignmentId: assignment.id, roomId: input.roomId, dayOfWeek: input.dayOfWeek, startTime, endTime }, include: this.includeRelations(),
    });
    await this.audit(schoolId, actorId, 'TIMETABLE_ENTRY_UPDATED', id, previous, updated);
    return updated;
  }

  async archive(schoolId: string, actorId: string, id: string): Promise<void> {
    const previous = await this.prisma.timetableEntry.findFirst({ where: { id, schoolId, deletedAt: null } });
    if (!previous) throw new NotFoundException('Timetable entry was not found');
    const updated = await this.prisma.timetableEntry.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(schoolId, actorId, 'TIMETABLE_ENTRY_ARCHIVED', id, previous, updated);
  }

  private time(value: string): Date { return new Date(`1970-01-01T${value}:00.000Z`); }

  private accessWhere(user: AuthenticatedUser, permission: string): Prisma.TimetableEntryWhereInput {
    if (this.authorization.hasSchoolAccess(user, permission)) return {};
    const alternatives: Prisma.TimetableEntryWhereInput[] = [];
    if (this.authorization.hasScope(user, permission, PermissionScope.ASSIGNED)) {
      alternatives.push({ teachingAssignment: { teacher: { staff: { schoolId: user.schoolId, userId: user.id, deletedAt: null } } } });
    }
    if (this.authorization.hasScope(user, permission, PermissionScope.OWN)) {
      alternatives.push({ teachingAssignment: { classSection: { enrollments: { some: { status: 'ACTIVE', student: { schoolId: user.schoolId, userId: user.id, deletedAt: null } } } } } });
    }
    if (this.authorization.hasScope(user, permission, PermissionScope.LINKED)) {
      alternatives.push({ teachingAssignment: { classSection: { enrollments: { some: { status: 'ACTIVE', student: { guardians: { some: { parent: { schoolId: user.schoolId, userId: user.id, deletedAt: null } } } } } } } } });
    }
    if (!alternatives.length) throw new ForbiddenException('No applicable timetable scope is granted');
    return { OR: alternatives };
  }

  private async validateSchedule(schoolId: string, dto: CreateTimetableEntryDto, excludingId?: string) {
    const startTime = this.time(dto.startTime); const endTime = this.time(dto.endTime);
    if (startTime >= endTime) throw new BadRequestException('A timetable entry must end after it starts');
    const assignment = await this.prisma.teachingAssignment.findFirst({ where: { id: dto.teachingAssignmentId, schoolId, deletedAt: null }, include: { classSection: true } });
    if (!assignment) throw new NotFoundException('Teaching assignment was not found');
    if (dto.roomId) {
      const room = await this.prisma.room.findFirst({ where: { id: dto.roomId, schoolId, deletedAt: null } });
      if (!room) throw new NotFoundException('Room was not found');
    }
    const overlaps = await this.prisma.timetableEntry.findMany({
      where: { schoolId, deletedAt: null, ...(excludingId ? { id: { not: excludingId } } : {}), dayOfWeek: dto.dayOfWeek, startTime: { lt: endTime }, endTime: { gt: startTime } }, include: { teachingAssignment: true },
    });
    if (overlaps.some((entry) => entry.teachingAssignment.classSectionId === assignment.classSectionId)) throw new ConflictException('The class already has a timetable entry during this time');
    if (overlaps.some((entry) => entry.teachingAssignment.teacherId === assignment.teacherId)) throw new ConflictException('The teacher already has a timetable entry during this time');
    if (dto.roomId && overlaps.some((entry) => entry.roomId === dto.roomId)) throw new ConflictException('The room is already booked during this time');
    return { assignment, startTime, endTime };
  }

  private includeRelations() {
    return {
      room: true,
      teachingAssignment: { include: { classSection: { include: { grade: true } }, subject: true, teacher: { include: { staff: true } }, semester: true } },
    } satisfies Prisma.TimetableEntryInclude;
  }

  private async audit(schoolId: string, userId: string, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    await this.auditLogs.record({ schoolId, userId, action, entityType: 'TIMETABLE_ENTRY', entityId,
      ...(oldValue ? { oldValue: JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue } : {}),
      ...(newValue ? { newValue: JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue } : {}),
    });
  }
}
