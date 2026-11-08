'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Card, PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { apiFetch, apiJson } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

interface Semester {
  id: string;
  name: string;
  academicYear: { name: string };
}
interface TA {
  id: string;
  classSection: { id: string; name: string; grade: { name: string } };
  subject: { name: string };
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
interface ExamSubject {
  id: string;
  maximumScore: number;
  weight: number;
  scheduledAt: string;
  teachingAssignment: TA;
  marks: { id: string; student: Student; score: number }[];
}
interface Exam {
  id: string;
  name: string;
  type: string;
  startsOn: string;
  status: string;
  semester: Pick<Semester, 'id' | 'name'>;
  subjects: ExamSubject[];
}
interface Scale {
  id: string;
  letter: string;
  minimum: number;
  maximum: number;
  gradePoint: number;
}
const field =
  'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-teal-600';

export default function ExamsPage() {
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [examId, setExamId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [scores, setScores] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'marks' | 'setup'>('overview');
  const { hasPermission } = useAuth();
  const exams = useQuery({ queryKey: ['exams'], queryFn: () => apiFetch<Exam[]>('/exams') });
  const semesters = useQuery({
    queryKey: ['semesters'],
    queryFn: () => apiFetch<Semester[]>('/semesters'),
    enabled: hasPermission('exam.create'),
  });
  const teachingAssignments = useQuery({
    queryKey: ['teaching-assignments'],
    queryFn: () => apiFetch<TA[]>('/teaching-assignments'),
    enabled: hasPermission('exam.update'),
  });
  const scales = useQuery({
    queryKey: ['grading-scales'],
    queryFn: () => apiFetch<Scale[]>('/grading-scales'),
    enabled: hasPermission('grading_scale.read'),
  });
  const selected = useMemo(
    () =>
      exams.data
        ?.flatMap((exam) => exam.subjects.map((subject) => ({ exam, subject })))
        .find((item) => item.subject.id === subjectId),
    [exams.data, subjectId],
  );
  const roster = useQuery({
    queryKey: ['exam-roster', selected?.subject.teachingAssignment.classSection.id],
    queryFn: () =>
      apiFetch<Page<Enrollment>>(
        `/classes/${selected!.subject.teachingAssignment.classSection.id}/students?pageSize=200`,
      ),
    enabled: Boolean(selected) && activeTab === 'marks' && hasPermission('mark.create'),
  });
  useEffect(() => {
    if (selected && roster.data)
      setScores(
        Object.fromEntries(
          roster.data.items.map(({ student }) => [
            student.id,
            String(
              selected.subject.marks.find((mark) => mark.student.id === student.id)?.score ?? '',
            ),
          ]),
        ),
      );
  }, [roster.data, selected]);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['exams'] });
    void client.invalidateQueries({ queryKey: ['grading-scales'] });
  };
  const post = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) => apiJson(path, 'POST', body),
    onSuccess: () => {
      refresh();
      setError(null);
    },
    onError: (reason: Error) => setError(reason.message),
  });
  const patch = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) => apiJson(path, 'PATCH', body),
    onSuccess: () => {
      refresh();
      setError(null);
    },
    onError: (reason: Error) => setError(reason.message),
  });
  const submit =
    (path: string, map: (data: FormData) => unknown) => (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      post.mutate({ path, body: map(new FormData(form)) }, { onSuccess: () => form.reset() });
    };
  const canEnterMarks = hasPermission('mark.create');
  const canSetUpExams =
    hasPermission('exam.create') ||
    hasPermission('exam.update') ||
    hasPermission('grading_scale.manage');
  const marksLocked = selected?.exam.status === 'PUBLISHED' && !hasPermission('mark.override');
  return (
    <>
      <PageHeader
        title="Exams, marks & GPA"
        description="Schedule examinations, enter class marks, and maintain the GPA scale according to your role."
      />
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div aria-label="Exam sections" className="mb-6 flex flex-wrap gap-2" role="tablist">
        {(
          [
            ['overview', 'Exams & results'],
            ...(canEnterMarks ? ([['marks', 'Enter marks']] as const) : []),
            ...(canSetUpExams ? ([['setup', 'Exam setup']] as const) : []),
          ] as const
        ).map(([id, label]) => (
          <button
            aria-controls="exam-content"
            aria-selected={activeTab === id}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeTab === id ? 'bg-teal-800 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-teal-50'}`}
            key={id}
            onClick={() => setActiveTab(id)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div id="exam-content" role="tabpanel">
        <div className="grid gap-6 xl:grid-cols-2">
          {activeTab === 'setup' && hasPermission('exam.create') && (
            <Card>
              <h2 className="font-semibold">Create exam</h2>
              <form
                className="mt-4 grid gap-3"
                onSubmit={submit('/exams', (data) => ({
                  semesterId: data.get('semesterId'),
                  name: data.get('name'),
                  type: data.get('type'),
                  startsOn: data.get('startsOn'),
                }))}
              >
                <select className={field} name="semesterId" required defaultValue="">
                  <option value="" disabled>
                    Semester
                  </option>
                  {semesters.data?.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.academicYear.name} · {semester.name}
                    </option>
                  ))}
                </select>
                <input className={field} name="name" placeholder="Midterm Examination" required />
                <select className={field} name="type">
                  <option>QUIZ</option>
                  <option>MIDTERM</option>
                  <option>FINAL</option>
                  <option>PRACTICAL</option>
                  <option>OTHER</option>
                </select>
                <input className={field} name="startsOn" type="date" required />
                <Button disabled={post.isPending}>Create draft exam</Button>
              </form>
            </Card>
          )}
          {activeTab === 'setup' && hasPermission('grading_scale.read') && (
            <Card>
              <h2 className="font-semibold">Grading scale</h2>
              {hasPermission('grading_scale.manage') && (
                <form
                  className="mt-4 grid grid-cols-2 gap-3"
                  onSubmit={submit('/grading-scales', (data) => ({
                    letter: data.get('letter'),
                    minimum: Number(data.get('minimum')),
                    maximum: Number(data.get('maximum')),
                    gradePoint: Number(data.get('gradePoint')),
                  }))}
                >
                  <input className={field} name="letter" placeholder="A" required />
                  <input
                    className={field}
                    name="gradePoint"
                    placeholder="GPA"
                    type="number"
                    step="0.01"
                    required
                  />
                  <input
                    className={field}
                    name="minimum"
                    placeholder="Minimum %"
                    type="number"
                    required
                  />
                  <input
                    className={field}
                    name="maximum"
                    placeholder="Maximum %"
                    type="number"
                    required
                  />
                  <Button className="col-span-2" disabled={post.isPending}>
                    Save scale
                  </Button>
                </form>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {scales.data?.map((scale) => (
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs" key={scale.id}>
                    {scale.letter}: {scale.minimum}–{scale.maximum}% · {scale.gradePoint}
                  </span>
                )) ?? (
                  <p className="text-sm text-slate-500">
                    Your role cannot view grading-scale administration.
                  </p>
                )}
              </div>
            </Card>
          )}
          {activeTab === 'setup' && hasPermission('exam.update') && (
            <Card>
              <h2 className="font-semibold">Add scheduled subject</h2>
              <form
                className="mt-4 grid gap-3"
                onSubmit={submit(`/exams/${examId}/subjects`, (data) => ({
                  teachingAssignmentId: data.get('teachingAssignmentId'),
                  maximumScore: Number(data.get('maximumScore')),
                  weight: Number(data.get('weight')),
                  scheduledAt: new Date(String(data.get('scheduledAt'))).toISOString(),
                }))}
              >
                <select
                  className={field}
                  value={examId}
                  onChange={(event) => setExamId(event.target.value)}
                  required
                >
                  <option value="">Choose exam</option>
                  {exams.data?.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name}
                    </option>
                  ))}
                </select>
                <select className={field} name="teachingAssignmentId" required defaultValue="">
                  <option value="" disabled>
                    Class subject
                  </option>
                  {teachingAssignments.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.classSection.grade.name} {item.classSection.name} · {item.subject.name}
                    </option>
                  ))}
                </select>
                <input className={field} name="scheduledAt" type="datetime-local" required />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={field}
                    name="maximumScore"
                    placeholder="Maximum score"
                    type="number"
                    required
                  />
                  <input
                    className={field}
                    name="weight"
                    placeholder="Weight"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue="1"
                    required
                  />
                </div>
                <Button disabled={!examId || post.isPending}>Add subject</Button>
              </form>
            </Card>
          )}
          {activeTab === 'overview' && (
            <Card>
              <h2 className="font-semibold">Examination lifecycle</h2>
              <div className="mt-3 divide-y">
                {exams.data?.map((exam) => (
                  <div className="py-3 text-sm" key={exam.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        <strong>{exam.name}</strong>
                        <small className="ml-2 text-slate-500">
                          {exam.semester.name} · {exam.type} ·{' '}
                          {new Date(exam.startsOn).toLocaleDateString()}
                        </small>
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                        {exam.status === 'PUBLISHED'
                          ? 'Results published'
                          : exam.status.toLowerCase()}
                      </span>
                    </div>
                    {hasPermission('exam.update') && exam.status === 'DRAFT' && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                          onClick={() =>
                            patch.mutate({
                              path: `/exams/${exam.id}/status`,
                              body: { status: 'SCHEDULED' },
                            })
                          }
                          type="button"
                        >
                          Schedule
                        </button>
                      </div>
                    )}
                    {hasPermission('exam.update') && exam.status === 'SCHEDULED' && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                          onClick={() =>
                            patch.mutate({
                              path: `/exams/${exam.id}/status`,
                              body: { status: 'COMPLETED' },
                            })
                          }
                          type="button"
                        >
                          Mark complete
                        </button>
                      </div>
                    )}
                    {hasPermission('exam.update') && exam.status === 'COMPLETED' && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          className="rounded border border-teal-700 px-2 py-1 text-xs text-teal-700"
                          onClick={() =>
                            patch.mutate({
                              path: `/exams/${exam.id}/status`,
                              body: { status: 'PUBLISHED' },
                            })
                          }
                          type="button"
                        >
                          Publish results
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {exams.data?.length === 0 && (
                  <p className="py-4 text-sm text-slate-500">No exams yet.</p>
                )}
              </div>
            </Card>
          )}
        </div>
        {(activeTab === 'overview' || activeTab === 'marks') && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
            <Card>
              <h2 className="font-semibold">Exam subjects and marks</h2>
              <div className="mt-4 divide-y">
                {exams.data?.flatMap((exam) =>
                  exam.subjects.map((subject) => (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                      key={subject.id}
                    >
                      <span>
                        <strong>
                          {exam.name} · {subject.teachingAssignment.subject.name}
                        </strong>
                        <small className="ml-2 text-slate-500">
                          {subject.teachingAssignment.classSection.grade.name}{' '}
                          {subject.teachingAssignment.classSection.name} · {subject.marks.length}{' '}
                          marks · weight {subject.weight}
                        </small>
                      </span>
                      {activeTab === 'overview' && subject.marks.length > 0 && !canEnterMarks && (
                        <span className="text-sm font-medium text-teal-800">
                          {subject.marks
                            .map(
                              (mark) =>
                                `${mark.student.firstName}: ${mark.score}/${subject.maximumScore}`,
                            )
                            .join(' · ')}
                        </span>
                      )}
                      {activeTab === 'marks' && canEnterMarks && (
                        <button
                          className="rounded border border-teal-700 px-2 py-1 text-xs font-medium text-teal-700"
                          onClick={() => setSubjectId(subject.id)}
                          type="button"
                        >
                          Enter marks
                        </button>
                      )}
                    </div>
                  )),
                )}
                {exams.data?.every((exam) => exam.subjects.length === 0) && (
                  <p className="py-4 text-sm text-slate-500">
                    No exam subjects yet. Add one from Exam setup to see it here.
                  </p>
                )}
              </div>
            </Card>
            {activeTab === 'marks' && selected && canEnterMarks && (
              <Card>
                <h2 className="font-semibold">
                  Mark entry: {selected.subject.teachingAssignment.subject.name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {selected.subject.teachingAssignment.classSection.grade.name}{' '}
                  {selected.subject.teachingAssignment.classSection.name} · maximum{' '}
                  {selected.subject.maximumScore}
                </p>
                {marksLocked && (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    This exam is published. Mark changes require override permission.
                  </p>
                )}
                <div className="mt-4 max-h-[560px] divide-y overflow-y-auto">
                  {roster.data?.items.map(({ student }) => (
                    <div className="flex items-center gap-2 py-2" key={student.id}>
                      <label className="min-w-0 flex-1 text-sm">
                        <strong>
                          {student.firstName} {student.lastName}
                        </strong>
                        <small className="ml-2 text-slate-500">{student.studentCode}</small>
                      </label>
                      <input
                        className="h-9 w-20 rounded border border-slate-300 px-2 text-sm"
                        min="0"
                        max={selected.subject.maximumScore}
                        step="0.01"
                        value={scores[student.id] ?? ''}
                        disabled={marksLocked}
                        onChange={(event) =>
                          setScores((current) => ({ ...current, [student.id]: event.target.value }))
                        }
                        type="number"
                      />
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        disabled={
                          marksLocked ||
                          !scores[student.id] ||
                          post.isPending ||
                          (Boolean(
                            selected.subject.marks.find((mark) => mark.student.id === student.id),
                          ) &&
                            !hasPermission('mark.update'))
                        }
                        onClick={() =>
                          post.mutate({
                            path: `/exam-subjects/${selected.subject.id}/marks`,
                            body: { studentId: student.id, score: Number(scores[student.id]) },
                          })
                        }
                        type="button"
                      >
                        Save
                      </button>
                    </div>
                  ))}
                  {roster.isError && (
                    <p className="py-4 text-sm text-red-700">Could not load this class roster.</p>
                  )}
                  {roster.isLoading && (
                    <p className="py-4 text-sm text-slate-500">Loading class roster…</p>
                  )}
                  {roster.data?.items.length === 0 && (
                    <p className="py-4 text-sm text-slate-500">
                      No students are enrolled in this class.
                    </p>
                  )}
                </div>
              </Card>
            )}
          </section>
        )}
      </div>
    </>
  );
}
