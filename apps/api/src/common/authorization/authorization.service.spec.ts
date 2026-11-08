import { ForbiddenException } from '@nestjs/common';
import { PermissionScope } from '@school/database';
import { jest } from '@jest/globals';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { AuthorizationService } from './authorization.service';

const user = (id: string, permissionScopes: AuthenticatedUser['permissionScopes']): AuthenticatedUser => ({
  id,
  email: `${id}@school.test`,
  sessionId: `session-${id}`,
  schoolId: 'school-1',
  roles: [],
  permissions: Object.keys(permissionScopes),
  permissionScopes,
});

const scoped = (permission: string, scope: PermissionScope) => ({ [permission]: [scope] });

describe('AuthorizationService object policies', () => {
  const findStudent = jest.fn<() => Promise<unknown>>();
  const findTeachingAssignment = jest.fn<() => Promise<unknown>>();
  const findStudentParent = jest.fn<() => Promise<unknown>>();
  const prisma = {
    student: { findFirst: findStudent },
    teachingAssignment: { findFirst: findTeachingAssignment },
    studentParent: { findFirst: findStudentParent },
  } as unknown as PrismaService;
  const service = new AuthorizationService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('filters a teacher to students in their assigned class subjects', async () => {
    const teacher = user('teacher-a', scoped('student.read', PermissionScope.ASSIGNED));
    const where = await service.studentWhere(teacher, 'student.read');

    expect(where).toMatchObject({
      schoolId: 'school-1',
      OR: [{ enrollments: { some: { classSection: { teachingAssignments: { some: { teacher: { staff: { userId: 'teacher-a' } } } } } } } }],
    });
  });

  it('rejects a teacher trying to read an unrelated student', async () => {
    const teacher = user('teacher-a', scoped('student.read', PermissionScope.ASSIGNED));
    findStudent.mockResolvedValue(null);

    await expect(service.assertStudentAccess(teacher, 'student.read', 'student-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['attendance.create', 'mark.update'])('rejects a teacher managing another teacher\'s class subject for %s', async (permission) => {
    const teacher = user('teacher-a', scoped(permission, PermissionScope.ASSIGNED));
    findTeachingAssignment.mockResolvedValue({
      id: 'assignment-b',
      teacher: { staff: { userId: 'teacher-b' } },
    });

    await expect(service.assertTeachingAssignmentAccess(teacher, permission, 'assignment-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['mark.read', 'attendance.read', 'report_card.read'])('rejects a student requesting another student\'s academic record for %s', async (permission) => {
    const student = user('student-a-user', scoped(permission, PermissionScope.OWN));
    findStudent.mockResolvedValue(null);

    await expect(service.assertStudentAccess(student, permission, 'student-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a parent who is not linked to the requested child', async () => {
    const parent = user('parent-a-user', scoped('student.read', PermissionScope.LINKED));
    findStudentParent.mockResolvedValue(null);

    await expect(service.assertParentChildAccess(parent, 'student-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not treat school access as a mark override grant', () => {
    const admin = user('admin-a', scoped('mark.read', PermissionScope.SCHOOL));
    expect(service.hasScope(admin, 'mark.override', PermissionScope.SCHOOL)).toBe(false);
  });
});
