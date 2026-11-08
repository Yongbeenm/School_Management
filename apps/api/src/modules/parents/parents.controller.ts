import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateParentDto, UpdateParentDto } from './dto/parent.dto';
import { ParentsService } from './parents.service';

@ApiTags('Parents') @ApiBearerAuth()
@Controller({ path: 'parents', version: '1' })
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}
  @Get() @RequirePermissions('parent.read') list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) { return this.parentsService.list(user.schoolId, query); }
  @Post() @RequirePermissions('parent.create') create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateParentDto) { return this.parentsService.create(user.schoolId, user.id, dto); }
  @Get(':id') @RequirePermissions('parent.read') getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.parentsService.getOne(user.schoolId, id); }
  @Patch(':id') @RequirePermissions('parent.update') update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateParentDto) { return this.parentsService.update(user.schoolId, user.id, id, dto); }
  @Delete(':id') @HttpCode(204) @RequirePermissions('parent.delete') archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.parentsService.archive(user.schoolId, user.id, id); }
}
