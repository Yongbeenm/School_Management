'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  Megaphone,
  Plus,
  Sparkles,
  Users,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, PageHeader } from '@/components/admin/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { workspaceRoute } from '@/lib/workspace-route';

interface DashboardData {
  activeAcademicYear: { name: string } | null;
  stats: { students: number; teachers: number; classes: number; activeEnrollments: number };
  recentStudents: {
    id: string;
    studentCode: string;
    firstName: string;
    lastName: string;
    createdAt: string;
  }[];
  classCounts: { classId: string; className: string; enrolledStudents: number }[];
}

type Semester = { id: string; name: string; status: string; academicYear: { name: string } };
type Exam = { id: string; name: string; startsOn: string; status: string };
type Announcement = { id: string; title: string; audience: string; publishedAt: string };

const nextSteps = [
  {
    number: '1',
    title: 'Set up the academic year',
    description: 'Confirm the year, semester, grades, subjects, and classes.',
    href: '/admin/academic',
    permission: 'academic_year.read',
  },
  {
    number: '2',
    title: 'Add and enrol students',
    description: 'Create student profiles, add guardians, then place students in a class.',
    href: '/admin/students',
    permission: 'student.read',
  },
  {
    number: '3',
    title: 'Prepare the teaching day',
    description: 'Assign class subjects, set the timetable, and take attendance.',
    href: '/admin/teaching-assignments',
    permission: 'class_subject.read',
  },
  {
    number: '4',
    title: 'Track learning progress',
    description: 'Publish assignments, enter marks, and generate report cards.',
    href: '/admin/assignments',
    permission: 'assignment.read',
  },
];

export default function AdminDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && user) {
      const destination = workspaceRoute(user);
      if (destination !== '/admin') router.replace(destination);
    }
  }, [isLoading, router, user]);
  if (isLoading || !user || workspaceRoute(user) !== '/admin') {
    return <main className="p-8 text-slate-600">Opening your dashboard…</main>;
  }
  return <AdminOperationsDashboard />;
}

function AdminOperationsDashboard() {
  const { hasPermission } = useAuth();
  const dashboard = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiFetch<DashboardData>('/dashboard/admin'),
    enabled: hasPermission('dashboard.read'),
  });
  const semesters = useQuery({
    queryKey: ['dashboard-semesters'],
    queryFn: () => apiFetch<Semester[]>('/semesters'),
    enabled: hasPermission('semester.read'),
  });
  const exams = useQuery({
    queryKey: ['dashboard-exams'],
    queryFn: () => apiFetch<Exam[]>('/exams'),
    enabled: hasPermission('exam.read'),
  });
  const announcements = useQuery({
    queryKey: ['dashboard-announcements'],
    queryFn: () => apiFetch<Announcement[]>('/announcements'),
    enabled: hasPermission('announcement.read'),
  });
  const data = dashboard.data;
  const activeSemester = semesters.data?.find((semester) => semester.status === 'ACTIVE');
  const upcomingExams =
    exams.data
      ?.filter((exam) => exam.status === 'SCHEDULED' && new Date(exam.startsOn) >= new Date())
      .slice(0, 3) ?? [];
  const metrics = [
    {
      title: 'Active students',
      value: data?.stats.students ?? 0,
      icon: GraduationCap,
      detail: 'Student profiles in your school',
      tone: 'bg-sky-100 text-blue-700',
    },
    {
      title: 'Teachers',
      value: data?.stats.teachers ?? 0,
      icon: UserRoundCheck,
      detail: 'Active teaching staff',
      tone: 'bg-emerald-100 text-emerald-700',
    },
    {
      title: 'Classes',
      value: data?.stats.classes ?? 0,
      icon: UsersRound,
      detail: data?.activeAcademicYear?.name ?? 'Set an academic year',
      tone: 'bg-amber-100 text-amber-700',
    },
    {
      title: 'Current enrolments',
      value: data?.stats.activeEnrollments ?? 0,
      icon: Users,
      detail: 'Students placed in a class',
      tone: 'bg-violet-100 text-violet-700',
    },
  ];

  return (
    <>
      <PageHeader
        title="School overview"
        description="The people, classes, and work that matter today, all in one place."
      />
      {dashboard.isError && (
        <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          We could not load the school overview: {dashboard.error.message}
        </p>
      )}
      {!data?.activeAcademicYear && !dashboard.isLoading && (
        <PermissionGate permission="academic_year.read">
          <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold">Start by setting up the academic year</p>
              <p className="mt-1 text-sm text-amber-900">
                Classes, enrolments, teaching assignments, and reports need an academic year first.
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-900"
              href="/admin/academic"
            >
              Open academic setup <ArrowRight size={16} />
            </Link>
          </section>
        </PermissionGate>
      )}
      <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(315px,1fr)]">
        <div className="relative flex min-h-[272px] overflow-hidden rounded-[24px] bg-[#102a4c] bg-[url('/images/campus-welcome.jpg')] bg-cover bg-center text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-[#092447]/95 via-[#103962]/80 to-[#0b2b4c]/15" />
          <div className="relative flex w-full flex-col justify-center p-6 md:p-8">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <Sparkles size={14} />{' '}
              {activeSemester
                ? `${activeSemester.academicYear.name} · ${activeSemester.name}`
                : 'School workspace'}
            </p>
            <h2 className="mt-5 max-w-xl text-2xl font-bold tracking-tight md:text-[2rem]">
              Welcome back to your school
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-blue-50">
              {activeSemester
                ? 'See what is happening across your classes and keep the term moving.'
                : 'Set up the academic year, then bring your classes and students together.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <PermissionGate permission="attendance.read">
                <Link
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#0b3765] transition hover:bg-blue-50"
                  href="/admin/attendance"
                >
                  View attendance <ArrowRight size={15} />
                </Link>
              </PermissionGate>
              <PermissionGate permission="announcement.create">
                <Link
                  className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
                  href="/admin/announcements"
                >
                  Post announcement
                </Link>
              </PermissionGate>
            </div>
          </div>
        </div>
        <Card>
          <div>
            <h2 className="text-lg font-semibold text-[#071a31]">At a glance</h2>
            <p className="mt-1 text-sm text-slate-500">Your current school snapshot</p>
          </div>
          <div className="mt-5 divide-y divide-[#e8eff3]">
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-slate-600">Academic year</span>
              <strong className="text-right text-[#102641]">
                {data?.activeAcademicYear?.name ?? 'Not set'}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-slate-600">Active semester</span>
              <strong className="text-right text-[#102641]">
                {activeSemester?.name ?? 'Not set'}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-slate-600">Classes ready</span>
              <strong className="text-[#102641]">
                {dashboard.isLoading ? '—' : (data?.stats.classes ?? 0)}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-slate-600">Next scheduled exam</span>
              <strong className="max-w-40 truncate text-right text-[#102641]">
                {exams.isLoading ? 'Loading…' : (upcomingExams[0]?.name ?? 'None scheduled')}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-slate-600">Latest announcement</span>
              <strong className="max-w-40 truncate text-right text-[#102641]">
                {announcements.isLoading
                  ? 'Loading…'
                  : (announcements.data?.[0]?.title ?? 'None yet')}
              </strong>
            </div>
          </div>
        </Card>
      </section>
      <section aria-label="School totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-600">{metric.title}</p>
                  <p className="mt-2 text-[2rem] font-bold tracking-tight text-[#071a31]">
                    {dashboard.isLoading ? '—' : metric.value}
                  </p>
                </div>
                <span className={`grid size-11 place-items-center rounded-2xl ${metric.tone}`}>
                  <Icon size={20} />
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-600">{metric.detail}</p>
            </Card>
          );
        })}
      </section>
      <section className="mt-7 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-950">Recent student records</h2>
              <p className="mt-1 text-sm text-slate-600">Newly added profiles.</p>
            </div>
            <PermissionGate permission="student.read">
              <Link
                className="text-sm font-semibold text-teal-700 hover:underline"
                href="/admin/students"
              >
                View students
              </Link>
            </PermissionGate>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {data?.recentStudents.length ? (
              data.recentStudents.map((student) => (
                <div
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                  key={student.id}
                >
                  <span>
                    <strong className="text-slate-900">
                      {student.firstName} {student.lastName}
                    </strong>
                    <small className="ml-2 text-slate-500">{student.studentCode}</small>
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(student.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-5 text-sm text-slate-500">No student records yet.</p>
            )}
          </div>
          <div className="mt-6 border-t border-[#e8eff3] pt-5">
            <h3 className="font-semibold text-[#071a31]">Class enrolment</h3>
            <p className="mt-1 text-sm text-slate-500">Students currently placed in each class.</p>
            <div className="mt-5 space-y-4">
              {data?.classCounts.slice(0, 5).map((item) => (
                <div key={item.classId}>
                  <div className="mb-2 flex justify-between gap-3 text-sm">
                    <span className="font-medium text-[#102641]">{item.className}</span>
                    <strong className="text-[#102641]">{item.enrolledStudents}</strong>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#e8f1f8]">
                    <div
                      className="h-full rounded-full bg-[#086bd4]"
                      style={{
                        width: `${Math.max(3, Math.min(100, (item.enrolledStudents / Math.max(1, data.stats.activeEnrollments)) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              {data?.classCounts.length === 0 && (
                <p className="text-sm text-slate-500">No classes are set up yet.</p>
              )}
            </div>
          </div>
        </Card>
        <div className="grid gap-6">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">This term</h2>
                <p className="mt-1 text-sm text-slate-600">Current academic context.</p>
              </div>
              <CalendarClock className="text-teal-700" size={20} />
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              {activeSemester ? (
                <>
                  <p className="font-semibold text-slate-900">{activeSemester.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{activeSemester.academicYear.name}</p>
                  <Link
                    className="mt-3 inline-flex text-sm font-semibold text-teal-700 hover:underline"
                    href="/admin/academic"
                  >
                    Review academic setup
                  </Link>
                </>
              ) : (
                <p className="text-sm text-slate-500">No active semester is set.</p>
              )}
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {data?.classCounts.slice(0, 3).map((item) => (
                <div className="flex justify-between gap-3 py-2 text-sm" key={item.classId}>
                  <span className="text-slate-700">{item.className}</span>
                  <strong className="text-slate-900">{item.enrolledStudents}</strong>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">Coming up</h2>
                <p className="mt-1 text-sm text-slate-600">Exams and announcements.</p>
              </div>
              <Megaphone className="text-teal-700" size={20} />
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {upcomingExams.map((exam) => (
                <Link
                  className="block py-3 text-sm hover:text-teal-800"
                  href="/admin/exams"
                  key={exam.id}
                >
                  <strong>{exam.name}</strong>
                  <small className="mt-1 block text-slate-500">
                    {new Date(exam.startsOn).toLocaleDateString()} · {exam.status}
                  </small>
                </Link>
              ))}
              {announcements.data?.slice(0, 2).map((announcement) => (
                <Link
                  className="block py-3 text-sm hover:text-teal-800"
                  href="/admin/announcements"
                  key={announcement.id}
                >
                  <strong>{announcement.title}</strong>
                  <small className="mt-1 block text-slate-500">
                    {announcement.audience} ·{' '}
                    {new Date(announcement.publishedAt).toLocaleDateString()}
                  </small>
                </Link>
              ))}
              {!exams.isLoading &&
                !announcements.isLoading &&
                !upcomingExams.length &&
                !announcements.data?.length && (
                  <p className="py-5 text-sm text-slate-500">No upcoming items yet.</p>
                )}
            </div>
          </Card>
        </div>
      </section>
      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 className="text-teal-700" size={20} />
          <div>
            <h2 className="font-semibold text-slate-950">Recommended setup order</h2>
            <p className="text-sm text-slate-600">A simple path from setup to report cards.</p>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-4">
          {nextSteps.map((step) => (
            <PermissionGate key={step.number} permission={step.permission}>
              <Link
                className="group rounded-[20px] border border-[#dce7ed] bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                href={step.href}
              >
                <span className="grid size-8 place-items-center rounded-full bg-teal-700 text-sm font-bold text-white">
                  {step.number}
                </span>
                <h3 className="mt-4 font-semibold text-slate-900 group-hover:text-teal-800">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
                  Open task <ArrowRight size={15} />
                </span>
              </Link>
            </PermissionGate>
          ))}
        </div>
      </section>
      <section className="mt-7">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Common actions</h2>
              <p className="mt-1 text-sm text-slate-600">
                Shortcuts are shown only when your role can perform the action.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PermissionGate permission="student.create">
                <Link
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                  href="/admin/students"
                >
                  <Plus size={16} /> Add student
                </Link>
              </PermissionGate>
              <PermissionGate permission="enrollment.create">
                <Link
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  href="/admin/enrollments"
                >
                  Enrol student
                </Link>
              </PermissionGate>
              <PermissionGate permission="announcement.create">
                <Link
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  href="/admin/announcements"
                >
                  Post announcement
                </Link>
              </PermissionGate>
            </div>
          </div>
        </Card>
      </section>
    </>
  );
}
