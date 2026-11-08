'use client';

import {
  Award,
  Bell,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  DoorOpen,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  Search,
  ReceiptText,
  School,
  ShieldCheck,
  UserRoundCheck,
  UserRoundCog,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PropsWithChildren, useEffect, useState } from 'react';
import { PermissionGate } from '@/components/auth/permission-gate';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { workspaceLabel, workspaceRoute } from '@/lib/workspace-route';

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permissions: string[];
  roles?: string[];
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard, permissions: ['dashboard.read'] },
    ],
  },
  {
    label: 'School setup',
    items: [
      {
        href: '/admin/academic',
        label: 'Academic setup',
        icon: BookOpenCheck,
        permissions: [
          'academic_year.read',
          'semester.read',
          'grade.read',
          'subject.read',
          'class.read',
        ],
      },
      { href: '/admin/rooms', label: 'Rooms', icon: DoorOpen, permissions: ['room.read'] },
      {
        href: '/admin/teachers',
        label: 'Teachers & staff',
        icon: UserRoundCheck,
        permissions: ['teacher.read'],
      },
    ],
  },
  {
    label: 'Students',
    items: [
      {
        href: '/admin/students',
        label: 'Student directory',
        icon: GraduationCap,
        permissions: ['student.read'],
      },
      {
        href: '/admin/parents',
        label: 'Parents & guardians',
        icon: Users,
        permissions: ['parent.read'],
      },
      {
        href: '/admin/enrollments',
        label: 'Class enrolments',
        icon: CalendarDays,
        permissions: ['enrollment.read'],
      },
    ],
  },
  {
    label: 'Teaching day',
    items: [
      {
        href: '/admin/teaching-assignments',
        label: 'Class subjects',
        icon: UserRoundCheck,
        permissions: ['class_subject.read'],
      },
      {
        href: '/admin/timetable',
        label: 'Timetable',
        icon: CalendarClock,
        permissions: ['timetable.read'],
      },
      {
        href: '/admin/attendance',
        label: 'Attendance',
        icon: ClipboardCheck,
        permissions: ['attendance.read'],
      },
      {
        href: '/admin/assignments',
        label: 'Assignments',
        icon: ClipboardList,
        permissions: ['assignment.read'],
      },
    ],
  },
  {
    label: 'Results',
    items: [
      {
        href: '/admin/exams',
        label: 'Exams & marks',
        icon: Award,
        permissions: ['exam.read', 'mark.read'],
      },
      {
        href: '/admin/report-cards',
        label: 'Report cards',
        icon: FileText,
        permissions: ['report_card.read'],
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        href: '/admin/finance',
        label: 'Student ledger',
        icon: CreditCard,
        permissions: ['fee.read'],
      },
      {
        href: '/admin/finance/receivables',
        label: 'Receivables',
        icon: ReceiptText,
        permissions: ['fee.read'],
      },
      {
        href: '/admin/finance/collections',
        label: 'Collections',
        icon: FileText,
        permissions: ['payment.read'],
      },
      {
        href: '/admin/finance/bulk',
        label: 'Charge a class',
        icon: Users,
        permissions: ['fee.create'],
      },
    ],
  },
  {
    label: 'Communication',
    items: [
      {
        href: '/admin/announcements',
        label: 'Announcements',
        icon: Megaphone,
        permissions: ['announcement.read'],
      },
      {
        href: '/notifications',
        label: 'Notifications',
        icon: Bell,
        permissions: ['notification.read'],
      },
      {
        href: '/admin/documents',
        label: 'Documents',
        icon: UserRoundCog,
        permissions: ['document.read'],
      },
    ],
  },
  {
    label: 'Platform',
    items: [
      {
        href: '/admin/schools',
        label: 'Schools & administrators',
        icon: School,
        permissions: ['school.manage'],
        roles: ['SUPER_ADMIN'],
      },
      {
        href: '/admin/access',
        label: 'Role permissions',
        icon: UserRoundCog,
        permissions: ['role.manage'],
        roles: ['SUPER_ADMIN'],
      },
    ],
  },
  {
    label: 'School administration',
    items: [
      {
        href: '/admin/users',
        label: 'Users & access',
        icon: ShieldCheck,
        permissions: ['user.read', 'role.read'],
        roles: ['ADMIN'],
      },
      {
        href: '/admin/settings',
        label: 'School settings',
        icon: School,
        permissions: ['school.read', 'settings.manage'],
        roles: ['ADMIN'],
      },
    ],
  },
];

const developmentItems: NavigationItem[] =
  process.env.NODE_ENV === 'production'
    ? []
    : [
        {
          href: '/dev/test-accounts',
          label: 'Test accounts',
          icon: ClipboardList,
          permissions: ['dashboard.read'],
        },
      ];

export function AdminShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout, hasAnyPermission } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [today, setToday] = useState('');
  const groups = developmentItems.length
    ? [...navigationGroups, { label: 'Development', items: developmentItems }]
    : navigationGroups;

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [isLoading, router, user]);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => setSearchTerm(''), [pathname]);
  useEffect(() => {
    setToday(
      new Intl.DateTimeFormat('en', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    );
  }, []);

  if (isLoading || !user) return <main className="p-8 text-slate-600">Loading workspace…</main>;
  const homeHref = workspaceRoute(user);
  const roleLabel = workspaceLabel(user);
  const platformWorkspace = user.roles.includes('SUPER_ADMIN');
  const canSeeItem = (item: NavigationItem) =>
    hasAnyPermission(item.permissions) &&
    (!item.roles || item.roles.some((role) => user.roles.includes(role)));
  const searchResults = searchTerm.trim()
    ? groups
        .flatMap((group) => group.items)
        .map((item) =>
          item.href === '/admin' ? { ...item, href: homeHref, label: 'My dashboard' } : item,
        )
        .filter(canSeeItem)
        .filter((item) => item.label.toLowerCase().includes(searchTerm.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  return (
    <div className="school-app min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-white/10 bg-[#071a31] px-4 py-4 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:px-3 lg:py-6">
        <div className="flex items-center justify-between">
          <Link
            className="flex items-center gap-3 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            href={homeHref}
          >
            <span className="grid size-10 place-items-center rounded-xl border border-white/30 bg-white/10 text-white shadow-sm">
              <GraduationCap size={22} />
            </span>
            <span>
              <strong className="block text-sm font-bold text-white">School Management</strong>
              <small className="text-xs text-blue-200/75">
                {platformWorkspace ? 'Platform control' : 'Academic workspace'}
              </small>
            </span>
          </Link>
          <button
            aria-controls="school-navigation"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            className="rounded-lg border border-white/20 p-2 text-white lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav
          aria-label={platformWorkspace ? 'Platform workspace' : 'School workspace'}
          className={`${menuOpen ? 'block' : 'hidden'} mt-5 space-y-5 border-t border-white/10 pt-5 lg:block lg:flex-1 lg:border-0 lg:pt-3`}
          id="school-navigation"
        >
          {!user.permissions.includes('dashboard.read') && homeHref !== '/admin/students' && (
            <Link
              aria-current={pathname === homeHref ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-200/80 hover:bg-white/10 hover:text-white',
                pathname === homeHref && 'bg-[#086bd4] text-white hover:bg-[#147ce8]',
              )}
              href={homeHref}
            >
              <LayoutDashboard size={17} /> My home
            </Link>
          )}
          {groups.map(
            (group) =>
              group.items.some(canSeeItem) && (
                <section key={group.label}>
                  <h2 className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.17em] text-blue-200/55">
                    {group.label}
                  </h2>
                  <div className="grid gap-1">
                    {group.items.filter(canSeeItem).map((item) => {
                      const Icon = item.icon;
                      const href = item.href === '/admin' ? homeHref : item.href;
                      const active =
                        item.href === '/admin' || item.href === '/admin/finance'
                          ? pathname === href
                          : pathname.startsWith(href);
                      return (
                        <PermissionGate anyOf={item.permissions} key={item.href}>
                          <Link
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-200/80 transition focus:outline-none focus:ring-2 focus:ring-blue-400 hover:bg-white/10 hover:text-white',
                              active &&
                                'bg-[#086bd4] text-white shadow-[0_8px_20px_-12px_rgba(0,109,220,0.9)] hover:bg-[#147ce8]',
                            )}
                            href={href}
                          >
                            <Icon size={17} />{' '}
                            {item.href === '/admin' ? 'My dashboard' : item.label}
                          </Link>
                        </PermissionGate>
                      );
                    })}
                  </div>
                </section>
              ),
          )}
        </nav>
        <div
          className={`${menuOpen ? 'block' : 'hidden'} mt-5 border-t border-white/10 pt-4 lg:block`}
        >
          <div className="mb-3 flex items-center gap-3 px-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#086bd4] text-xs font-bold text-white">
              {user.email.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{user.email}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-blue-200/65">
                {roleLabel}
              </p>
            </div>
          </div>
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-200/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            onClick={() => void logout().then(() => router.replace('/auth/login'))}
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <section className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-[#dce7ed] bg-white px-5 py-4 md:px-8 lg:min-h-20 lg:flex-row lg:items-center lg:justify-between lg:gap-5 lg:px-9">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {today || 'Your school workspace'}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[#102641]">
              Welcome back, {roleLabel.toLowerCase()}
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={17}
              />
              <input
                aria-label="Find a page or task"
                className="h-10 w-full rounded-full border border-[#dce7ed] bg-[#f8fbfd] pl-10 pr-4 text-sm text-[#102641] outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchTerm('');
                  if (event.key === 'Enter' && searchResults[0]) {
                    router.push(searchResults[0].href);
                    setSearchTerm('');
                  }
                }}
                placeholder="Find a page or task…"
                type="search"
                value={searchTerm}
              />
              {searchTerm.trim() && (
                <div className="absolute right-0 top-full z-30 mt-2 w-full min-w-64 overflow-hidden rounded-2xl border border-[#dce7ed] bg-white p-1.5 shadow-xl">
                  {searchResults.length ? (
                    searchResults.map((item) => (
                      <Link
                        className="block rounded-xl px-3 py-2 text-sm text-[#102641] hover:bg-blue-50"
                        href={item.href}
                        key={item.href}
                        onClick={() => setSearchTerm('')}
                      >
                        {item.label}
                      </Link>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-slate-500">No matching pages.</p>
                  )}
                </div>
              )}
            </div>
            <Link
              aria-label="Notifications"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-[#dce7ed] text-[#223c58] transition hover:bg-blue-50"
              href="/notifications"
            >
              <Bell size={18} />
            </Link>
            <span className="hidden items-center gap-2 rounded-full border border-[#dce7ed] bg-white py-1 pl-1 pr-3 text-xs font-semibold text-[#102641] sm:flex">
              <span className="grid size-8 place-items-center rounded-full bg-[#086bd4] text-white">
                {user.email.slice(0, 2).toUpperCase()}
              </span>
              {roleLabel}
            </span>
          </div>
        </div>
        <div className="mx-auto max-w-[1500px] p-5 md:p-8 lg:p-9">{children}</div>
      </section>
    </div>
  );
}
