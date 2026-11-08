'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Card, PageHeader } from '@/components/admin/page-header';
import { EditRecordDialog } from '@/components/admin/record-actions';
import { Button } from '@/components/ui/button';
import { apiFetch, apiJson } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

interface TeachingAssignment {
  id: string;
  classSection: { name: string; grade: { name: string } };
  subject: { name: string };
  teacher: { staff: { firstName: string; lastName: string } };
}
interface Submission {
  id: string;
  status: string;
  score?: number | null;
  feedback?: string | null;
  submittedAt: string;
  student: { studentCode: string; firstName: string; lastName: string };
}
interface Assignment {
  id: string;
  title: string;
  description?: string | null;
  dueAt: string;
  maxScore: number;
  status: string;
  teachingAssignment: TeachingAssignment;
  submissions: Submission[];
}
const field =
  'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-teal-600';
const statusClass = (status: string) =>
  status === 'PUBLISHED'
    ? 'bg-teal-100 text-teal-800'
    : status === 'CLOSED'
      ? 'bg-slate-200 text-slate-700'
      : 'bg-amber-100 text-amber-800';

export default function AssignmentsPage() {
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [grading, setGrading] = useState<{ submission: Submission; assignment: Assignment } | null>(
    null,
  );
  const { hasPermission } = useAuth();
  const teachingAssignments = useQuery({
    queryKey: ['teaching-assignments'],
    queryFn: () => apiFetch<TeachingAssignment[]>('/teaching-assignments'),
  });
  const assignments = useQuery({
    queryKey: ['assignments'],
    queryFn: () => apiFetch<Assignment[]>('/assignments'),
  });
  const refresh = () => void client.invalidateQueries({ queryKey: ['assignments'] });
  const create = useMutation({
    mutationFn: (body: unknown) => apiJson('/assignments', 'POST', body),
    onSuccess: () => {
      refresh();
      setError(null);
    },
    onError: (reason: Error) => setError(reason.message),
  });
  const grade = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      apiJson(`/assignments/submissions/${id}/grade`, 'POST', body),
    onSuccess: () => {
      refresh();
      setGrading(null);
      setError(null);
    },
    onError: (reason: Error) => setError(reason.message),
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      apiJson(`/assignments/${id}/status`, 'PATCH', { status: value }),
    onSuccess: () => {
      refresh();
      setError(null);
    },
    onError: (reason: Error) => setError(reason.message),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    create.mutate(
      {
        teachingAssignmentId: data.get('teachingAssignmentId'),
        title: data.get('title'),
        description: data.get('description') || undefined,
        dueAt: new Date(String(data.get('dueAt'))).toISOString(),
        maxScore: Number(data.get('maxScore')),
      },
      { onSuccess: () => form.reset() },
    );
  };
  return (
    <>
      <PageHeader
        title="Assignments"
        description="Create a draft, publish it to students, then review and grade the work they submit."
      />
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        {hasPermission('assignment.create') && (
          <Card>
            <h2 className="font-semibold">Create an assignment</h2>
            <p className="mt-1 text-sm text-slate-600">
              It starts as a draft. Publish it only when the instructions and deadline are ready.
            </p>
            <form className="mt-4 grid gap-3" onSubmit={submit}>
              <select className={field} defaultValue="" name="teachingAssignmentId" required>
                <option disabled value="">
                  Class, subject, teacher
                </option>
                {teachingAssignments.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.classSection.grade.name} {item.classSection.name} · {item.subject.name} ·{' '}
                    {item.teacher.staff.firstName} {item.teacher.staff.lastName}
                  </option>
                ))}
              </select>
              <input className={field} name="title" placeholder="Assignment title" required />
              <textarea
                className="min-h-24 rounded-md border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-teal-600"
                name="description"
                placeholder="Instructions for students (optional)"
              />
              <label className="grid gap-1 text-sm text-slate-600">
                Deadline
                <input className={field} name="dueAt" required type="datetime-local" />
              </label>
              <input
                className={field}
                min="0"
                name="maxScore"
                placeholder="Maximum score"
                required
                type="number"
              />
              <Button disabled={create.isPending}>
                {create.isPending ? 'Saving…' : 'Save as draft'}
              </Button>
            </form>
          </Card>
        )}
        <div className="grid gap-5">
          {assignments.data?.length ? (
            assignments.data.map((assignment) => (
              <Card key={assignment.id}>
                <div className="flex justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">{assignment.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {assignment.teachingAssignment.classSection.grade.name}{' '}
                      {assignment.teachingAssignment.classSection.name} ·{' '}
                      {assignment.teachingAssignment.subject.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Due {new Date(assignment.dueAt).toLocaleString()} · Maximum score:{' '}
                      {assignment.maxScore}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(assignment.status)}`}
                    >
                      {assignment.status}
                    </span>
                    <p className="mt-2 text-sm text-slate-500">
                      {assignment.submissions.length} submissions
                    </p>
                  </div>
                </div>
                {assignment.description && (
                  <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    {assignment.description}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {hasPermission('assignment.publish') && assignment.status !== 'PUBLISHED' && (
                    <button
                      className="rounded-lg border border-teal-700 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                      disabled={status.isPending}
                      onClick={() => status.mutate({ id: assignment.id, value: 'PUBLISHED' })}
                      type="button"
                    >
                      Publish for students
                    </button>
                  )}
                  {hasPermission('assignment.close') && assignment.status !== 'CLOSED' && (
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      disabled={status.isPending}
                      onClick={() => status.mutate({ id: assignment.id, value: 'CLOSED' })}
                      type="button"
                    >
                      Close submissions
                    </button>
                  )}
                </div>
                <div className="mt-5 border-t border-slate-100 pt-2">
                  <h3 className="pt-2 text-sm font-semibold text-slate-800">Student submissions</h3>
                  <div className="mt-1 divide-y">
                    {assignment.submissions.length ? (
                      assignment.submissions.map((submission) => (
                        <div
                          className="flex items-center justify-between gap-3 py-3 text-sm"
                          key={submission.id}
                        >
                          <span>
                            <strong>
                              {submission.student.firstName} {submission.student.lastName}
                            </strong>
                            <small className="ml-2 text-slate-500">
                              {submission.student.studentCode} · {submission.status}
                            </small>
                          </span>
                          {hasPermission('assignment.grade') && (
                            <button
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              onClick={() => setGrading({ submission, assignment })}
                              type="button"
                            >
                              {submission.score === null || submission.score === undefined
                                ? 'Grade work'
                                : `${submission.score}/${assignment.maxScore}`}
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="py-3 text-sm text-slate-500">No submissions yet.</p>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm text-slate-500">
                No assignments yet. Create a draft to get started.
              </p>
            </Card>
          )}
        </div>
      </div>
      <EditRecordDialog
        fields={
          grading
            ? [
                {
                  name: 'score',
                  label: `Score (maximum ${grading.assignment.maxScore})`,
                  value: grading.submission.score,
                  type: 'number',
                  required: true,
                },
                {
                  name: 'feedback',
                  label: 'Feedback for the student',
                  value: grading.submission.feedback,
                  type: 'textarea',
                },
              ]
            : []
        }
        isOpen={Boolean(grading)}
        onClose={() => setGrading(null)}
        onSubmit={(values) =>
          grade.mutate({
            id: grading!.submission.id,
            body: { score: Number(values.score), feedback: values.feedback || undefined },
          })
        }
        pending={grade.isPending}
        title="Grade submission"
      />
    </>
  );
}
