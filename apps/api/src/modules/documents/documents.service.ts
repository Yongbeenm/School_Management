import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@school/database';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { StorageService } from '../storage/storage.service';
import { DocumentEntityType, DocumentUploadDto } from './dto/document-upload.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const maximumFileSize = 5 * 1024 * 1024;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async upload(schoolId: string, actorId: string, dto: DocumentUploadDto, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('A file is required');
    if (!allowedMimeTypes.has(file.mimetype) || !this.hasExpectedSignature(file)) {
      throw new BadRequestException('Only valid PDF, JPEG, and PNG files are allowed');
    }
    if (file.size > maximumFileSize) throw new BadRequestException('File exceeds the 5 MB limit');
    await this.assertEntityInSchool(dto.entityType, dto.entityId, schoolId);

    const storageKey = await this.storage.put(schoolId, file);
    try {
      const document = await this.prisma.document.create({
        data: {
          schoolId,
          uploadedById: actorId,
          storageKey,
          originalName: file.originalname.replace(/[\r\n]/g, '_'),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          scanStatus: 'CLEAN',
          links: { create: { entityType: dto.entityType, entityId: dto.entityId, label: dto.label?.trim() } },
        },
        include: { links: true },
      });
      await this.auditLogs.record({ schoolId, userId: actorId, action: 'DOCUMENT_UPLOADED', entityType: dto.entityType, entityId: dto.entityId, newValue: { documentId: document.id, label: dto.label } });
      return document;
    } catch (error) {
      await this.storage.delete(storageKey);
      throw error;
    }
  }

  async list(schoolId: string, entityType?: DocumentEntityType, entityId?: string) {
    if (entityType && entityId) await this.assertEntityInSchool(entityType, entityId, schoolId);
    return this.prisma.document.findMany({
      where: { schoolId, deletedAt: null, ...(entityType && entityId ? { links: { some: { entityType, entityId } } } : {}) },
      include: { links: true, uploadedBy: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' },
    });
  }

  async content(schoolId: string, id: string) {
    const document = await this.prisma.document.findFirst({ where: { id, schoolId, deletedAt: null } });
    if (!document) throw new NotFoundException('Document was not found');
    return { document, content: await this.storage.read(document.storageKey) };
  }

  async update(schoolId: string, actorId: string, id: string, dto: UpdateDocumentDto) {
    const previous = await this.prisma.document.findFirst({ where: { id, schoolId, deletedAt: null }, include: { links: true } });
    if (!previous) throw new NotFoundException('Document was not found');
    const updated = await this.prisma.document.update({
      where: { id },
      data: { links: { updateMany: { where: {}, data: { label: dto.label.trim() || null } } } },
      include: { links: true, uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    await this.auditLogs.record({
      schoolId,
      userId: actorId,
      action: 'DOCUMENT_UPDATED',
      entityType: 'DOCUMENT',
      entityId: id,
      oldValue: { label: previous.links[0]?.label },
      newValue: { label: updated.links[0]?.label },
    });
    return updated;
  }

  async archive(schoolId: string, actorId: string, id: string): Promise<void> {
    const document = await this.prisma.document.findFirst({ where: { id, schoolId, deletedAt: null } });
    if (!document) throw new NotFoundException('Document was not found');
    await this.prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.storage.delete(document.storageKey);
    await this.auditLogs.record({
      schoolId,
      userId: actorId,
      action: 'DOCUMENT_ARCHIVED',
      entityType: 'DOCUMENT',
      entityId: id,
      oldValue: { originalName: document.originalName, storageKey: document.storageKey },
    });
  }

  private async assertEntityInSchool(entityType: DocumentEntityType, entityId: string, schoolId: string): Promise<void> {
    const entityExists = await (async () => {
      if (entityType === 'STUDENT') return this.prisma.student.findFirst({ where: { id: entityId, schoolId, deletedAt: null } });
      if (entityType === 'PARENT') return this.prisma.parent.findFirst({ where: { id: entityId, schoolId, deletedAt: null } });
      if (entityType === 'STAFF') return this.prisma.staff.findFirst({ where: { id: entityId, schoolId, deletedAt: null } });
      return this.prisma.teacher.findFirst({ where: { id: entityId, staff: { schoolId, deletedAt: null } } });
    })();
    if (!entityExists) throw new NotFoundException(`${entityType.toLowerCase()} was not found`);
  }

  private hasExpectedSignature(file: Express.Multer.File): boolean {
    const signature = file.buffer.subarray(0, 8);
    if (file.mimetype === 'application/pdf') return signature.subarray(0, 5).toString('ascii') === '%PDF-';
    if (file.mimetype === 'image/jpeg') return signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    if (file.mimetype === 'image/png') return signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    return false;
  }
}
