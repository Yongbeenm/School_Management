'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  GraduationCap,
  School,
  Search,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Card, PageHeader } from '@/components/admin/page-header';
import { apiFetch } from '@/lib/api';
import { FeeCurrency, FinanceSummary, formatMoney } from '@/lib/finance';
import { useAuth } from '@/providers/auth-provider';

type SuperAdminSummary = {
  platform: { id: string; name: string } | null;
  generatedAt: string;
  stats: {
    schools: number;
    activeSchools: number;
    userAccounts: number;
    activeUserAccounts: number;
    students: number;
    staff: number;
    schoolAdmins: number;
    roles: number;
  };
  finance: PlatformFinance[];
  collectionTrend: { currency: FeeCurrency; points: { month: string; amount: string }[] }[];
  schoolPerformance: PlatformSchool[];
  recentSchools: {
    id: string;
    name: string;
    code: string;
    status: string;
    createdAt: string;
    _count: { students: number; staff: number };
    administrator: { firstName: string; lastName: string; email: string } | null;
  }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    school: { name: string; code: string };
    user: { firstName: string; lastName: string } | null;
  }[];
};

type PlatformFinance = {
  currency: FeeCurrency;
  billed: string;
  collected: string;
  outstanding: string;
  overdue: string;
  chargeCount: number;
  collectionRate: string;
};

type PlatformSchool = {
  id: string;
  name: string;
  code: string;
  status: string;
  createdAt: string;
  _count: { userSchools: number; students: number; staff: number; enrollments: number };
  administrator: { firstName: string; lastName: string; email: string } | null;
  finance: PlatformFinance[];
};

type PrincipalSummary = {
  school: {
    activeAcademicYear: { name: string } | null;
    stats: { students: number; teachers: number; classes: number };
  };
  stats: {
    pendingApprovals: number;
    approvedCards: number;
    scheduledExams: number;
    completedExams: number;
    attendanceRecords: number;
    attendanceRate: number | null;
  };
  reportCards: {
    id: string;
    gpa: number;
    average: number;
    student: { firstName: string; lastName: string; studentCode: string };
    semester: { name: string };
  }[];
  upcomingExams: { id: string; name: string; startsOn: string }[];
};

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string;
  status: string;
};
type Parent = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  students: { student: { firstName: string; lastName: string } }[];
};
type Page<T> = { items: T[]; meta: { total: number } };

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'bg-blue-50 text-blue-700',
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Users;
  tone?: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-600">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#071a31]">{value}</p>
        </div>
        <span className={`grid size-11 place-items-center rounded-2xl ${tone}`}>
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </Card>
  );
}

function TaskLink({
  href,
  title,
  detail,
  icon: Icon,
}: {
  href: string;
  title: string;
  detail: string;
  icon: typeof Users;
}) {
  return (
    <Link
      className="group flex items-center gap-3 rounded-2xl border border-[#dce7ed] bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
      href={href}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm text-[#102641]">{title}</strong>
        <small className="mt-0.5 block text-xs text-slate-500">{detail}</small>
      </span>
      <ArrowRight className="text-slate-400 group-hover:text-blue-700" size={17} />
    </Link>
  );
}

function QueryError({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</p>
  );
}

export function SuperAdminDashboard() {
  const summary = useQuery({
    queryKey: ['dashboard', 'super-admin'],
    queryFn: () => apiFetch<SuperAdminSummary>('/dashboard/super-admin'),
  });
  const data = summary.data;
  const atRiskSchools =
    data?.schoolPerformance.filter(
      (school) =>
        school.status !== 'ACTIVE' || school.finance.some((item) => Number(item.overdue) > 0),
    ).length ?? 0;
  return (
    <>
      <PageHeader
        title="Super admin dashboard"
        description="Executive intelligence for schools, people, enrollment, collections, and platform governance."
        eyebrow="Platform workspace"
      />
      {summary.isError && <QueryError message="Could not load platform intelligence data." />}
      <section className="mb-6 flex flex-col gap-5 rounded-[24px] bg-[#0b2b50] p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-blue-200">
            Executive view
          </p>
          <h2 className="mt-2 text-2xl font-bold">
            {data?.platform?.name ?? (summary.isLoading ? 'Loading platform…' : 'School platform')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-blue-100">
            {data
              ? `${data.stats.students.toLocaleString()} learners across ${data.stats.activeSchools} active schools. ${atRiskSchools} schools need executive attention.`
              : 'A consolidated view of platform growth and financial health.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-blue-50">
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              {data?.stats.schoolAdmins ?? '—'} school admins
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              {data?.stats.roles ?? '—'} access roles
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              Updated {data ? new Date(data.generatedAt).toLocaleString() : 'now'}
            </span>
          </div>
        </div>
        <Link
          className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#0b2b50]"
          href="/admin/schools"
        >
          Manage schools <ArrowRight size={16} />
        </Link>
      </section>
      <section aria-label="Platform totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Active schools"
          value={data?.stats.activeSchools ?? (summary.isLoading ? '—' : 0)}
          detail={`${data?.stats.schools ?? 0} schools registered in total`}
          icon={School}
          tone="bg-emerald-50 text-emerald-700"
        />
        <Metric
          label="User accounts"
          value={data?.stats.userAccounts.toLocaleString() ?? (summary.isLoading ? '—' : 0)}
          detail={`${data?.stats.activeUserAccounts.toLocaleString() ?? 0} accounts active`}
          icon={Users}
        />
        <Metric
          label="Students"
          value={data?.stats.students.toLocaleString() ?? (summary.isLoading ? '—' : 0)}
          detail="Learner profiles across all schools"
          icon={GraduationCap}
          tone="bg-amber-50 text-amber-700"
        />
        <Metric
          label="Staff"
          value={data?.stats.staff.toLocaleString() ?? (summary.isLoading ? '—' : 0)}
          detail="Teaching and operational staff profiles"
          icon={UserRoundCheck}
          tone="bg-violet-50 text-violet-700"
        />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              Financial intelligence
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#071a31]">Revenue and receivables</h2>
          </div>
          <p className="text-xs text-slate-500">Aggregated totals; school admins manage payments</p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {data?.finance.map((finance) => (
            <Card key={finance.currency}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-600">
                    {finance.currency} collections
                  </p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-[#071a31]">
                    {formatMoney(finance.collected, finance.currency)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Collected from {finance.chargeCount.toLocaleString()} charges
                  </p>
                </div>
                <span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <CircleDollarSign size={21} />
                </span>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(100, Number(finance.collectionRate))}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="font-semibold text-emerald-700">
                  {finance.collectionRate}% collected
                </span>
                <span className="text-slate-500">
                  {formatMoney(finance.billed, finance.currency)} billed
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-amber-50 p-3">
                  <p className="text-xs text-amber-800">Outstanding</p>
                  <strong className="mt-1 block text-sm text-amber-950">
                    {formatMoney(finance.outstanding, finance.currency)}
                  </strong>
                </div>
                <div className="rounded-2xl bg-red-50 p-3">
                  <p className="text-xs text-red-700">Overdue</p>
                  <strong className="mt-1 block text-sm text-red-950">
                    {formatMoney(finance.overdue, finance.currency)}
                  </strong>
                </div>
              </div>
            </Card>
          ))}
          {summary.isLoading && [0, 1].map((item) => <Card key={item}>Loading finance…</Card>)}
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.6fr]">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#071a31]">Six-month collections</h2>
              <p className="mt-1 text-sm text-slate-500">Monthly payment movement by currency</p>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <BarChart3 size={19} />
            </span>
          </div>
          <div className="mt-5 space-y-6">
            {data?.collectionTrend.map((series) => {
              const maximum = Math.max(...series.points.map((point) => Number(point.amount)), 1);
              return (
                <div key={series.currency}>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <strong className="text-[#102641]">{series.currency}</strong>
                    <span className="text-slate-500">Monthly collections</span>
                  </div>
                  <div
                    aria-label={`${series.currency} collection trend`}
                    className="flex h-28 items-end gap-2"
                  >
                    {series.points.map((point) => (
                      <div
                        className="flex min-w-0 flex-1 flex-col items-center gap-1"
                        key={point.month}
                      >
                        <span className="text-[10px] font-semibold text-slate-500">
                          {Number(point.amount) ? Number(point.amount).toLocaleString() : '0'}
                        </span>
                        <span
                          className="w-full rounded-t-md bg-blue-500"
                          style={{
                            height: `${Math.max(4, (Number(point.amount) / maximum) * 72)}px`,
                          }}
                          title={formatMoney(point.amount, series.currency)}
                        />
                        <span className="text-[10px] text-slate-500">
                          {new Date(`${point.month}-01T00:00:00Z`).toLocaleDateString('en-US', {
                            month: 'short',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="min-w-0 max-w-full overflow-hidden">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-semibold text-[#071a31]">School performance</h2>
              <p className="mt-1 text-sm text-slate-500">
                Compare adoption, enrollment, staffing, and collection health
              </p>
            </div>
            <Link className="text-sm font-semibold text-blue-700" href="/admin/schools">
              School controls
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[#dce7ed] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-3 pr-4 font-semibold">School</th>
                  <th className="px-3 py-3 font-semibold">Users</th>
                  <th className="px-3 py-3 font-semibold">Students</th>
                  <th className="px-3 py-3 font-semibold">Staff</th>
                  <th className="px-3 py-3 font-semibold">USD health</th>
                  <th className="py-3 pl-3 font-semibold">KHR health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8eff3]">
                {data?.schoolPerformance.map((school) => (
                  <tr key={school.id}>
                    <td className="py-3 pr-4">
                      <strong className="block text-[#102641]">{school.name}</strong>
                      <span className="text-xs text-slate-500">
                        {school.code} · {school.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-[#102641]">
                      {school._count.userSchools.toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      <strong className="block text-[#102641]">
                        {school._count.students.toLocaleString()}
                      </strong>
                      <span className="text-xs text-slate-500">
                        {school._count.enrollments.toLocaleString()} enrolled
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[#102641]">
                      {school._count.staff.toLocaleString()}
                    </td>
                    {school.finance.map((finance) => (
                      <td className="px-3 py-3" key={finance.currency}>
                        <strong
                          className={
                            Number(finance.overdue) > 0 ? 'text-red-700' : 'text-emerald-700'
                          }
                        >
                          {finance.collectionRate}%
                        </strong>
                        <span className="block text-xs text-slate-500">
                          {formatMoney(finance.outstanding, finance.currency)} due
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!summary.isLoading && !data?.schoolPerformance.length && (
              <p className="py-6 text-center text-sm text-slate-500">No schools to compare yet.</p>
            )}
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#071a31]">Recently added schools</h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest schools registered on the platform
              </p>
            </div>
            <Link className="text-sm font-semibold text-blue-700" href="/admin/schools">
              Manage schools
            </Link>
          </div>
          <div className="mt-4 divide-y divide-[#e8eff3]">
            {data?.recentSchools.map((item) => (
              <div className="flex justify-between gap-3 py-3 text-sm" key={item.id}>
                <span>
                  <strong className="block text-[#102641]">{item.name}</strong>
                  <small className="text-slate-500">
                    {item.code} · {item._count.students} students · {item._count.staff} staff
                  </small>
                  <small className="mt-0.5 block text-slate-500">
                    Admin: {item.administrator?.email ?? 'Not assigned'}
                  </small>
                </span>
                <span
                  className={`h-fit rounded-full px-2 py-1 text-xs font-bold ${item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                >
                  {item.status}
                </span>
              </div>
            ))}
            {!summary.isLoading && !data?.recentSchools.length && (
              <p className="py-4 text-sm text-slate-500">No schools yet.</p>
            )}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-[#071a31]">Recent changes</h2>
          <p className="mt-1 text-sm text-slate-500">School and role changes across the platform</p>
          <div className="mt-4 divide-y divide-[#e8eff3]">
            {data?.recentActivity.map((item) => (
              <div className="py-3 text-sm" key={item.id}>
                <strong className="text-[#102641]">
                  {item.action.replaceAll('_', ' ').toLowerCase()}
                </strong>
                <p className="mt-1 text-xs text-slate-500">
                  {item.school.code} · {item.entityType.toLowerCase()} ·{' '}
                  {item.user ? `${item.user.firstName} ${item.user.lastName}` : 'System'} ·{' '}
                  {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
            {!summary.isLoading && !data?.recentActivity.length && (
              <p className="py-4 text-sm text-slate-500">No recorded changes yet.</p>
            )}
          </div>
        </Card>
      </section>
      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <TaskLink
          href="/admin/schools"
          title="Schools & administrators"
          detail="Add a school, assign its first admin, or suspend access"
          icon={School}
        />
        <TaskLink
          href="/admin/access"
          title="Role permissions"
          detail="Govern what each platform role can access"
          icon={ShieldCheck}
        />
      </section>
    </>
  );
}

export function PrincipalDashboard() {
  const summary = useQuery({
    queryKey: ['dashboard', 'principal'],
    queryFn: () => apiFetch<PrincipalSummary>('/dashboard/principal'),
  });
  const data = summary.data;
  return (
    <>
      <PageHeader
        title="Principal dashboard"
        description="Review academic progress, attendance, exams, and report cards."
      />
      {summary.isError && <QueryError message="Could not load academic oversight data." />}
      <section className="mb-6 flex flex-col gap-5 rounded-[24px] bg-[#173b66] p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-blue-200">
            Academic oversight
          </p>
          <h2 className="mt-2 text-2xl font-bold">
            {data?.stats.pendingApprovals ?? (summary.isLoading ? '—' : 0)} report cards awaiting
            approval
          </h2>
          <p className="mt-2 text-sm text-blue-100">
            {data?.school.activeAcademicYear?.name ?? 'Current academic year'} · Review published
            results before they are approved.
          </p>
        </div>
        <Link
          className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#173b66]"
          href="/admin/report-cards"
        >
          Review report cards <ArrowRight size={16} />
        </Link>
      </section>
      <section aria-label="Academic health" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Attendance, last 7 days"
          value={data?.stats.attendanceRate == null ? '—' : `${data.stats.attendanceRate}%`}
          detail={
            data ? `${data.stats.attendanceRecords} attendance records` : 'Waiting for records'
          }
          icon={ClipboardCheck}
          tone="bg-emerald-50 text-emerald-700"
        />
        <Metric
          label="Students"
          value={data?.school.stats.students ?? (summary.isLoading ? '—' : 0)}
          detail="Active student profiles"
          icon={GraduationCap}
        />
        <Metric
          label="Scheduled exams"
          value={data?.stats.scheduledExams ?? (summary.isLoading ? '—' : 0)}
          detail="Exams awaiting completion"
          icon={CalendarCheck2}
          tone="bg-amber-50 text-amber-700"
        />
        <Metric
          label="Approved cards"
          value={data?.stats.approvedCards ?? (summary.isLoading ? '—' : 0)}
          detail="Report cards already approved"
          icon={FileCheck2}
          tone="bg-violet-50 text-violet-700"
        />
      </section>
      <section className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-[#071a31]">Awaiting your approval</h2>
            <Link className="text-sm font-semibold text-blue-700" href="/admin/report-cards">
              Open report cards
            </Link>
          </div>
          <div className="mt-4 divide-y divide-[#e8eff3]">
            {data?.reportCards.map((card) => (
              <div className="flex justify-between gap-3 py-3 text-sm" key={card.id}>
                <div>
                  <strong className="text-[#102641]">
                    {card.student.firstName} {card.student.lastName}
                  </strong>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {card.student.studentCode} · {card.semester.name}
                  </p>
                </div>
                <span className="text-xs font-semibold text-blue-700">
                  GPA {card.gpa.toFixed(2)}
                </span>
              </div>
            ))}
            {!summary.isLoading && !data?.reportCards.length && (
              <p className="py-4 text-sm text-slate-500">No report cards need approval.</p>
            )}
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-[#071a31]">Next examinations</h2>
          <div className="mt-4 divide-y divide-[#e8eff3]">
            {data?.upcomingExams.map((exam) => (
              <Link
                className="flex justify-between gap-3 py-3 text-sm"
                href="/admin/exams"
                key={exam.id}
              >
                <strong>{exam.name}</strong>
                <span className="text-slate-500">
                  {new Date(exam.startsOn).toLocaleDateString()}
                </span>
              </Link>
            ))}
            {!summary.isLoading && !data?.upcomingExams.length && (
              <p className="py-4 text-sm text-slate-500">No upcoming scheduled exams.</p>
            )}
          </div>
        </Card>
      </section>
      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <TaskLink
          href="/admin/attendance"
          title="Review attendance"
          detail="See class attendance registers"
          icon={ClipboardCheck}
        />
        <TaskLink
          href="/admin/exams"
          title="Review exams"
          detail="Check marks and publication status"
          icon={CalendarCheck2}
        />
        <TaskLink
          href="/admin/announcements"
          title="School announcements"
          detail="Read school updates"
          icon={Bell}
        />
      </section>
    </>
  );
}

function DirectorySearch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        size={17}
      />
      <input
        className="h-11 w-full rounded-xl border border-[#dce7ed] bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        type="search"
        value={value}
      />
    </label>
  );
}

export function AccountantDashboard() {
  const [studentSearch, setStudentSearch] = useState('');
  const [parentSearch, setParentSearch] = useState('');
  const students = useQuery({
    queryKey: ['accountant-students', studentSearch],
    queryFn: () =>
      apiFetch<Page<Student>>(`/students?pageSize=5&search=${encodeURIComponent(studentSearch)}`),
  });
  const parents = useQuery({
    queryKey: ['accountant-parents', parentSearch],
    queryFn: () =>
      apiFetch<Page<Parent>>(`/parents?pageSize=5&search=${encodeURIComponent(parentSearch)}`),
  });
  const finance = useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => apiFetch<FinanceSummary>('/finance/summary'),
  });
  return (
    <>
      <PageHeader
        title="Accountant dashboard"
        description="Track student fees, record payments received, and follow outstanding balances."
      />
      {(students.isError || parents.isError || finance.isError) && (
        <QueryError message="Some finance or directory records could not be loaded. Try refreshing this page." />
      )}
      {!!finance.data?.totals.length && (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {finance.data?.totals.map((row) => (
            <div className="contents" key={row.currency}>
              <Metric
                label={`${row.currency} billed`}
                value={formatMoney(row.billed, row.currency)}
                detail={`${row.chargeCount} active fees`}
                icon={CreditCard}
              />
              <Metric
                label={`${row.currency} collected`}
                value={formatMoney(row.collected, row.currency)}
                detail="Recorded received payments"
                icon={CreditCard}
                tone="bg-emerald-50 text-emerald-700"
              />
              <Metric
                label={`${row.currency} outstanding`}
                value={formatMoney(row.outstanding, row.currency)}
                detail="Remaining student balances"
                icon={CreditCard}
                tone="bg-amber-50 text-amber-700"
              />
              <Metric
                label={`${row.currency} overdue`}
                value={formatMoney(row.overdue, row.currency)}
                detail="Past due balances"
                icon={CreditCard}
                tone="bg-red-50 text-red-700"
              />
            </div>
          ))}
        </section>
      )}
      {finance.isSuccess && !finance.data.totals.length && (
        <section className="mb-6 rounded-[22px] border border-blue-200 bg-blue-50 p-5 text-sm text-[#173b66]">
          <strong className="block">Ready to start billing</strong>
          <p className="mt-1">
            Choose a student below and add their first fee. Payments can be recorded against that
            fee.
          </p>
          <Link className="mt-3 inline-flex font-semibold text-blue-700" href="/admin/finance">
            Open fees & payments →
          </Link>
        </section>
      )}
      <section className="grid gap-4 sm:grid-cols-2">
        <Metric
          label="Students"
          value={students.data?.meta.total ?? (students.isLoading ? '—' : 0)}
          detail="Matching student records"
          icon={GraduationCap}
        />
        <Metric
          label="Guardian contacts"
          value={parents.data?.meta.total ?? (parents.isLoading ? '—' : 0)}
          detail="Matching parent and guardian records"
          icon={Users}
          tone="bg-emerald-50 text-emerald-700"
        />
      </section>
      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Student lookup</h2>
            <Link className="text-sm font-semibold text-blue-700" href="/admin/students">
              Full directory
            </Link>
          </div>
          <div className="mt-4">
            <DirectorySearch
              label="Search students by name or code"
              value={studentSearch}
              onChange={setStudentSearch}
            />
          </div>
          <div className="mt-3 divide-y divide-[#e8eff3]">
            {students.data?.items.map((student) => (
              <Link
                className="flex justify-between gap-3 py-3 text-sm hover:text-blue-700"
                href={`/admin/finance/students/${student.id}`}
                key={student.id}
              >
                <strong>
                  {student.firstName} {student.lastName}
                </strong>
                <span className="text-slate-500">{student.studentCode}</span>
              </Link>
            ))}
            {!students.isLoading && !students.data?.items.length && (
              <p className="py-4 text-sm text-slate-500">No matching students.</p>
            )}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Guardian lookup</h2>
            <Link className="text-sm font-semibold text-blue-700" href="/admin/parents">
              Full directory
            </Link>
          </div>
          <div className="mt-4">
            <DirectorySearch
              label="Search guardians by name or contact"
              value={parentSearch}
              onChange={setParentSearch}
            />
          </div>
          <div className="mt-3 divide-y divide-[#e8eff3]">
            {parents.data?.items.map((parent) => (
              <div className="py-3 text-sm" key={parent.id}>
                <strong>
                  {parent.firstName} {parent.lastName}
                </strong>
                <p className="mt-1 text-xs text-slate-500">
                  {parent.email ?? parent.phone ?? 'No contact on file'} · {parent.students.length}{' '}
                  linked student{parent.students.length === 1 ? '' : 's'}
                </p>
              </div>
            ))}
            {!parents.isLoading && !parents.data?.items.length && (
              <p className="py-4 text-sm text-slate-500">No matching guardians.</p>
            )}
          </div>
        </Card>
      </section>
      <section className="mt-6">
        <div className="grid gap-3 md:grid-cols-2">
          <TaskLink
            href="/admin/finance"
            title="Fees & payments"
            detail="Manage student charges and received payments"
            icon={CreditCard}
          />
          <TaskLink
            href="/notifications"
            title="Notifications"
            detail="Read school updates and account notices"
            icon={Bell}
          />
        </div>
      </section>
    </>
  );
}

export function LibrarianDashboard() {
  const [search, setSearch] = useState('');
  const students = useQuery({
    queryKey: ['librarian-students', search],
    queryFn: () =>
      apiFetch<Page<Student>>(`/students?pageSize=8&search=${encodeURIComponent(search)}`),
  });
  const { user } = useAuth();
  return (
    <>
      <PageHeader
        title="Librarian dashboard"
        description="Find students and keep track of school notices from your workspace."
      />
      <section className="mb-6 rounded-[22px] border border-blue-200 bg-blue-50 p-5 text-sm text-[#173b66]">
        <strong className="block">Library tools are being prepared</strong>
        <p className="mt-1">
          The catalog, book copies, and borrowing records are not yet stored in this version.
          Student lookup and notifications are available now.
        </p>
      </section>
      {students.isError && (
        <QueryError message="Student records could not be loaded. Try refreshing this page." />
      )}
      <section className="grid gap-4 sm:grid-cols-2">
        <Metric
          label="Student records"
          value={students.data?.meta.total ?? (students.isLoading ? '—' : 0)}
          detail="Students matching your search"
          icon={GraduationCap}
        />
        <Metric
          label="Your role"
          value="Librarian"
          detail={user?.email ?? 'School staff'}
          icon={BookOpen}
          tone="bg-emerald-50 text-emerald-700"
        />
      </section>
      <section className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Student lookup</h2>
              <p className="mt-1 text-sm text-slate-500">Search by name or student code</p>
            </div>
            <Link className="text-sm font-semibold text-blue-700" href="/admin/students">
              Full directory
            </Link>
          </div>
          <div className="mt-4">
            <DirectorySearch
              label="Search students by name or code"
              value={search}
              onChange={setSearch}
            />
          </div>
          <div className="mt-3 divide-y divide-[#e8eff3]">
            {students.data?.items.map((student) => (
              <div className="flex justify-between gap-3 py-3 text-sm" key={student.id}>
                <strong>
                  {student.firstName} {student.lastName}
                </strong>
                <span className="text-slate-500">{student.studentCode}</span>
              </div>
            ))}
            {!students.isLoading && !students.data?.items.length && (
              <p className="py-4 text-sm text-slate-500">No matching students.</p>
            )}
          </div>
        </Card>
        <div className="grid content-start gap-3">
          <TaskLink
            href="/admin/students"
            title="Student directory"
            detail="Open full student records"
            icon={Users}
          />
          <TaskLink
            href="/notifications"
            title="Notifications"
            detail="Read your school notices"
            icon={Bell}
          />
        </div>
      </section>
    </>
  );
}
