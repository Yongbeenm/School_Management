'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LogOut,
  UsersRound,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Card } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { apiFetch, apiJson } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { workspaceRoute } from '@/lib/workspace-route';

type Subject = { name: string };
type ClassSection = { name: string; grade: { name: string } };
type TeachingAssignment = { id: string; subject: Subject; classSection: ClassSection };
type Timetable = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: { name: string } | null;
  teachingAssignment: { subject: Subject };
};
type Assignment = {
  id: string;
  title: string;
  dueAt: string;
  teachingAssignment: { subject: Subject };
  submissions?: { status: string }[];
};
type Mark = {
  id: string;
  score: number;
  examSubject: {
    maximumScore: number;
    exam: { name: string };
    teachingAssignment: { subject: Subject };
  };
};
type ReportCard = { id: string; gpa: number; average: number; semester: { name: string } };
type Profile = {
  id: string;
  name: string;
  studentCode?: string;
  employeeCode?: string;
  className?: string | null;
};
type BaseData = { profile: Profile };
type TeacherData = BaseData & {
  assignments: TeachingAssignment[];
  timetable: Timetable[];
  upcomingAssignments: Assignment[];
  stats: Record<string, number>;
};
type StudentData = BaseData & {
  timetable: Timetable[];
  assignments: Assignment[];
  marks: Mark[];
  reportCards: ReportCard[];
  attendance: { total: number; percentage: number };
};
type Child = {
  id: string;
  name: string;
  studentCode: string;
  relationship: string;
  className?: string | null;
  attendance: { total: number; percentage: number };
  upcoming: Assignment[];
  reportCards: ReportCard[];
  timetable: Timetable[];
  marks: Mark[];
};
type ParentData = BaseData & { children: Child[] };
type PortalData = TeacherData | StudentData | ParentData;

const labels = {
  teacher: 'Teacher dashboard',
  student: 'Student dashboard',
  parent: 'Parent dashboard',
} as const;
const sectionTitles = {
  teacher: 'My teaching day',
  student: 'My learning',
  parent: "My children's progress",
} as const;
const heroEyebrows = {
  teacher: 'Teaching workspace',
  student: 'Learning workspace',
  parent: 'Family workspace',
} as const;
const expectedRole = { teacher: 'TEACHER', student: 'STUDENT', parent: 'PARENT' } as const;
const workspaceLinks = {
  teacher: [
    ['My timetable', '/admin/timetable'],
    ['My class subjects', '/admin/teaching-assignments'],
    ['Attendance', '/admin/attendance'],
    ['Assignments & grading', '/admin/assignments'],
    ['Exams & marks', '/admin/exams'],
    ['My students', '/admin/students'],
  ],
  student: [
    ['My timetable', '/admin/timetable'],
    ['My attendance', '/admin/attendance'],
    ['Assignments', '/admin/assignments'],
    ['Published results', '/admin/exams'],
    ['Report cards', '/admin/report-cards'],
  ],
  parent: [
    ['My children', '/admin/students'],
    ['Child timetable', '/admin/timetable'],
    ['Child attendance', '/admin/attendance'],
    ['Assignments', '/admin/assignments'],
    ['Published results', '/admin/exams'],
    ['Report cards', '/admin/report-cards'],
  ],
} as const;
const toolIcons: Record<string, typeof BookOpen> = {
  '/admin/timetable': CalendarDays,
  '/admin/teaching-assignments': BookOpen,
  '/admin/attendance': ClipboardCheck,
  '/admin/assignments': BookOpen,
  '/admin/exams': Award,
  '/admin/students': UsersRound,
  '/admin/report-cards': FileText,
};
const portalIntro = {
  teacher: 'Your classes, attendance, assignments, and marks are ready to manage.',
  student: 'Stay on top of your timetable, schoolwork, and results.',
  parent: 'Follow your children’s school day and see their progress in one place.',
};
const portalColor = {
  teacher: 'bg-[#0b2b50]',
  student: 'bg-[#164b89]',
  parent: 'bg-[#5b466d]',
};
const primaryTask = {
  teacher: { label: 'Take attendance', href: '/admin/attendance' },
  student: { label: 'See assignments', href: '/admin/assignments' },
  parent: { label: 'View children', href: '#children' },
};

function Schedule({ items }: { items: Timetable[] }) {
  return (
    <div className="mt-3 divide-y">
      {items.length ? (
        items.slice(0, 10).map((item) => (
          <div className="flex justify-between gap-3 py-2 text-sm" key={item.id}>
            <span>
              <strong>{item.teachingAssignment.subject.name}</strong>
              <small className="ml-2 text-slate-500">{item.room?.name ?? 'Room TBA'}</small>
            </span>
            <span className="text-slate-600">
              {item.dayOfWeek.slice(0, 3)} · {new Date(item.startTime).toISOString().slice(11, 16)}
            </span>
          </div>
        ))
      ) : (
        <p className="py-2 text-sm text-slate-500">No timetable entries yet.</p>
      )}
    </div>
  );
}

function DueAssignments({ items }: { items: Assignment[] }) {
  return (
    <div className="mt-3 divide-y">
      {items.length ? (
        items.map((item) => (
          <div className="py-2 text-sm" key={item.id}>
            <strong>{item.title}</strong>
            <p className="text-slate-600">
              {item.teachingAssignment.subject.name} · due {new Date(item.dueAt).toLocaleString()}
            </p>
            {item.submissions?.[0] && (
              <small className="text-teal-700">{item.submissions[0].status}</small>
            )}
          </div>
        ))
      ) : (
        <p className="py-2 text-sm text-slate-500">No upcoming assignments.</p>
      )}
    </div>
  );
}

function TeacherContent({ data }: { data: TeacherData }) {
  return (
    <>
      <Card>
        <span className="grid size-11 place-items-center rounded-xl bg-sky-50 text-sky-700">
          <UserRound size={21} />
        </span>
        <p className="mt-4 text-3xl font-bold">{data.stats.assignedClasses ?? 0}</p>
        <p className="mt-1 text-sm text-slate-600">Assigned classes</p>
      </Card>
      <Card>
        <span className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-700">
          <ClipboardCheck size={21} />
        </span>
        <p className="mt-4 text-3xl font-bold">{data.stats.pendingSubmissions ?? 0}</p>
        <p className="mt-1 text-sm text-slate-600">Submissions awaiting grade</p>
      </Card>
      <Card>
        <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <CalendarDays size={21} />
        </span>
        <p className="mt-4 text-3xl font-bold">{data.stats.attendanceSessions ?? 0}</p>
        <p className="mt-1 text-sm text-slate-600">Attendance registers</p>
      </Card>
      <section className="lg:col-span-2">
        <Card>
          <h2 className="font-semibold">My class subjects</h2>
          <div className="mt-3 divide-y">
            {data.assignments.map((item) => (
              <p className="py-2 text-sm" key={item.id}>
                <strong>{item.subject.name}</strong>
                <span className="ml-2 text-slate-600">
                  {item.classSection.grade.name} {item.classSection.name}
                </span>
              </p>
            ))}
            {!data.assignments.length && (
              <p className="py-2 text-sm text-slate-500">No class subjects assigned yet.</p>
            )}
          </div>
        </Card>
      </section>
      <Card>
        <h2 className="font-semibold">Upcoming work</h2>
        <DueAssignments items={data.upcomingAssignments} />
      </Card>
      <section className="lg:col-span-3">
        <Card>
          <h2 className="font-semibold">My timetable</h2>
          <Schedule items={data.timetable} />
        </Card>
      </section>
    </>
  );
}

function StudentContent({
  data,
  submit,
  pending,
}: {
  data: StudentData;
  submit: (assignmentId: string, content: string) => void;
  pending: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const openAssignments = data.assignments.filter(
    (assignment) => !assignment.submissions?.some((submission) => submission.status === 'GRADED'),
  );
  const submitForm = (event: FormEvent<HTMLFormElement>, assignmentId: string) => {
    event.preventDefault();
    submit(assignmentId, drafts[assignmentId] ?? '');
  };
  return (
    <>
      <Card>
        <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <ClipboardCheck size={21} />
        </span>
        <p className="mt-4 text-3xl font-bold">{data.attendance.percentage}%</p>
        <p className="mt-1 text-sm text-slate-600">Attendance ({data.attendance.total} classes)</p>
      </Card>
      <Card>
        <span className="grid size-11 place-items-center rounded-xl bg-sky-50 text-sky-700">
          <BookOpen size={21} />
        </span>
        <p className="mt-4 text-3xl font-bold">{data.assignments.length}</p>
        <p className="mt-1 text-sm text-slate-600">Upcoming classwork</p>
      </Card>
      <Card>
        <span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-700">
          <FileText size={21} />
        </span>
        <p className="mt-4 text-3xl font-bold">{data.reportCards[0]?.gpa ?? '—'}</p>
        <p className="mt-1 text-sm text-slate-600">Latest GPA</p>
      </Card>
      <section className="lg:col-span-2">
        <Card>
          <h2 className="font-semibold">Weekly timetable</h2>
          <Schedule items={data.timetable} />
        </Card>
      </section>
      <Card>
        <h2 className="font-semibold">Assignments</h2>
        <DueAssignments items={data.assignments} />
      </Card>
      <section className="order-first lg:col-span-3">
        <Card>
          <h2 className="font-semibold">Submit assignment</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {openAssignments.map((assignment) => (
              <form
                className="rounded-lg border border-slate-200 p-4"
                key={assignment.id}
                onSubmit={(event) => submitForm(event, assignment.id)}
              >
                <strong className="text-sm">{assignment.title}</strong>
                <p className="mt-1 text-xs text-slate-500">
                  {assignment.teachingAssignment.subject.name} · due{' '}
                  {new Date(assignment.dueAt).toLocaleString()}
                </p>
                <textarea
                  className="mt-3 min-h-20 w-full rounded border border-slate-300 p-2 text-sm"
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [assignment.id]: event.target.value }))
                  }
                  placeholder="Write your answer or submission note"
                  value={drafts[assignment.id] ?? ''}
                />
                <Button className="mt-2" disabled={pending || !drafts[assignment.id]?.trim()}>
                  {pending ? 'Submitting…' : assignment.submissions?.length ? 'Update submission' : 'Submit work'}
                </Button>
              </form>
            ))}
            {!openAssignments.length && (
              <p className="text-sm text-slate-500">No assignments need a submission right now.</p>
            )}
          </div>
        </Card>
      </section>
      <section className="lg:col-span-3">
        <Card>
          <h2 className="font-semibold">Recent marks</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.marks.map((mark) => (
              <p className="rounded bg-slate-50 p-3 text-sm" key={mark.id}>
                <strong>{mark.examSubject.teachingAssignment.subject.name}</strong>
                <br />
                {mark.examSubject.exam.name}: {mark.score}/{mark.examSubject.maximumScore}
              </p>
            ))}
          </div>
        </Card>
      </section>
    </>
  );
}

function ParentContent({ data }: { data: ParentData }) {
  const [childId, setChildId] = useState(data.children[0]?.id ?? '');
  const child = data.children.find((item) => item.id === childId) ?? data.children[0];
  if (!child)
    return (
      <section className="lg:col-span-3">
        <Card>
          <p className="text-sm text-slate-500">No children are linked to this parent account.</p>
        </Card>
      </section>
    );
  return (
    <section className="lg:col-span-3 grid gap-5" id="children">
      <Card>
        <label className="grid max-w-md gap-1 text-sm font-medium text-slate-700">
          Select child
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            onChange={(event) => setChildId(event.target.value)}
            value={child.id}
          >
            {data.children.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.studentCode}
              </option>
            ))}
          </select>
        </label>
      </Card>
      <Card>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h2 className="font-semibold">{child.name}</h2>
            <p className="text-sm text-slate-600">
              {child.studentCode} · {child.relationship} · {child.className ?? 'Class not assigned'}
            </p>
          </div>
          <p className="text-sm">
            <strong>{child.attendance.percentage}%</strong> attendance from {child.attendance.total}{' '}
            classes
          </p>
        </div>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">Weekly timetable</h3>
            <Schedule items={child.timetable} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Upcoming assignments</h3>
            <DueAssignments items={child.upcoming} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Published results</h3>
            {child.marks.length ? (
              child.marks.map((mark) => (
                <p className="mt-2 text-sm" key={mark.id}>
                  <strong>{mark.examSubject.teachingAssignment.subject.name}</strong> · {mark.score}
                  /{mark.examSubject.maximumScore}
                </p>
              ))
            ) : (
              <p className="mt-2 text-sm text-slate-500">No published results yet.</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold">Report cards</h3>
            {child.reportCards.length ? (
              child.reportCards.map((card) => (
                <p className="mt-2 text-sm" key={card.id}>
                  {card.semester.name}: GPA <strong>{card.gpa}</strong>, average {card.average}%
                </p>
              ))
            ) : (
              <p className="mt-2 text-sm text-slate-500">No published report card yet.</p>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}

export function RolePortal({ role }: { role: keyof typeof labels }) {
  const router = useRouter();
  const client = useQueryClient();
  const { user, isLoading, logout } = useAuth();
  const portal = useQuery({
    queryKey: ['portal', role],
    queryFn: () => apiFetch<PortalData>(`/dashboard/${role}`),
    enabled: Boolean(user?.roles.includes(expectedRole[role])),
  });
  const submission = useMutation({
    mutationFn: ({
      assignmentId,
      studentId,
      content,
    }: {
      assignmentId: string;
      studentId: string;
      content: string;
    }) => apiJson(`/assignments/${assignmentId}/submissions`, 'POST', { studentId, content }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['portal', 'student'] });
    },
  });
  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
    else if (!isLoading && user && !user.roles.includes(expectedRole[role]))
      router.replace(workspaceRoute(user));
  }, [isLoading, role, router, user]);
  if (isLoading || !user || !user.roles.includes(expectedRole[role]))
    return <main className="p-8 text-slate-600">Loading your workspace…</main>;
  const data = portal.data;
  return (
    <main className="min-h-screen bg-[#f5fafb] px-4 pb-10 pt-4 text-slate-900 md:px-8 md:pt-6">
      <div className="mx-auto flex max-w-6xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce7ed] bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-teal-700 text-white">
              <GraduationCap size={22} />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-950">School Management</p>
              <p className="text-xs text-slate-500">Your school, made simpler</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              onClick={() => router.push('/notifications')}
            >
              <Bell size={16} className="mr-2" />
              Notifications
            </Button>
            <Button
              className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              onClick={() => void logout().then(() => router.replace('/auth/login'))}
            >
              <LogOut size={16} className="mr-2" />
              Sign out
            </Button>
          </div>
        </header>
        <section
          className={`relative mt-6 overflow-hidden rounded-[24px] p-6 text-white md:p-9 ${portalColor[role]}`}
        >
          <div className="pointer-events-none absolute -right-14 -top-24 size-72 rounded-full border-[46px] border-white/5" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.19em] text-white/75">
                {heroEyebrows[role]}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{labels[role]}</h1>
              <p className="mt-3 text-sm leading-6 text-white/85 md:text-base">
                {portalIntro[role]}
              </p>
              <p className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                {data?.profile.name ?? user.email}
                {data?.profile.className ? ` · ${data.profile.className}` : ''}
              </p>
              {data && (
                <p className="mt-2 text-xs font-medium text-white/80">
                  {role === 'teacher' &&
                    `${(data as TeacherData).stats.pendingSubmissions ?? 0} submissions to grade`}
                    {role === 'student' &&
                      `${(data as StudentData).assignments.filter((assignment) => !assignment.submissions?.some((submission) => submission.status === 'GRADED')).length} assignments to submit`}
                  {role === 'parent' && `${(data as ParentData).children.length} linked children`}
                </p>
              )}
            </div>
            <Link
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
              href={primaryTask[role].href}
            >
              {primaryTask[role].label}
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <nav
          aria-label="Portal workspace"
          className={`${role === 'teacher' ? 'order-1' : 'order-2'} mt-8`}
        >
          <div>
            <h2 className="text-lg font-bold text-slate-950">Your tools</h2>
            <p className="mt-1 text-sm text-slate-600">Choose the information you need today.</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workspaceLinks[role].map(([label, href]) => {
              const Icon = toolIcons[href] ?? BookOpen;
              return (
                <Link
                  className="group flex items-center gap-3 rounded-2xl border border-[#dce7ed] bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  href={href}
                  key={href}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-teal-700">
                    <Icon size={19} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                    {label}
                  </span>
                  <ArrowRight
                    className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-teal-700"
                    size={16}
                  />
                </Link>
              );
            })}
          </div>
        </nav>
        <section className={role === 'teacher' ? 'order-2' : 'order-1'}>
          <h2 className="mt-8 text-lg font-bold text-slate-950">{sectionTitles[role]}</h2>
          {portal.isError && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {portal.error.message}
            </p>
          )}
          {submission.isError && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              We could not submit your work: {submission.error.message}
            </p>
          )}
          {submission.isSuccess && (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-teal-800">
              Your work was submitted successfully.
            </p>
          )}
          {portal.isLoading ? (
            <p className="py-8 text-slate-600">Loading portal data…</p>
          ) : (
            data && (
              <div className="mt-4 grid gap-5 lg:grid-cols-3">
                {role === 'teacher' && <TeacherContent data={data as TeacherData} />}{' '}
                {role === 'student' && (
                  <StudentContent
                    data={data as StudentData}
                    pending={submission.isPending}
                    submit={(assignmentId, content) =>
                      submission.mutate({
                        assignmentId,
                        studentId: (data as StudentData).profile.id,
                        content,
                      })
                    }
                  />
                )}{' '}
                {role === 'parent' && <ParentContent data={data as ParentData} />}
              </div>
            )
          )}
        </section>
      </div>
    </main>
  );
}
