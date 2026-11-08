import type { SessionUser } from '@/lib/api';

export function workspaceRoute(user: Pick<SessionUser, 'roles' | 'permissions'>): string {
  if (user.roles.includes('SUPER_ADMIN')) return '/admin/super';
  if (user.roles.includes('ADMIN')) return '/admin';
  if (user.roles.includes('PRINCIPAL')) return '/admin/principal';
  if (user.roles.includes('ACCOUNTANT')) return '/admin/accountant';
  if (user.roles.includes('LIBRARIAN')) return '/admin/librarian';
  if (user.roles.includes('TEACHER')) return '/teacher';
  if (user.roles.includes('STUDENT')) return '/student';
  if (user.roles.includes('PARENT')) return '/parent';
  if (user.permissions.includes('dashboard.read')) return '/admin';
  if (user.permissions.includes('student.read')) return '/admin/students';
  return '/notifications';
}

export function workspaceLabel(user: Pick<SessionUser, 'roles' | 'permissions'>): string {
  const home = workspaceRoute(user);
  if (home === '/admin/super') return 'Super Admin';
  if (home === '/admin') return 'Admin';
  if (home === '/admin/principal') return 'Principal';
  if (home === '/admin/accountant') return 'Accountant';
  if (home === '/admin/librarian') return 'Librarian';
  if (home === '/teacher') return 'Teacher';
  if (home === '/student') return 'Student';
  if (home === '/parent') return 'Parent';
  return user.roles[0]?.replaceAll('_', ' ') ?? 'Staff';
}
