import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateRoomDto, UpdateRoomDto } from './dto/room.dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms') @ApiBearerAuth()
@Controller({ path: 'rooms', version: '1' })
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}
  @Get() @RequirePermissions('room.read') list(@CurrentUser() user: AuthenticatedUser) { return this.rooms.list(user.schoolId); }
  @Post() @RequirePermissions('room.create') create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoomDto) { return this.rooms.create(user.schoolId, user.id, dto); }
  @Patch(':id') @RequirePermissions('room.update') update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRoomDto) { return this.rooms.update(user.schoolId, user.id, id, dto); }
  @Delete(':id') @HttpCode(204) @RequirePermissions('room.delete') archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.rooms.archive(user.schoolId, user.id, id); }
}
