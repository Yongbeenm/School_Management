'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { Card, PageHeader } from '@/components/admin/page-header';
import { PermissionGate } from '@/components/auth/permission-gate';
import { Button } from '@/components/ui/button';
import { apiFetch, apiJson } from '@/lib/api';

interface TeachingAssignment {
  id: string;
  classSection: { id: string; name: string; grade: { name: string } };
  subject: { name: string };
  teacher: { staff: { firstName: string; lastName: string } };
  semester: { name: string };
}
interface Student {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
}
interface Enrollment {
  student: Student;
}
interface Page<T> {
  items: T[];
}
interface AttendanceSession {
  id: string;
  attendanceDate: string;
  teachingAssignment: TeachingAssignment;
  records: { status: string }[];
}
const field =
  'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-teal-600';
const today = new Date().toISOString().slice(0, 10);

export default function AttendancePage() {
  const client = useQueryClient();
  const [assignmentId, setAssignmentId] = useState('');
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const assignments = useQuery({
    queryKey: ['teaching-assignments'],
    queryFn: () => apiFetch<TeachingAssignment[]>('/teaching-assignments'),
  });
  const assignment = assignments.data?.find((item) => item.id === assignmentId);
  const roster = useQuery({
    queryKey: ['class-students', assignment?.classSection.id],
    queryFn: () =>
      apiFetch<Page<Enrollment>>(`/classes/${assignment!.classSection.id}/students?pageSize=200`),
    enabled: Boolean(assignment),
  });
  const sessions = useQuery({
    queryKey: ['attendance-sessions'],
    queryFn: () => apiFetch<AttendanceSession[]>('/attendance/sessions'),
  });
  useEffect(() => {
    if (roster.data)
      setStatuses(
        Object.fromEntries(roster.data.items.map((item) => [item.student.id, 'PRESENT'])),
      );
  }, [roster.data]);
  const take = useMutation({
    mutationFn: (body: unknown) => apiJson('/attendance/sessions', 'POST', body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['attendance-sessions'] });
      setError(null);
    },
    onError: (reason: Error) => setError(reason.message),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const date = String(new FormData(event.currentTarget).get('attendanceDate'));
    if (!assignment || !roster.data) return;
    take.mutate({
      teachingAssignmentId: assignment.id,
      attendanceDate: date,
      records: roster.data.items.map((item) => ({
        studentId: item.student.id,
        status: statuses[item.student.id] ?? 'PRESENT',
      })),
    });
  };
  return (
    <>
      <PageHeader
        title="Attendance"
        description="Take attendance in three steps: choose a class, check each student, then save the register."
      />
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <PermissionGate permission="attendance.create">
        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <strong className="text-teal-700">1. Choose a class</strong>
            <p className="mt-1 text-slate-600">Pick the class subject and date.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <strong className="text-teal-700">2. Check the roster</strong>
            <p className="mt-1 text-slate-600">
              Everyone starts as present; change only exceptions.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <strong className="text-teal-700">3. Save the register</strong>
            <p className="mt-1 text-slate-600">Saving again updates the same class and day.</p>
          </div>
        </section>
      </PermissionGate>
      <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
        <PermissionGate permission="attendance.create">
          <Card>
            <h2 className="font-semibold">1. Choose class and date</h2>
            <form className="mt-4 grid gap-4" onSubmit={submit}>
              <select
                className={field}
                value={assignmentId}
                onChange={(event) => setAssignmentId(event.target.value)}
                required
              >
                <option value="">Choose class and subject</option>
                {assignments.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.classSection.grade.name} {item.classSection.name} · {item.subject.name} ·{' '}
                    {item.teacher.staff.firstName} {item.teacher.staff.lastName}
                  </option>
                ))}
              </select>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Attendance date
                <input
                  className={field}
                  defaultValue={today}
                  name="attendanceDate"
                  required
                  type="date"
                />
              </label>
              {assignment && (
                <p className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
                  2. Check the roster: {roster.data?.items.length ?? 0} active students in{' '}
                  {assignment.classSection.grade.name} {assignment.classSection.name}.
                </p>
              )}
              <button
                className="justify-self-start text-sm font-semibold text-teal-700 hover:underline"
                onClick={() =>
                  roster.data &&
                  setStatuses(
                    Object.fromEntries(
                      roster.data.items.map((item) => [item.student.id, 'PRESENT']),
                    ),
                  )
                }
                type="button"
              >
                Mark every student present
              </button>
              <div className="max-h-[480px] overflow-y-auto rounded-xl border border-slate-200">
                {roster.data?.items.map((item) => (
                  <label
                    className="flex items-center justify-between gap-3 border-b border-slate-100 p-3 text-sm last:border-0"
                    key={item.student.id}
                  >
                    <span>
                      <strong>
                        {item.student.firstName} {item.student.lastName}
                      </strong>
                      <small className="ml-2 text-slate-500">{item.student.studentCode}</small>
                    </span>
                    <select
                      aria-label={`Attendance status for ${item.student.firstName} ${item.student.lastName}`}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      value={statuses[item.student.id] ?? 'PRESENT'}
                      onChange={(event) =>
                        setStatuses((current) => ({
                          ...current,
                          [item.student.id]: event.target.value,
                        }))
                      }
                    >
                      <option>PRESENT</option>
                      <option>ABSENT</option>
                      <option>LATE</option>
                      <option>EXCUSED</option>
                      <option>SICK</option>
                    </select>
                  </label>
                ))}
                {assignment && !roster.data?.items.length && (
                  <p className="p-4 text-sm text-slate-500">Loading roster…</p>
                )}
                {!assignment && (
                  <p className="p-4 text-sm text-slate-500">
                    Choose a class above to load its student roster.
                  </p>
                )}
              </div>
              <Button disabled={!assignment || !roster.data?.items.length || take.isPending}>
                {take.isPending ? 'Saving…' : '3. Save attendance'}
              </Button>
            </form>
          </Card>
        </PermissionGate>
        <Card>
          <div className="flex justify-between">
            <div>
              <h2 className="font-semibold">Previous registers</h2>
              <p className="mt-1 text-sm text-slate-600">
                Use this list to confirm what has already been recorded.
              </p>
            </div>
            <span className="text-sm text-slate-500">{sessions.data?.length ?? 0} registers</span>
          </div>
          <div className="mt-4 divide-y">
            {sessions.data?.length ? (
              sessions.data.map((session) => (
                <div className="py-3 text-sm" key={session.id}>
                  <strong>{new Date(session.attendanceDate).toLocaleDateString()}</strong>
                  <span className="ml-3">
                    {session.teachingAssignment.classSection.grade.name}{' '}
                    {session.teachingAssignment.classSection.name} ·{' '}
                    {session.teachingAssignment.subject.name}
                  </span>
                  <small className="ml-3 text-slate-500">
                    {session.records.length} student{session.records.length === 1 ? '' : 's'}
                  </small>
                </div>
              ))
            ) : (
              <p className="py-5 text-sm text-slate-500">No attendance has been taken yet.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
