'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Card, PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { apiFetch, apiJson } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

interface Role {
  id: string;
  code: string;
  name: string;
  rolePermissions?: { scope: string; permission: { code: string } }[];
}
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  userRoles: { role: Role }[];
}
interface Page<T> { items: T[]; meta: { total: number; page: number; totalPages: number } }

const field = 'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-teal-600';

export default function UsersPage() {
  const client = useQueryClient();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.roles.includes('SUPER_ADMIN') ?? false;
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [page, setPage] = useState(1);
  const users = useQuery({
    queryKey: ['users', page, userSearch],
    queryFn: () => apiFetch<Page<User>>(`/users?page=${page}&pageSize=25&search=${encodeURIComponent(userSearch.trim())}`),
  });
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => apiFetch<Role[]>('/roles') });
  const assignableRoles = roles.data?.filter((role) =>
    isSuperAdmin || (
      role.code !== 'SUPER_ADMIN' &&
      !role.rolePermissions?.some((grant) =>
        grant.scope === 'GLOBAL' || ['role.manage', 'permission.manage', 'school.manage'].includes(grant.permission.code),
      )
    ),
  ) ?? [];

  const create = useMutation({
    mutationFn: async (body: { user: unknown; roleCode: string }) => {
      const created = await apiJson<User>('/users', 'POST', body.user);
      await apiJson(`/users/${created.id}/roles`, 'PUT', { roleCodes: [body.roleCode] });
      return created;
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['users'] }); setError(null); },
    onError: (reason: Error) => setError(reason.message),
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => apiJson(`/users/${id}/status`, 'PATCH', { status: value }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['users'] }); setError(null); },
    onError: (reason: Error) => setError(reason.message),
  });
  const assignRoles = useMutation({
    mutationFn: ({ id, roleCodes }: { id: string; roleCodes: string[] }) => apiJson(`/users/${id}/roles`, 'PUT', { roleCodes }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['users'] }); setEditingUserId(null); setError(null); },
    onError: (reason: Error) => setError(reason.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    create.mutate({
      user: {
        email: data.get('email'),
        firstName: data.get('firstName'),
        lastName: data.get('lastName'),
        password: data.get('password'),
        status: data.get('status'),
      },
      roleCode: String(data.get('roleCode')),
    }, { onSuccess: () => form.reset() });
  }

  return <>
    <PageHeader
      title="Users & access"
      description="Create accounts, assign roles, and activate or deactivate access. Password changes use the password reset workflow."
      action={isSuperAdmin ? <Link className="inline-flex h-10 items-center rounded-lg bg-[#086bd4] px-4 text-sm font-semibold text-white" href="/admin/access">Manage role permissions</Link> : undefined}
    />
    {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
    <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
      <Card>
        <h2 className="font-semibold">Create user account</h2>
        <form className="mt-4 grid gap-3" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <input aria-label="First name" className={field} name="firstName" placeholder="First name" required />
            <input aria-label="Last name" className={field} name="lastName" placeholder="Last name" required />
          </div>
          <input aria-label="Email address" className={field} name="email" placeholder="Email address" required type="email" />
          <input aria-label="Initial password" className={field} minLength={12} name="password" placeholder="Initial password (12+ chars)" required type="password" />
          <select aria-label="Assign role" className={field} defaultValue="" name="roleCode" required>
            <option disabled value="">Assign role</option>
            {assignableRoles.map((role) => <option key={role.id} value={role.code}>{role.name}</option>)}
          </select>
          <select aria-label="Account status" className={field} defaultValue="ACTIVE" name="status">
            <option>ACTIVE</option><option>INVITED</option><option>SUSPENDED</option>
          </select>
          <Button disabled={create.isPending} type="submit">{create.isPending ? 'Creating…' : 'Create user'}</Button>
        </form>
      </Card>
      <Card>
        <div className="flex justify-between gap-3">
          <h2 className="font-semibold">User accounts</h2>
          <span className="text-sm text-slate-500">{users.data?.meta.total ?? 0} accounts</span>
        </div>
        <label className="mt-4 block text-xs font-semibold text-slate-600" htmlFor="user-search">Find a user</label>
        <input
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
          id="user-search"
          onChange={(event) => { setUserSearch(event.target.value); setPage(1); setEditingUserId(null); }}
          placeholder="Search name or email"
          type="search"
          value={userSearch}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="pb-3">User</th><th className="pb-3">Roles</th><th className="pb-3">Status</th></tr>
            </thead>
            <tbody className="divide-y">
              {users.data?.items.map((account) => {
                const superAdmin = account.userRoles.some(({ role }) => role.code === 'SUPER_ADMIN');
                const protectedAssignment = account.userRoles.some(({ role }) =>
                  !assignableRoles.some((option) => option.code === role.code),
                );
                const canEdit = isSuperAdmin || (!superAdmin && !protectedAssignment);
                return <tr key={account.id}>
                  <td className="py-3">
                    <strong>{account.firstName} {account.lastName}</strong>
                    <small className="ml-2 text-slate-500">{account.email}</small>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {account.userRoles.map(({ role }) => <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800" key={role.code}>{role.name}</span>)}
                      {!account.userRoles.length && <span className="text-xs text-slate-500">No roles</span>}
                    </div>
                    {canEdit && (editingUserId === account.id ? (
                      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <fieldset>
                          <legend className="text-xs font-semibold text-slate-700">Roles for {account.email}</legend>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {assignableRoles.map((role) => <label className="flex items-center gap-2 text-xs text-slate-700" key={role.id}>
                              <input
                                checked={roleDraft.includes(role.code)}
                                className="size-4 accent-[#086bd4]"
                                disabled={account.id === currentUser?.id && role.code === 'SUPER_ADMIN'}
                                onChange={(event) => setRoleDraft((current) => event.target.checked
                                  ? [...current, role.code]
                                  : current.filter((code) => code !== role.code))}
                                type="checkbox"
                              />{role.name}
                            </label>)}
                          </div>
                        </fieldset>
                        <div className="mt-3 flex gap-2">
                          <Button disabled={!roleDraft.length || assignRoles.isPending} onClick={() => assignRoles.mutate({ id: account.id, roleCodes: roleDraft })} type="button">{assignRoles.isPending ? 'Saving…' : 'Save roles'}</Button>
                          <button className="rounded-lg border border-slate-300 px-3 text-xs" onClick={() => setEditingUserId(null)} type="button">Cancel</button>
                        </div>
                      </div>
                    ) : <button className="mt-2 text-xs font-semibold text-blue-700 hover:underline" onClick={() => {
                      setEditingUserId(account.id);
                      setRoleDraft(account.userRoles.map(({ role }) => role.code));
                    }} type="button">Edit roles</button>)}
                  </td>
                  <td className="py-3">
                    <select
                      aria-label={`Status for ${account.email}`}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      disabled={!canEdit || status.isPending || account.id === currentUser?.id}
                      onChange={(event) => status.mutate({ id: account.id, value: event.target.value })}
                      value={account.status}
                    >
                      <option>ACTIVE</option><option>INVITED</option><option>SUSPENDED</option><option>DEACTIVATED</option>
                    </select>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
          {!users.isLoading && !users.data?.items.length && <p className="py-6 text-sm text-slate-500">No matching users.</p>}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-600">
          <span>Page {users.data?.meta.page ?? page} of {Math.max(1, users.data?.meta.totalPages ?? 1)}</span>
          <div className="flex gap-2">
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => { setPage(page - 1); setEditingUserId(null); }} type="button">Previous</button>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40" disabled={page >= (users.data?.meta.totalPages ?? 1)} onClick={() => { setPage(page + 1); setEditingUserId(null); }} type="button">Next</button>
          </div>
        </div>
      </Card>
    </div>
  </>;
}
