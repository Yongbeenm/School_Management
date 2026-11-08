import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { SchoolAccessModule } from './common/services/school-access.module';
import { AuthorizationModule } from './common/authorization/authorization.module';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { AcademicModule } from './modules/academic/academic.module';
import { StudentsModule } from './modules/students/students.module';
import { ParentsModule } from './modules/parents/parents.module';
import { StaffModule } from './modules/staff/staff.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { StorageModule } from './modules/storage/storage.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { MailerModule } from './modules/mailer/mailer.module';
import { TeachingAssignmentsModule } from './modules/teaching-assignments/teaching-assignments.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { ExamsModule } from './modules/exams/exams.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { FinanceModule } from './modules/finance/finance.module';

@Module({
  imports: [
    // `npm run dev --workspace @school/api` runs from apps/api, while shared
    // development configuration lives at the monorepo root.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    SchoolAccessModule,
    AuthorizationModule,
    AuditLogsModule,
    StorageModule,
    MailerModule,
    UsersModule,
    AuthModule,
    HealthModule,
    RolesModule,
    PermissionsModule,
    SchoolsModule,
    AcademicModule,
    TeachingAssignmentsModule,
    TimetableModule,
    AttendanceModule,
    AssignmentsModule,
    ExamsModule,
    AnnouncementsModule,
    NotificationsModule,
    ReportsModule,
    RoomsModule,
    FinanceModule,
    StudentsModule,
    ParentsModule,
    StaffModule,
    TeachersModule,
    EnrollmentsModule,
    DashboardModule,
    DocumentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
  ],
})
export class AppModule {}
