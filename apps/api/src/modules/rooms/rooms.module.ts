import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({ imports: [AuditLogsModule], controllers: [RoomsController], providers: [RoomsService] })
export class RoomsModule {}
