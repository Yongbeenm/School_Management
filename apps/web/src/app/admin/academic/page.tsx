'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Card, PageHeader } from '@/components/admin/page-header';
import { EditField, EditRecordDialog, RecordActions } from '@/components/admin/record-actions';
import { Button } from '@/components/ui/button';
import { apiFetch, apiJson } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

interface Year {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
}
interface Semester {
  id: string;
  academicYearId: string;
  name: string;
  sequence: number;
  startsOn: string;
  endsOn: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  academicYear: { name: string };
}
interface Grade {
  id: string;
  code: string;
  name: string;
  sequence: number;
}
interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}
interface ClassSection {
  id: string;
  name: string;
  capacity?: number | null;
  grade: Grade;
  academicYear: Year;
  _count: { enrollments: number };
}
type EditTarget =
  | { kind: 'year'; record: Year }
  | { kind: 'semester'; record: Semester }
  | { kind: 'grade'; record: Grade }
  | { kind: 'subject'; record: Subject }
  | { kind: 'class'; record: ClassSection };
const field =
  'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-teal-600';
const keys = [['academic-years'], ['semesters'], ['grades'], ['subjects'], ['classes']];
const dateValue = (date: string) => date.slice(0, 10);

function CreateForm({
  title,
  children,
  onSubmit,
  pending,
  permission,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  permission: string;
}) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return null;
  return (
    <Card>
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">Fill in the details, then save the new record.</p>
      <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
        {children}
        <Button disabled={pending}>
          {pending ? 'Saving…' : `Add ${title.replace('New ', '')}`}
        </Button>
      </form>
    </Card>
  );
}

export default function AcademicSetupPage() {
  const client = useQueryClient();
  const { hasPermission } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [activeTab, setActiveTab] = useState<'year' | 'semester' | 'grade' | 'subject' | 'class'>(
    'year',
  );
  const years = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => apiFetch<Year[]>('/academic-years'),
  });
  const semesters = useQuery({
    queryKey: ['semesters'],
    queryFn: () => apiFetch<Semester[]>('/semesters'),
  });
  const grades = useQuery({ queryKey: ['grades'], queryFn: () => apiFetch<Grade[]>('/grades') });
  const subjects = useQuery({
    queryKey: ['subjects'],
    queryFn: () => apiFetch<Subject[]>('/subjects'),
  });
  const classes = useQuery({
    queryKey: ['classes'],
    queryFn: () => apiFetch<ClassSection[]>('/classes'),
  });
  const refresh = () => keys.forEach((queryKey) => void client.invalidateQueries({ queryKey }));
  const create = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) => apiJson(path, 'POST', body),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (reason: Error) => setError(reason.message),
  });
  const mutate = useMutation({
    mutationFn: ({
      path,
      method = 'PATCH',
      body,
    }: {
      path: string;
      method?: 'DELETE' | 'PATCH';
      body?: unknown;
    }) => (method === 'DELETE' ? apiFetch(path, { method }) : apiJson(path, method, body)),
    onSuccess: () => {
      setError(null);
      setEditing(null);
      refresh();
    },
    onError: (reason: Error) => setError(reason.message),
  });
  const submit =
    (path: string, mapper: (form: FormData) => unknown) => (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      create.mutate({ path, body: mapper(new FormData(form)) }, { onSuccess: () => form.reset() });
    };
  const fields = (): EditField[] => {
    if (!editing) return [];
    if (editing.kind === 'year')
      return [
        { name: 'name', label: 'Name', value: editing.record.name, required: true },
        {
          name: 'startsOn',
          label: 'Starts on',
          value: dateValue(editing.record.startsOn),
          type: 'date',
          required: true,
        },
        {
          name: 'endsOn',
          label: 'Ends on',
          value: dateValue(editing.record.endsOn),
          type: 'date',
          required: true,
        },
        {
          name: 'status',
          label: 'Status',
          value: editing.record.status,
          type: 'select',
          options: ['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'],
        },
      ];
    if (editing.kind === 'semester')
      return [
        { name: 'name', label: 'Name', value: editing.record.name, required: true },
        {
          name: 'sequence',
          label: 'Sequence',
          value: editing.record.sequence,
          type: 'number',
          required: true,
        },
        {
          name: 'startsOn',
          label: 'Starts on',
          value: dateValue(editing.record.startsOn),
          type: 'date',
          required: true,
        },
        {
          name: 'endsOn',
          label: 'Ends on',
          value: dateValue(editing.record.endsOn),
          type: 'date',
          required: true,
        },
        {
          name: 'status',
          label: 'Status',
          value: editing.record.status,
          type: 'select',
          options: ['DRAFT', 'ACTIVE', 'CLOSED'],
        },
      ];
    if (editing.kind === 'grade')
      return [
        { name: 'code', label: 'Code', value: editing.record.code, required: true },
        { name: 'name', label: 'Name', value: editing.record.name, required: true },
        {
          name: 'sequence',
          label: 'Sequence',
          value: editing.record.sequence,
          type: 'number',
          required: true,
        },
      ];
    if (editing.kind === 'subject')
      return [
        { name: 'code', label: 'Code', value: editing.record.code, required: true },
        { name: 'name', label: 'Name', value: editing.record.name, required: true },
        {
          name: 'description',
          label: 'Description',
          value: editing.record.description,
          type: 'textarea',
        },
      ];
    return [
      { name: 'name', label: 'Class name', value: editing.record.name, required: true },
      {
        name: 'capacity',
        label: 'Capacity (empty means no limit)',
        value: editing.record.capacity,
        type: 'number',
      },
    ];
  };
  const save = (values: Record<string, string>) => {
    if (!editing) return;
    const path =
      editing.kind === 'year'
        ? `/academic-years/${editing.record.id}`
        : editing.kind === 'semester'
          ? `/semesters/${editing.record.id}`
          : editing.kind === 'grade'
            ? `/grades/${editing.record.id}`
            : editing.kind === 'subject'
              ? `/subjects/${editing.record.id}`
              : `/classes/${editing.record.id}`;
    mutate.mutate({
      path,
      body: {
        ...values,
        ...(editing.kind === 'semester' || editing.kind === 'grade'
          ? { sequence: Number(values.sequence) }
          : {}),
        ...(editing.kind === 'class'
          ? { capacity: values.capacity ? Number(values.capacity) : null }
          : {}),
      },
    });
  };
  const list = <T extends { id: string }>(
    items: T[] | undefined,
    render: (item: T) => React.ReactNode,
    empty: string,
  ) => (items?.length ? items.map(render) : <p className="py-4 text-sm text-slate-500">{empty}</p>);
  const tabs = [
    {
      id: 'year',
      label: 'Academic years',
      count: years.data?.length ?? 0,
      hint: 'Set the dates for a school year.',
    },
    {
      id: 'semester',
      label: 'Semesters',
      count: semesters.data?.length ?? 0,
      hint: 'Divide the year into teaching terms.',
    },
    {
      id: 'grade',
      label: 'Grades',
      count: grades.data?.length ?? 0,
      hint: 'Define the grade levels taught.',
    },
    {
      id: 'subject',
      label: 'Subjects',
      count: subjects.data?.length ?? 0,
      hint: 'List the subjects your school offers.',
    },
    {
      id: 'class',
      label: 'Classes',
      count: classes.data?.length ?? 0,
      hint: 'Create class groups for enrolment.',
    },
  ] as const;
  const currentTab = tabs.find((tab) => tab.id === activeTab)!;
  return (
    <>
      <PageHeader
        title="Academic setup"
        description="Set up the school year in order: year, semester, grades, subjects, then classes."
      />
      {error && <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <nav
        aria-label="Academic setup steps"
        className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"
        role="tablist"
      >
        {tabs.map((tab, index) => (
          <button
            aria-controls="academic-content"
            aria-selected={activeTab === tab.id}
            className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-teal-600 ${activeTab === tab.id ? 'border-teal-600 bg-emerald-50 text-teal-950 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'}`}
            id={`tab-${tab.id}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            <span className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide">
              <span>Step {index + 1}</span>
              <span className="rounded-full bg-white/80 px-2 py-0.5">{tab.count}</span>
            </span>
            <span className="mt-2 block font-semibold">{tab.label}</span>
          </button>
        ))}
      </nav>
      <p className="mb-5 text-sm text-slate-600">{currentTab.hint}</p>
      <div
        aria-labelledby={`tab-${activeTab}`}
        className="academic-detail grid gap-6 xl:grid-cols-2"
        id="academic-content"
        role="tabpanel"
      >
        {activeTab === 'year' && (
          <>
            <CreateForm
              title="New academic year"
              permission="academic_year.create"
              pending={create.isPending}
              onSubmit={submit('/academic-years', (d) => ({
                name: d.get('name'),
                startsOn: d.get('startsOn'),
                endsOn: d.get('endsOn'),
                status: d.get('status'),
              }))}
            >
              <input className={field} name="name" placeholder="2026–2027" required />
              <div className="grid grid-cols-2 gap-3">
                <input className={field} name="startsOn" type="date" required />
                <input className={field} name="endsOn" type="date" required />
              </div>
              <select className={field} defaultValue="DRAFT" name="status">
                <option>DRAFT</option>
                <option>ACTIVE</option>
                <option>CLOSED</option>
              </select>
            </CreateForm>
            <Card>
              <h2 className="font-semibold">Academic years</h2>
              <div className="mt-4 divide-y">
                {list(
                  years.data,
                  (year) => (
                    <div
                      className="flex items-center justify-between gap-3 py-3 text-sm"
                      key={year.id}
                    >
                      <span>
                        <strong>{year.name}</strong>
                        <small className="ml-2 text-slate-500">
                          {dateValue(year.startsOn)} – {dateValue(year.endsOn)}
                        </small>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                          {year.status}
                        </span>
                        {hasPermission('academic_year.update') && (
                          <RecordActions
                            disabled={mutate.isPending}
                            onEdit={
                              hasPermission('academic_year.update')
                                ? () => setEditing({ kind: 'year', record: year })
                                : undefined
                            }
                            onArchive={
                              hasPermission('academic_year.update')
                                ? () =>
                                    mutate.mutate({
                                      path: `/academic-years/${year.id}`,
                                      body: { status: 'ARCHIVED' },
                                    })
                                : undefined
                            }
                          />
                        )}
                      </div>
                    </div>
                  ),
                  'No academic years yet.',
                )}
              </div>
            </Card>
          </>
        )}
        {activeTab === 'semester' && (
          <>
            <CreateForm
              title="New semester"
              permission="semester.create"
              pending={create.isPending}
              onSubmit={submit('/semesters', (d) => ({
                academicYearId: d.get('academicYearId'),
                name: d.get('name'),
                sequence: Number(d.get('sequence')),
                startsOn: d.get('startsOn'),
                endsOn: d.get('endsOn'),
                status: d.get('status'),
              }))}
            >
              <select className={field} name="academicYearId" required defaultValue="">
                <option disabled value="">
                  Choose academic year
                </option>
                {years.data
                  ?.filter((year) => year.status !== 'ARCHIVED')
                  .map((year) => (
                    <option value={year.id} key={year.id}>
                      {year.name}
                    </option>
                  ))}
              </select>
              <input className={field} name="name" placeholder="Semester 1" required />
              <div className="grid grid-cols-3 gap-3">
                <input
                  className={field}
                  min="1"
                  name="sequence"
                  placeholder="Sequence"
                  type="number"
                  required
                />
                <input className={field} name="startsOn" type="date" required />
                <input className={field} name="endsOn" type="date" required />
              </div>
              <select className={field} defaultValue="DRAFT" name="status">
                <option>DRAFT</option>
                <option>ACTIVE</option>
                <option>CLOSED</option>
              </select>
            </CreateForm>
            <Card>
              <h2 className="font-semibold">Semesters</h2>
              <div className="mt-4 divide-y">
                {list(
                  semesters.data,
                  (semester) => (
                    <div
                      className="flex items-center justify-between gap-3 py-3 text-sm"
                      key={semester.id}
                    >
                      <span>
                        <strong>{semester.name}</strong>
                        <small className="ml-2 text-slate-500">
                          {semester.academicYear.name} · #{semester.sequence} · {semester.status}
                        </small>
                      </span>
                      {hasPermission('semester.update') && (
                        <RecordActions
                          archiveLabel="Close"
                          disabled={mutate.isPending}
                          onEdit={() => setEditing({ kind: 'semester', record: semester })}
                          onArchive={() =>
                            mutate.mutate({
                              path: `/semesters/${semester.id}`,
                              body: { status: 'CLOSED' },
                            })
                          }
                        />
                      )}
                    </div>
                  ),
                  'No semesters yet.',
                )}
              </div>
            </Card>
          </>
        )}
        {activeTab === 'grade' && (
          <>
            <CreateForm
              title="New grade"
              permission="grade.create"
              pending={create.isPending}
              onSubmit={submit('/grades', (d) => ({
                code: d.get('code'),
                name: d.get('name'),
                sequence: Number(d.get('sequence')),
              }))}
            >
              <div className="grid grid-cols-3 gap-3">
                <input className={field} name="code" placeholder="G10" required />
                <input className={field} name="name" placeholder="Grade 10" required />
                <input
                  className={field}
                  min="1"
                  name="sequence"
                  placeholder="#"
                  type="number"
                  required
                />
              </div>
            </CreateForm>
            <Card>
              <h2 className="font-semibold">Grades</h2>
              <div className="mt-4 divide-y">
                {list(
                  grades.data,
                  (grade) => (
                    <div className="flex justify-between gap-3 py-2 text-sm" key={grade.id}>
                      <span>
                        {grade.sequence}. <strong>{grade.name}</strong>{' '}
                        <small className="text-slate-500">{grade.code}</small>
                      </span>
                      {(hasPermission('grade.update') || hasPermission('grade.delete')) && (
                        <RecordActions
                          disabled={mutate.isPending}
                          onEdit={
                            hasPermission('grade.update')
                              ? () => setEditing({ kind: 'grade', record: grade })
                              : undefined
                          }
                          onArchive={
                            hasPermission('grade.delete')
                              ? () =>
                                  mutate.mutate({ path: `/grades/${grade.id}`, method: 'DELETE' })
                              : undefined
                          }
                        />
                      )}
                    </div>
                  ),
                  'No grades yet.',
                )}
              </div>
            </Card>
          </>
        )}
        {activeTab === 'subject' && (
          <>
            <CreateForm
              title="New subject"
              permission="subject.create"
              pending={create.isPending}
              onSubmit={submit('/subjects', (d) => ({
                code: d.get('code'),
                name: d.get('name'),
                description: d.get('description') || undefined,
              }))}
            >
              <div className="grid grid-cols-3 gap-3">
                <input className={field} name="code" placeholder="MATH" required />
                <input
                  className={field + ' col-span-2'}
                  name="name"
                  placeholder="Mathematics"
                  required
                />
              </div>
              <input className={field} name="description" placeholder="Optional description" />
            </CreateForm>
            <Card>
              <h2 className="font-semibold">Subjects</h2>
              <div className="mt-4 divide-y">
                {list(
                  subjects.data,
                  (subject) => (
                    <div className="flex justify-between py-3 text-sm" key={subject.id}>
                      <span>
                        <strong>{subject.name}</strong>
                        <small className="ml-2 text-slate-500">{subject.code}</small>
                      </span>
                      {(hasPermission('subject.update') || hasPermission('subject.delete')) && (
                        <RecordActions
                          disabled={mutate.isPending}
                          onEdit={
                            hasPermission('subject.update')
                              ? () => setEditing({ kind: 'subject', record: subject })
                              : undefined
                          }
                          onArchive={
                            hasPermission('subject.delete')
                              ? () =>
                                  mutate.mutate({
                                    path: `/subjects/${subject.id}`,
                                    method: 'DELETE',
                                  })
                              : undefined
                          }
                        />
                      )}
                    </div>
                  ),
                  'No subjects yet.',
                )}
              </div>
            </Card>
          </>
        )}
        {activeTab === 'class' && (
          <>
            <CreateForm
              title="New class"
              permission="class.create"
              pending={create.isPending}
              onSubmit={submit('/classes', (d) => ({
                academicYearId: d.get('academicYearId'),
                gradeId: d.get('gradeId'),
                name: d.get('name'),
                capacity: d.get('capacity') ? Number(d.get('capacity')) : undefined,
              }))}
            >
              <div className="grid grid-cols-2 gap-3">
                <select className={field} defaultValue="" name="academicYearId" required>
                  <option disabled value="">
                    Academic year
                  </option>
                  {years.data
                    ?.filter((year) => year.status !== 'ARCHIVED')
                    .map((year) => (
                      <option value={year.id} key={year.id}>
                        {year.name}
                      </option>
                    ))}
                </select>
                <select className={field} defaultValue="" name="gradeId" required>
                  <option disabled value="">
                    Grade
                  </option>
                  {grades.data?.map((grade) => (
                    <option value={grade.id} key={grade.id}>
                      {grade.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={field} name="name" placeholder="A" required />
                <input
                  className={field}
                  min="1"
                  name="capacity"
                  placeholder="Capacity"
                  type="number"
                />
              </div>
            </CreateForm>
            <Card>
              <h2 className="font-semibold">Classes</h2>
              <div className="mt-4 divide-y">
                {list(
                  classes.data,
                  (section) => (
                    <div className="flex justify-between gap-3 py-3 text-sm" key={section.id}>
                      <span>
                        <strong>
                          {section.grade.name} {section.name}
                        </strong>
                        <small className="ml-2 text-slate-500">
                          {section.academicYear.name} · {section._count.enrollments}
                          {section.capacity ? ` / ${section.capacity}` : ''}
                        </small>
                      </span>
                      {(hasPermission('class.update') || hasPermission('class.delete')) && (
                        <RecordActions
                          disabled={mutate.isPending}
                          onEdit={
                            hasPermission('class.update')
                              ? () => setEditing({ kind: 'class', record: section })
                              : undefined
                          }
                          onArchive={
                            hasPermission('class.delete')
                              ? () =>
                                  mutate.mutate({
                                    path: `/classes/${section.id}`,
                                    method: 'DELETE',
                                  })
                              : undefined
                          }
                        />
                      )}
                    </div>
                  ),
                  'No classes yet.',
                )}
              </div>
            </Card>
          </>
        )}
      </div>
      <EditRecordDialog
        fields={fields()}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSubmit={save}
        pending={mutate.isPending}
        title={
          editing ? `Edit ${editing.kind === 'class' ? 'class' : editing.kind}` : 'Edit record'
        }
      />
    </>
  );
}
