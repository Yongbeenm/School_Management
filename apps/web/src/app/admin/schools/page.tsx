'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Search, ShieldCheck, UserRoundCog } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Card, PageHeader } from '@/components/admin/page-header';
import { StaffDashboardGuard } from '@/components/dashboard/staff-dashboard-guard';
import { Button } from '@/components/ui/button';
import { apiFetch, apiJson } from '@/lib/api';

type SchoolAdministrator = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  lastLoginAt: string | null;
};

type School = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  platformAnchor: boolean;
  createdAt: string;
  organization: { name: string };
  _count: { students: number; staff: number; userSchools: number };
  administrators: SchoolAdministrator[];
};

type SchoolPage = {
  items: School[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  stats: { schools: number; activeSchools: number; schoolAdmins: number };
};

const field =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function SchoolsWorkspace() {
  const client = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const schools = useQuery({
    queryKey: ['platform-schools', page, search],
    queryFn: () =>
      apiFetch<SchoolPage>(
        `/schools?page=${page}&pageSize=20&search=${encodeURIComponent(search)}`,
      ),
  });
  const create = useMutation({
    mutationFn: (body: Record<string, string>) => apiJson<School>('/schools', 'POST', body),
    onSuccess: async (school) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['platform-schools'] }),
        client.invalidateQueries({ queryKey: ['dashboard', 'super-admin'] }),
      ]);
      setError(null);
      setNotice(
        `${school.name} and its School Admin account were created. The administrator can now sign in with the initial password.`,
      );
    },
    onError: (reason: Error) => {
      setNotice(null);
      setError(reason.message);
    },
  });
  const status = useMutation({
    mutationFn: ({ schoolId, value }: { schoolId: string; value: School['status'] }) =>
      apiJson(`/schools/${schoolId}/status`, 'PATCH', { status: value }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['platform-schools'] }),
        client.invalidateQueries({ queryKey: ['dashboard', 'super-admin'] }),
      ]);
      setError(null);
      setNotice('School status updated.');
    },
    onError: (reason: Error) => {
      setNotice(null);
      setError(reason.message);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email')).trim();
    const phone = String(data.get('phone')).trim();
    const address = String(data.get('address')).trim();
    create.mutate(
      {
        code: String(data.get('code')).trim().toUpperCase(),
        name: String(data.get('name')).trim(),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(address ? { address } : {}),
        adminFirstName: String(data.get('adminFirstName')).trim(),
        adminLastName: String(data.get('adminLastName')).trim(),
        adminEmail: String(data.get('adminEmail')).trim(),
        adminPassword: String(data.get('adminPassword')),
      },
      { onSuccess: () => form.reset() },
    );
  }

  function changeStatus(school: School) {
    const value = school.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const action = value === 'INACTIVE' ? 'suspend' : 'reactivate';
    if (
      !window.confirm(
        `${action === 'suspend' ? 'Suspend' : 'Reactivate'} ${school.name}?${
          value === 'INACTIVE'
            ? ' Its users will be signed out and cannot sign in until the school is reactivated.'
            : ''
        }`,
      )
    ) {
      return;
    }
    status.mutate({ schoolId: school.id, value });
  }

  return (
    <>
      <PageHeader
        title="Schools & administrators"
        description="Register a school, create its first School Admin, and control whether that school can use the platform."
        eyebrow="Platform workspace"
      />
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <Building2 className="text-blue-700" size={22} />
          <strong className="mt-3 block text-2xl text-[#102641]">
            {schools.data?.stats.schools ?? '—'}
          </strong>
          <span className="text-sm text-slate-500">Schools on the platform</span>
        </Card>
        <Card>
          <ShieldCheck className="text-emerald-700" size={22} />
          <strong className="mt-3 block text-2xl text-[#102641]">
            {schools.data?.stats.activeSchools ?? '—'}
          </strong>
          <span className="text-sm text-slate-500">Active schools</span>
        </Card>
        <Card>
          <UserRoundCog className="text-violet-700" size={22} />
          <strong className="mt-3 block text-2xl text-[#102641]">
            {schools.data?.stats.schoolAdmins ?? '—'}
          </strong>
          <span className="text-sm text-slate-500">Active School Admins</span>
        </Card>
      </section>
      <div className="grid gap-6 xl:grid-cols-[410px_minmax(0,1fr)]">
        <Card>
          <h2 className="text-lg font-bold text-[#102641]">Add a school</h2>
          <p className="mt-1 text-sm text-slate-500">
            The school and its first administrator are created together.
          </p>
          <form className="mt-5 grid gap-3" onSubmit={submit}>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-600">
                School code
                <input
                  className={`${field} mt-1 uppercase`}
                  maxLength={20}
                  name="code"
                  pattern="[A-Za-z][A-Za-z0-9_-]{1,19}"
                  placeholder="NORTH01"
                  required
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                School name
                <input className={`${field} mt-1`} maxLength={200} name="name" required />
              </label>
            </div>
            <label className="text-xs font-semibold text-slate-600">
              School email
              <input className={`${field} mt-1`} name="email" type="email" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              School phone
              <input className={`${field} mt-1`} maxLength={30} name="phone" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              School address
              <textarea
                className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                maxLength={500}
                name="address"
              />
            </label>
            <div className="mt-2 border-t border-slate-200 pt-4">
              <h3 className="font-bold text-[#102641]">First School Admin</h3>
              <p className="mt-1 text-xs text-slate-500">
                This person will manage the school’s staff, students, academics, and finance.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                aria-label="Admin first name"
                className={field}
                maxLength={100}
                name="adminFirstName"
                placeholder="First name"
                required
              />
              <input
                aria-label="Admin last name"
                className={field}
                maxLength={100}
                name="adminLastName"
                placeholder="Last name"
                required
              />
            </div>
            <input
              aria-label="Admin email"
              className={field}
              name="adminEmail"
              placeholder="Admin email"
              required
              type="email"
            />
            <input
              aria-label="Admin initial password"
              className={field}
              maxLength={128}
              minLength={12}
              name="adminPassword"
              placeholder="Initial password (12+ characters)"
              required
              type="password"
            />
            <p className="text-xs leading-5 text-slate-500">
              Share the initial password securely. The administrator can replace it through the
              password reset flow.
            </p>
            <Button disabled={create.isPending} type="submit">
              {create.isPending ? 'Creating school…' : 'Create school and admin'}
            </Button>
          </form>
        </Card>
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#102641]">Platform schools</h2>
              <p className="mt-1 text-sm text-slate-500">
                School Admins handle operations inside their own school.
              </p>
            </div>
            <form
              className="flex w-full max-w-sm gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setSearch(searchText.trim());
              }}
            >
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Find a school</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={17}
                />
                <input
                  className={`${field} pl-9`}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Name, code, or email"
                  type="search"
                  value={searchText}
                />
              </label>
              <Button type="submit">Search</Button>
            </form>
          </div>
          {schools.isError && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              Schools could not be loaded.
            </p>
          )}
          {schools.isLoading && <p className="mt-5 text-sm text-slate-500">Loading schools…</p>}
          <div className="mt-4 divide-y divide-slate-100">
            {schools.data?.items.map((school) => (
              <article className="py-5 first:pt-0" key={school.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[#102641]">{school.name}</h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          school.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {school.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {school.code} · {school._count.students} students · {school._count.staff}{' '}
                      staff · {school._count.userSchools} accounts
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{school.address || 'No address'}</p>
                  </div>
                  <button
                    className={`rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50 ${
                      school.status === 'ACTIVE'
                        ? 'border-red-200 text-red-700 hover:bg-red-50'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                    disabled={status.isPending || school.platformAnchor}
                    onClick={() => changeStatus(school)}
                    type="button"
                  >
                    {school.platformAnchor
                      ? 'Platform host'
                      : school.status === 'ACTIVE'
                        ? 'Suspend school'
                        : 'Reactivate school'}
                  </button>
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    School Admin
                  </p>
                  {school.administrators.length ? (
                    school.administrators.map((administrator) => (
                      <p className="mt-1 text-sm text-slate-700" key={administrator.id}>
                        <strong>
                          {administrator.firstName} {administrator.lastName}
                        </strong>{' '}
                        · {administrator.email} · {administrator.status.toLowerCase()}
                      </p>
                    ))
                  ) : (
                    <p className="mt-1 text-sm text-amber-700">No School Admin assigned</p>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!schools.isLoading && !schools.data?.items.length && (
            <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              No schools match this search.
            </p>
          )}
          {schools.data && (
            <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-600">
              <span>
                Page {schools.data.meta.page} of {Math.max(1, schools.data.meta.totalPages)}
              </span>
              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40"
                  disabled={page >= schools.data.meta.totalPages}
                  onClick={() => setPage(page + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

export default function SchoolsPage() {
  return (
    <StaffDashboardGuard role="SUPER_ADMIN">
      <SchoolsWorkspace />
    </StaffDashboardGuard>
  );
}
