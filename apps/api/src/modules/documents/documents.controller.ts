import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { DocumentEntityType, DocumentUploadDto } from './dto/document-upload.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentsService } from './documents.service';

@ApiTags('Documents') @ApiBearerAuth()
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post() @RequirePermissions('document.manage') @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  upload(@CurrentUser() user: AuthenticatedUser, @Body() dto: DocumentUploadDto, @UploadedFile() file?: Express.Multer.File) {
    return this.documentsService.upload(user.schoolId, user.id, dto, file);
  }

  @Get() @RequirePermissions('document.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query('entityType') entityType?: DocumentEntityType, @Query('entityId') entityId?: string) {
    return this.documentsService.list(user.schoolId, entityType, entityId);
  }

  @Get(':id/download') @RequirePermissions('document.read')
  async download(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() response: Response): Promise<void> {
    const { document, content } = await this.documentsService.content(user.schoolId, id);
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader('Content-Length', document.sizeBytes);
    response.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    response.send(content);
  }

  @Patch(':id') @RequirePermissions('document.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documentsService.update(user.schoolId, user.id, id, dto);
  }

  @Delete(':id') @HttpCode(204) @RequirePermissions('document.manage')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.documentsService.archive(user.schoolId, user.id, id);
  }
}
