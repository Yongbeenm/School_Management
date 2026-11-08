import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller({ path: 'permissions', version: '1' })
export class PermissionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('permission.read')
  list() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true, description: true, module: true, action: true } });
  }
}
