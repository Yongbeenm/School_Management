import { ForbiddenException, Injectable } from '@nestjs/common';
import { PermissionScope, Prisma } from '@school/database';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../types/authenticated-user.type';

/** Resolves grant scope; it intentionally does not contain module business rules. */
@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  scopes(user: AuthenticatedUser, permission: string): PermissionScope[] {
    return user.permissionScopes[permission] ?? [];
  }

  hasScope(user: AuthenticatedUser, permission: string, ...accepted: PermissionScope[]) {
    const granted = this.scopes(user, permission);
    return granted.includes(PermissionScope.GLOBAL) || accepted.some((scope) => granted.includes(scope));
  }

  hasSchoolAccess(user: AuthenticatedUser, permission: string) {
    return this.hasScope(user, permission, PermissionScope.SCHOOL);
  }

  assertSchoolAccess(user: AuthenticatedUser, permission: string) {
    if (!this.hasSchoolAccess(user, permission)) throw new ForbiddenException('This operation requires school-wide access');
  }

  async studentWhere(user: AuthenticatedUser, permission: string): Promise<Prisma.StudentWhereInput> {
    if (this.hasSchoolAccess(user, permission)) return { schoolId: user.schoolId, deletedAt: null };
    const options: Prisma.StudentWhereInput[] = [];
    if (this.hasScope(user, permission, PermissionScope.OWN)) options.push({ userId: user.id });
    if (this.hasScope(user, permission, PermissionScope.LINKED)) options.push({ guardians: { some: { parent: { userId: user.id, schoolId: user.schoolId, deletedAt: null } } } });
    if (this.hasScope(user, permission, PermissionScope.ASSIGNED)) {
      options.push({ enrollments: { some: { status: 'ACTIVE', classSection: { teachingAssignments: { some: { deletedAt: null, teacher: { staff: { userId: user.id, schoolId: user.schoolId, deletedAt: null } } } } } } } });
    }
    if (!options.length) return { id: '__unauthorized__' };
    return { schoolId: user.schoolId, deletedAt: null, OR: options };
  }

  async assertStudentAccess(user: AuthenticatedUser, permission: string, studentId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, ...(await this.studentWhere(user, permission)) } });
    if (!student) throw new ForbiddenException('You are not authorized to access this student');
    return student;
  }

  async assertTeachingAssignmentAccess(user: AuthenticatedUser, permission: string, teachingAssignmentId: string) {
    const assignment = await this.prisma.teachingAssignment.findFirst({ where: { id: teachingAssignmentId, schoolId: user.schoolId, deletedAt: null }, include: { teacher: { include: { staff: true } } } });
    if (!assignment) throw new ForbiddenException('You are not authorized to access this class subject');
    if (this.hasSchoolAccess(user, permission)) return assignment;
    if (this.hasScope(user, permission, PermissionScope.ASSIGNED) && assignment.teacher.staff.userId === user.id) return assignment;
    throw new ForbiddenException('You are not assigned to this class subject');
  }

  async assertParentChildAccess(user: AuthenticatedUser, studentId: string) {
    const linked = await this.prisma.studentParent.findFirst({ where: { studentId, parent: { schoolId: user.schoolId, userId: user.id, deletedAt: null } } });
    if (!linked) throw new ForbiddenException('You are not linked to this student');
  }
}
