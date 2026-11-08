import * as argon2 from 'argon2';
import { PermissionScope, PrismaClient, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

type PermissionDefinition = { code: string; name: string; description: string };
type Grant = { code: string; scope: PermissionScope };

const permissionCodes = [
  'user.read',
  'user.create',
  'user.update',
  'user.status.update',
  'user.role.assign',
  'role.read',
  'role.manage',
  'permission.read',
  'permission.manage',
  'school.read',
  'school.manage',
  'settings.manage',
  'audit.read',
  'dashboard.read',
  'student.create',
  'student.read',
  'student.update',
  'student.delete',
  'teacher.create',
  'teacher.read',
  'teacher.update',
  'teacher.delete',
  'parent.create',
  'parent.read',
  'parent.update',
  'parent.delete',
  'academic_year.create',
  'academic_year.read',
  'academic_year.update',
  'semester.create',
  'semester.read',
  'semester.update',
  'semester.close',
  'grade.create',
  'grade.read',
  'grade.update',
  'grade.delete',
  'class.create',
  'class.read',
  'class.update',
  'class.delete',
  'subject.create',
  'subject.read',
  'subject.update',
  'subject.delete',
  'class_subject.create',
  'class_subject.read',
  'class_subject.update',
  'class_subject.delete',
  'room.create',
  'room.read',
  'room.update',
  'room.delete',
  'enrollment.create',
  'enrollment.read',
  'enrollment.update',
  'timetable.create',
  'timetable.read',
  'timetable.update',
  'timetable.delete',
  'attendance.create',
  'attendance.read',
  'attendance.update',
  'attendance.override',
  'attendance.report',
  'assignment.create',
  'assignment.read',
  'assignment.update',
  'assignment.publish',
  'assignment.close',
  'assignment.delete',
  'assignment.submit',
  'assignment.grade',
  'exam.create',
  'exam.read',
  'exam.update',
  'exam.publish',
  'exam.lock',
  'mark.create',
  'mark.read',
  'mark.update',
  'mark.override',
  'mark.publish',
  'grading_scale.read',
  'grading_scale.manage',
  'report_card.read',
  'report_card.generate',
  'report_card.publish',
  'report_card.approve',
  'report_card.download',
  'report.view',
  'result.approve',
  'announcement.create',
  'announcement.read',
  'announcement.update',
  'announcement.archive',
  'notification.read',
  'document.read',
  'document.manage',
  'portal.read',
  'fee.create',
  'fee.read',
  'fee.update',
  'payment.create',
  'payment.read',
  'payment.void',
  'discount.create',
  'scholarship.create',
  'financial_report.read',
  'library.book.create',
  'library.book.read',
  'library.book.update',
  'library.book.archive',
  'library.copy.create',
  'library.copy.update',
  'library.borrowing.create',
  'library.borrowing.read',
  'library.borrowing.update',
  'library.borrowing.return',
] as const;

const permissions: PermissionDefinition[] = permissionCodes.map((code) => {
  const [module, action] = code.split(/\.(?=[^.]+$)/);
  return { code, name: code.replaceAll('.', ' '), description: `Allows ${code}`, module, action };
});
const grant = (codes: readonly string[], scope: PermissionScope): Grant[] =>
  codes.map((code) => ({ code, scope }));
const read = (codes: readonly string[], scope: PermissionScope): Grant[] => grant(codes, scope);
const platformPermissionCodes = [
  'dashboard.read',
  'school.read',
  'school.manage',
  'role.read',
  'role.manage',
  'permission.read',
  'permission.manage',
  'audit.read',
] as const;
const schoolAdminPermissionCodes = permissionCodes.filter(
  (code) => !['school.manage', 'role.manage', 'permission.manage'].includes(code),
);

const roleDefinitions: Array<{ code: string; name: string; grants: Grant[] }> = [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Admin',
    grants: grant(platformPermissionCodes, PermissionScope.GLOBAL),
  },
  {
    code: 'ADMIN',
    name: 'School Admin',
    grants: grant(schoolAdminPermissionCodes, PermissionScope.SCHOOL),
  },
  {
    code: 'PRINCIPAL',
    name: 'Principal',
    grants: read(
      [
        'dashboard.read',
        'student.read',
        'teacher.read',
        'parent.read',
        'academic_year.read',
        'semester.read',
        'grade.read',
        'class.read',
        'subject.read',
        'class_subject.read',
        'room.read',
        'enrollment.read',
        'timetable.read',
        'attendance.read',
        'attendance.report',
        'assignment.read',
        'exam.read',
        'mark.read',
        'grading_scale.read',
        'report_card.read',
        'report_card.approve',
        'report_card.download',
        'report.view',
        'result.approve',
        'announcement.read',
        'notification.read',
        'document.read',
        'portal.read',
      ],
      PermissionScope.SCHOOL,
    ),
  },
  {
    code: 'TEACHER',
    name: 'Teacher',
    grants: read(
      [
        'teacher.read',
        'student.read',
        'class.read',
        'subject.read',
        'class_subject.read',
        'timetable.read',
        'enrollment.read',
        'attendance.create',
        'attendance.read',
        'attendance.update',
        'assignment.create',
        'assignment.read',
        'assignment.update',
        'assignment.publish',
        'assignment.close',
        'assignment.grade',
        'exam.read',
        'mark.create',
        'mark.read',
        'mark.update',
        'report_card.read',
        'announcement.read',
        'notification.read',
        'document.read',
        'portal.read',
      ],
      PermissionScope.ASSIGNED,
    ),
  },
  {
    code: 'STUDENT',
    name: 'Student',
    grants: [
      ...read(
        [
          'student.read',
          'enrollment.read',
          'timetable.read',
          'attendance.read',
          'assignment.read',
          'assignment.submit',
          'exam.read',
          'mark.read',
          'report_card.read',
          'notification.read',
        ],
        PermissionScope.OWN,
      ),
      ...read(['announcement.read', 'portal.read'], PermissionScope.SCHOOL),
    ],
  },
  {
    code: 'PARENT',
    name: 'Parent',
    grants: [
      ...read(
        [
          'student.read',
          'enrollment.read',
          'timetable.read',
          'attendance.read',
          'assignment.read',
          'exam.read',
          'mark.read',
          'report_card.read',
        ],
        PermissionScope.LINKED,
      ),
      ...read(['notification.read'], PermissionScope.OWN),
      ...read(['announcement.read', 'portal.read'], PermissionScope.SCHOOL),
    ],
  },
  {
    code: 'ACCOUNTANT',
    name: 'Accountant',
    grants: read(
      [
        'dashboard.read',
        'student.read',
        'parent.read',
        'fee.create',
        'fee.read',
        'fee.update',
        'payment.create',
        'payment.read',
        'payment.void',
        'discount.create',
        'scholarship.create',
        'financial_report.read',
        'notification.read',
        'portal.read',
      ],
      PermissionScope.SCHOOL,
    ),
  },
  {
    code: 'LIBRARIAN',
    name: 'Librarian',
    grants: read(
      [
        'student.read',
        'library.book.create',
        'library.book.read',
        'library.book.update',
        'library.book.archive',
        'library.copy.create',
        'library.copy.update',
        'library.borrowing.create',
        'library.borrowing.read',
        'library.borrowing.update',
        'library.borrowing.return',
        'notification.read',
        'portal.read',
      ],
      PermissionScope.SCHOOL,
    ),
  },
];

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: 'default-organization' },
    update: {},
    create: { name: 'Default Education Organization', slug: 'default-organization' },
  });
  const school = await prisma.school.upsert({
    where: { code: 'DEFAULT' },
    update: {},
    create: { organizationId: organization.id, code: 'DEFAULT', name: 'Default School' },
  });
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: permission,
      create: permission,
    });
  }
  const roleByCode = new Map<string, { id: string }>();
  const newlyCreatedRoles = new Set<string>();
  for (const definition of roleDefinitions) {
    const existingRole = await prisma.role.findUnique({
      where: { code: definition.code },
      select: { id: true },
    });
    const role = await prisma.role.upsert({
      where: { code: definition.code },
      update: { name: definition.name, isSystem: true },
      create: { code: definition.code, name: definition.name, isSystem: true },
    });
    roleByCode.set(definition.code, role);
    if (!existingRole) newlyCreatedRoles.add(definition.code);
  }
  const permissionRows = await prisma.permission.findMany({ select: { id: true, code: true } });
  const permissionByCode = new Map(permissionRows.map((item) => [item.code, item.id]));
  for (const definition of roleDefinitions) {
    if (!newlyCreatedRoles.has(definition.code)) continue;
    const role = roleByCode.get(definition.code)!;
    await prisma.rolePermission.createMany({
      data: definition.grants.map((item) => ({
        roleId: role.id,
        permissionId: permissionByCode.get(item.code)!,
        scope: item.scope,
      })),
      skipDuplicates: true,
    });
  }
  const superAdmin = roleByCode.get('SUPER_ADMIN')!;
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@school.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email },
    update: { status: UserStatus.ACTIVE },
    create: {
      email,
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    },
  });
  await prisma.userSchool.upsert({
    where: { userId_schoolId: { userId: user.id, schoolId: school.id } },
    update: { isDefault: true },
    create: { userId: user.id, schoolId: school.id, isDefault: true },
  });
  await prisma.userRole.upsert({
    where: {
      userId_roleId_schoolId: { userId: user.id, roleId: superAdmin.id, schoolId: school.id },
    },
    update: {},
    create: { userId: user.id, roleId: superAdmin.id, schoolId: school.id },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
