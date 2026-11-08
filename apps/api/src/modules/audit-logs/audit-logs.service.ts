import { Injectable } from '@nestjs/common';
import { Prisma } from '@school/database';
import { PrismaService } from '../../database/prisma.service';

interface CreateAuditLogInput {
  schoolId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: CreateAuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({ data: input });
  }
}
