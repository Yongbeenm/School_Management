'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Card, PageHeader } from '@/components/admin/page-header';
import { EditRecordDialog, RecordActions } from '@/components/admin/record-actions';
import { Button } from '@/components/ui/button';
import { apiFetch, apiJson } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

interface Parent {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}
interface Student {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  status?: string;
  guardians: { relationship: string; parent: Parent }[];
  enrollments: { classSection: { name: string; grade: { name: string } } }[];
}
interface Page<T> {
  items: T[];
  meta: { total: number };
}
const field =
  'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-teal-600';

export default function StudentsPage() {
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [search, setSearch] = useState('');
  const { hasPermission } = useAuth();
  const students = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Page<Student>>('/students?pageSize=100'),
  });
  const parents = useQuery({
    queryKey: ['parents'],
    queryFn: () => apiFetch<Page<Parent>>('/parents?pageSize=100'),
    enabled: hasPermission('student.update'),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['students'] });
    void client.invalidateQueries({ queryKey: ['parents'] });
  };
  const create = useMutation({
    mutationFn: (body: unknown) => apiJson<Student>('/students', 'POST', body),
    onSuccess: () => {
      refresh();
      setError(null);
    },
    onError: (reason: Error) => setError(reason.message),
  });
  const link = useMutation({
    mutationFn: ({ studentId, body }: { studentId: string; body: unknown }) =>
      apiJson(`/students/${studentId}/guardians`, 'POST', body),
    onSuccess: () => {
      refresh();
      setError(null);
    },
    onError: (reason: Error) => setError(reason.message),
  });
  const unlink = useMutation({
    mutationFn: ({ studentId, parentId }: { studentId: string; parentId: string }) =>
      apiFetch(`/students/${studentId}/guardians/${parentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      refresh();
      setError(null);
    },
    onError: (reason: Error) => setError(reason.message),
  });
  const change = useMutation({
    mutationFn: ({
      id,
      method,
      body,
    }: {
      id: string;
      method: 'DELETE' | 'PATCH';
      body?: unknown;
    }) =>
      method === 'DELETE'
        ? apiFetch(`/students/${id}`, { method })
        : apiJson(`/students/${id}`, method, body),
    onSuccess: () => {
      refresh();
      setError(null);
      setEditing(null);
    },
    onError: (reason: Error) => setError(reason.message),
  });
  const submitStudent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    create.mutate(
      {
        studentCode: data.get('studentCode'),
        firstName: data.get('firstName'),
        lastName: data.get('lastName'),
        dateOfBirth: data.get('dateOfBirth') || undefined,
        email: data.get('email') || undefined,
        phone: data.get('phone') || undefined,
        gender: data.get('gender') || undefined,
      },
      { onSuccess: () => form.reset() },
    );
  };
  const submitGuardian = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    link.mutate(
      {
        studentId: String(data.get('studentId')),
        body: {
          parentId: data.get('parentId'),
          relationship: data.get('relationship'),
          isPrimaryContact: data.get('isPrimaryContact') === 'on',
        },
      },
      { onSuccess: () => form.reset() },
    );
  };
  const save = (values: Record<string, string>) =>
    change.mutate({
      id: editing!.id,
      method: 'PATCH',
      body: {
        ...values,
        dateOfBirth: values.dateOfBirth || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
        gender: values.gender || undefined,
      },
    });
  const visibleStudents =
    students.data?.items.filter((student) =>
      `${student.studentCode} ${student.firstName} ${student.lastName} ${student.email ?? ''}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ) ?? [];
  return (
    <>
      <PageHeader
        title="Students"
        description="Find a student first, then update their profile, guardian contacts, or class placement."
      />
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="grid content-start gap-6">
          {hasPermission('student.create') && (
            <Card>
              <h2 className="font-semibold">Add a student</h2>
              <p className="mt-1 text-sm text-slate-600">
                Create the profile first. You can add guardians and enrol the student afterwards.
              </p>
              <form className="mt-4 grid gap-3" onSubmit={submitStudent}>
                <input className={field} name="studentCode" placeholder="Student code" required />
                <div className="grid grid-cols-2 gap-3">
                  <input className={field} name="firstName" placeholder="First name" required />
                  <input className={field} name="lastName" placeholder="Last name" required />
                </div>
                <input className={field} name="dateOfBirth" type="date" />
                <select className={field} defaultValue="" name="gender">
                  <option value="">Gender (optional)</option>
                  <option>FEMALE</option>
                  <option>MALE</option>
                  <option>OTHER</option>
                </select>
                <input className={field} name="email" placeholder="Email" type="email" />
                <input className={field} name="phone" placeholder="Phone" />
                <Button disabled={create.isPending}>
                  {create.isPending ? 'Saving…' : 'Save student profile'}
                </Button>
              </form>
            </Card>
          )}
          {hasPermission('student.update') && (
            <Card>
              <h2 className="font-semibold">Add a guardian</h2>
              <p className="mt-1 text-sm text-slate-600">
                Link an existing parent or guardian to a student profile.
              </p>
              <form className="mt-4 grid gap-3" onSubmit={submitGuardian}>
                <select className={field} defaultValue="" name="studentId" required>
                  <option disabled value="">
                    Select student
                  </option>
                  {students.data?.items.map((student) => (
                    <option value={student.id} key={student.id}>
                      {student.studentCode} — {student.firstName} {student.lastName}
                    </option>
                  ))}
                </select>
                <select className={field} defaultValue="" name="parentId" required>
                  <option disabled value="">
                    Select parent
                  </option>
                  {parents.data?.items.map((parent) => (
                    <option value={parent.id} key={parent.id}>
                      {parent.firstName} {parent.lastName}
                    </option>
                  ))}
                </select>
                <select className={field} defaultValue="GUARDIAN" name="relationship">
                  <option>FATHER</option>
                  <option>MOTHER</option>
                  <option>GUARDIAN</option>
                  <option>SIBLING</option>
                  <option>OTHER</option>
                </select>
                <label className="flex gap-2 text-sm text-slate-700">
                  <input name="isPrimaryContact" type="checkbox" /> Primary contact
                </label>
                <Button disabled={link.isPending}>
                  {link.isPending ? 'Linking…' : 'Link guardian'}
                </Button>
              </form>
            </Card>
          )}
        </div>
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-semibold">Student directory</h2>
              <p className="mt-1 text-sm text-slate-600">Search by student code, name, or email.</p>
            </div>
            <span className="text-sm text-slate-500">
              {search
                ? `${visibleStudents.length} of ${students.data?.meta.total ?? 0}`
                : `${students.data?.meta.total ?? 0}`}{' '}
              profiles
            </span>
          </div>
          <div className="mt-4 flex gap-2">
            <input
              aria-label="Search students"
              className={`${field} flex-1`}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student name, code, or email"
              value={search}
            />
            {search && (
              <button
                className="rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setSearch('')}
                type="button"
              >
                Clear
              </button>
            )}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-3">Student</th>
                  <th className="pb-3">Contact</th>
                  <th className="pb-3">Current class</th>
                  <th className="pb-3">Guardians</th>
                  {hasPermission('student.update') && <th className="pb-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="py-3">
                      <strong>
                        {student.firstName} {student.lastName}
                      </strong>
                      <small className="ml-2 text-slate-500">{student.studentCode}</small>
                    </td>
                    <td className="py-3 text-slate-600">{student.email ?? student.phone ?? '—'}</td>
                    <td className="py-3 text-slate-600">
                      {student.enrollments[0]
                        ? `${student.enrollments[0].classSection.grade.name} ${student.enrollments[0].classSection.name}`
                        : 'Not enrolled'}
                    </td>
                    <td className="py-3 text-slate-600">
                      {student.guardians.length
                        ? student.guardians.map((item) => (
                            <span
                              className="mr-2 inline-flex items-center gap-1"
                              key={item.parent.id}
                            >
                              {item.parent.firstName} {item.parent.lastName}
                              {hasPermission('student.update') && (
                                <button
                                  className="text-xs text-red-700 hover:underline"
                                  disabled={unlink.isPending}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Unlink ${item.parent.firstName} ${item.parent.lastName}?`,
                                      )
                                    )
                                      unlink.mutate({
                                        studentId: student.id,
                                        parentId: item.parent.id,
                                      });
                                  }}
                                  type="button"
                                >
                                  Unlink
                                </button>
                              )}
                            </span>
                          ))
                        : '—'}
                    </td>
                    {hasPermission('student.update') && (
                      <td className="py-3">
                        <RecordActions
                          disabled={change.isPending}
                          onEdit={() => setEditing(student)}
                          onArchive={
                            hasPermission('student.delete')
                              ? () => change.mutate({ id: student.id, method: 'DELETE' })
                              : undefined
                          }
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleStudents.length && (
              <p className="py-6 text-sm text-slate-500">
                {search ? 'No student matches that search.' : 'No students yet.'}
              </p>
            )}
          </div>
        </Card>
      </div>
      {hasPermission('student.update') && (
        <EditRecordDialog
          fields={
            editing
              ? [
                  {
                    name: 'studentCode',
                    label: 'Student code',
                    value: editing.studentCode,
                    required: true,
                  },
                  {
                    name: 'firstName',
                    label: 'First name',
                    value: editing.firstName,
                    required: true,
                  },
                  { name: 'lastName', label: 'Last name', value: editing.lastName, required: true },
                  {
                    name: 'dateOfBirth',
                    label: 'Date of birth',
                    value: editing.dateOfBirth?.slice(0, 10),
                    type: 'date',
                  },
                  {
                    name: 'gender',
                    label: 'Gender',
                    value: editing.gender ?? '',
                    type: 'select',
                    options: ['', 'FEMALE', 'MALE', 'OTHER'],
                  },
                  { name: 'email', label: 'Email', value: editing.email, type: 'email' },
                  { name: 'phone', label: 'Phone', value: editing.phone },
                  { name: 'address', label: 'Address', value: editing.address, type: 'textarea' },
                  {
                    name: 'status',
                    label: 'Status',
                    value: editing.status ?? 'ACTIVE',
                    type: 'select',
                    options: ['ACTIVE', 'INACTIVE'],
                  },
                ]
              : []
          }
          isOpen={Boolean(editing)}
          onClose={() => setEditing(null)}
          onSubmit={save}
          pending={change.isPending}
          title="Edit student"
        />
      )}
    </>
  );
}
