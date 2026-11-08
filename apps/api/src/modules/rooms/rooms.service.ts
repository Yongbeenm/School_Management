import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@school/database';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogsService) {}

  list(schoolId: string) {
    return this.prisma.room.findMany({ where: { schoolId, deletedAt: null }, include: { campus: true }, orderBy: { code: 'asc' } });
  }

  async create(schoolId: string, userId: string, dto: CreateRoomDto) {
    await this.assertCampus(schoolId, dto.campusId);
    const code = dto.code.trim().toUpperCase();
    const duplicate = await this.prisma.room.findFirst({ where: { schoolId, code } });
    if (duplicate) throw new ConflictException('Room code already exists');
    const room = await this.prisma.room.create({ data: { schoolId, code, name: dto.name.trim(), campusId: dto.campusId, capacity: dto.capacity }, include: { campus: true } });
    await this.record(schoolId, userId, 'ROOM_CREATED', room.id, undefined, room);
    return room;
  }

  async update(schoolId: string, userId: string, id: string, dto: UpdateRoomDto) {
    const previous = await this.prisma.room.findFirst({ where: { id, schoolId, deletedAt: null } });
    if (!previous) throw new NotFoundException('Room was not found');
    await this.assertCampus(schoolId, dto.campusId);
    const code = dto.code?.trim().toUpperCase();
    if (code && code !== previous.code) {
      const duplicate = await this.prisma.room.findFirst({ where: { schoolId, code, id: { not: id } } });
      if (duplicate) throw new ConflictException('Room code already exists');
    }
    const room = await this.prisma.room.update({ where: { id }, data: { ...(code ? { code } : {}), ...(dto.name ? { name: dto.name.trim() } : {}), ...(dto.campusId !== undefined ? { campusId: dto.campusId } : {}), ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}) }, include: { campus: true } });
    await this.record(schoolId, userId, 'ROOM_UPDATED', room.id, previous, room);
    return room;
  }

  async archive(schoolId: string, userId: string, id: string) {
    const room = await this.prisma.room.findFirst({ where: { id, schoolId, deletedAt: null } });
    if (!room) throw new NotFoundException('Room was not found');
    const activeEntries = await this.prisma.timetableEntry.count({ where: { roomId: id, deletedAt: null } });
    if (activeEntries) throw new ConflictException('Archive or move timetable entries before archiving this room');
    const updated = await this.prisma.room.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.record(schoolId, userId, 'ROOM_ARCHIVED', id, room, updated);
  }

  private async assertCampus(schoolId: string, campusId?: string) {
    if (!campusId) return;
    const campus = await this.prisma.campus.findFirst({ where: { id: campusId, schoolId, deletedAt: null } });
    if (!campus) throw new NotFoundException('Campus was not found');
  }

  private record(schoolId: string, userId: string, action: string, entityId: string, oldValue: unknown, newValue: unknown) {
    return this.audit.record({ schoolId, userId, action, entityType: 'ROOM', entityId,
      ...(oldValue ? { oldValue: JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue } : {}),
      ...(newValue ? { newValue: JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue } : {}) });
  }
}
