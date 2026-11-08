'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Card, PageHeader } from '@/components/admin/page-header';
import { StaffDashboardGuard } from '@/components/dashboard/staff-dashboard-guard';
import { Button } from '@/components/ui/button';
import { apiFetch, apiJson, PermissionScope } from '@/lib/api';

type Permission = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string | null;
  action: string | null;
};
type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  rolePermissions: { scope: PermissionScope; permission: Permission }[];
};
type Grants = Record<string, PermissionScope>;

const scopes: PermissionScope[] = ['OWN', 'LINKED', 'ASSIGNED', 'SCHOOL', 'GLOBAL'];
const scopeHelp: Record<PermissionScope, string> = {
  OWN: 'Only their own record',
  LINKED: 'Records linked to them, such as a parent’s child',
  ASSIGNED: 'Classes or records assigned to them',
  SCHOOL: 'Records in their current school',
  GLOBAL: 'Records across schools where supported',
};

function defaultScope(roleCode: string): PermissionScope {
  if (roleCode === 'STUDENT') return 'OWN';
  if (roleCode === 'PARENT') return 'LINKED';
  if (roleCode === 'TEACHER') return 'ASSIGNED';
  if (['ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'LIBRARIAN'].includes(roleCode)) return 'SCHOOL';
  return 'OWN';
}

function grantsFor(role: Role | undefined): Grants {
  return Object.fromEntries(
    role?.rolePermissions.map((grant) => [grant.permission.code, grant.scope]) ?? [],
  );
}

function fingerprint(grants: Grants): string {
  return JSON.stringify(Object.entries(grants).sort(([a], [b]) => a.localeCompare(b)));
}

function RolePermissionsEditor() {
  const client = useQueryClient();
  const [selectedCode, setSelectedCode] = useState('ADMIN');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Grants>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => apiFetch<Role[]>('/roles') });
  const permissions = useQuery({
    queryKey: ['permissions'],
    queryFn: () => apiFetch<Permission[]>('/permissions'),
  });
  const selectedRole = roles.data?.find((role) => role.code === selectedCode);
  const saved = grantsFor(selectedRole);
  const dirty = fingerprint(draft) !== fingerprint(saved);
  const protectedRole = selectedRole?.code === 'SUPER_ADMIN';

  useEffect(() => {
    setDraft(grantsFor(selectedRole));
  }, [selectedRole?.id]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = (permissions.data ?? []).filter((permission) =>
      `${permission.code} ${permission.name} ${permission.module ?? ''}`
        .toLowerCase()
        .includes(term),
    );
    const grouped = matching.reduce<Record<string, Permission[]>>((result, permission) => {
      const module = permission.module ?? 'Other';
      (result[module] ??= []).push(permission);
      return result;
    }, {});
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions.data, search]);

  const save = useMutation({
    mutationFn: () =>
      apiJson(`/roles/${selectedRole!.id}/permissions`, 'PUT', {
        grants: Object.entries(draft).map(([code, scope]) => ({ code, scope })),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['roles'] });
      setError(null);
      setNotice(
        'Permissions saved. The API enforces the new access now; users should reload to refresh their menus.',
      );
    },
    onError: (reason: Error) => {
      setNotice(null);
      setError(reason.message);
    },
  });

  const createRole = useMutation({
    mutationFn: (body: { code: string; name: string; description: string }) =>
      apiJson<Role>('/roles', 'POST', body),
    onSuccess: async (role) => {
      await client.invalidateQueries({ queryKey: ['roles'] });
      setSelectedCode(role.code);
      setError(null);
      setNotice(`${role.name} created. Choose its permissions and save.`);
    },
    onError: (reason: Error) => setError(reason.message),
  });

  function submitNewRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    createRole.mutate(
      {
        code: String(data.get('code')).trim().toUpperCase().replaceAll(/\s+/g, '_'),
        name: String(data.get('name')).trim(),
        description: String(data.get('description')).trim(),
      },
      { onSuccess: () => form.reset() },
    );
  }

  return (
    <>
      <PageHeader
        title="Role permissions"
        description="Choose which actions each role can perform and how much data it can see. Changes to a role affect every school using that role."
        eyebrow="Platform workspace"
      />
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {(roles.isError || permissions.isError) && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          Could not load roles and permissions. Reload the page to try again.
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="contents xl:col-start-1 xl:row-start-1 xl:block">
          <Card>
            <label className="block text-sm font-semibold text-[#102641]" htmlFor="access-role">
              Edit role
            </label>
            <select
              className="mt-3 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
              id="access-role"
              value={selectedRole?.code ?? ''}
              onChange={(event) => {
                if (dirty && !window.confirm('Discard unsaved permission changes?')) return;
                setSelectedCode(event.target.value);
                setNotice(null);
                setError(null);
              }}
            >
              {!selectedRole && <option value="">Loading roles…</option>}
              {roles.data?.map((role) => (
                <option key={role.id} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
            {selectedRole && (
              <>
                <p className="mt-3 text-sm text-slate-600">
                  {selectedRole.description ||
                    (protectedRole ? 'Platform owner access' : 'No description provided.')}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  {Object.keys(draft).length} of {permissions.data?.length ?? 0} permissions
                  selected
                </p>
                {protectedRole && (
                  <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
                    Super Admin access is protected and cannot be edited here.
                  </p>
                )}
              </>
            )}
          </Card>
          <div className="order-3 space-y-5 xl:mt-5">
            <Card>
              <h2 className="font-semibold text-[#102641]">Scope guide</h2>
              <dl className="mt-3 space-y-3 text-sm">
                {scopes.map((scope) => (
                  <div key={scope}>
                    <dt className="font-semibold text-[#102641]">{scope}</dt>
                    <dd className="text-slate-600">{scopeHelp[scope]}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-slate-500">
                Some actions also require a named role. The API checks both the role and permission
                where needed.
              </p>
            </Card>
            <Card>
              <h2 className="font-semibold text-[#102641]">Create a role</h2>
              <form className="mt-4 grid gap-3" onSubmit={submitNewRole}>
                <label className="text-xs font-semibold text-slate-600">
                  Name
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                    name="name"
                    placeholder="Teaching assistant"
                    required
                    minLength={2}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Code
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm uppercase"
                    name="code"
                    placeholder="TEACHING_ASSISTANT"
                    required
                    minLength={2}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Description
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
                    name="description"
                    placeholder="Optional description"
                  />
                </label>
                <Button disabled={createRole.isPending || dirty} type="submit">
                  {createRole.isPending ? 'Creating…' : 'Create role'}
                </Button>
                {dirty && (
                  <p className="text-xs text-amber-700">
                    Save or discard the current changes before creating another role.
                  </p>
                )}
              </form>
            </Card>
          </div>
        </div>
        <div className="order-2 xl:col-start-2 xl:row-start-1">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#102641]">
                  {selectedRole?.name ?? 'Permissions'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Turn on an action, then choose the data scope for it.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {dirty && (
                  <span className="text-xs font-semibold text-amber-700">Unsaved changes</span>
                )}
                <button
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 disabled:opacity-50"
                  disabled={!dirty || save.isPending}
                  onClick={() => setDraft(saved)}
                  type="button"
                >
                  Discard
                </button>
                <Button
                  disabled={!selectedRole || protectedRole || !dirty || save.isPending}
                  onClick={() => save.mutate()}
                  type="button"
                >
                  {save.isPending ? 'Saving…' : 'Save permissions'}
                </Button>
              </div>
            </div>
            <label
              className="mt-5 block text-xs font-semibold text-slate-600"
              htmlFor="permission-search"
            >
              Find a permission
            </label>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              id="permission-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search actions or modules"
              type="search"
              value={search}
            />
            {permissions.isLoading || roles.isLoading ? (
              <p className="py-8 text-sm text-slate-500">Loading permissions…</p>
            ) : (
              <div className="mt-6 space-y-7">
                {groups.map(([module, items]) => (
                  <section key={module}>
                    <h3 className="border-b border-[#e8eff3] pb-2 text-sm font-bold capitalize text-[#102641]">
                      {module.replaceAll(/[._]/g, ' ')}
                    </h3>
                    <div className="divide-y divide-[#e8eff3]">
                      {items?.map((permission) => (
                        <div className="flex flex-wrap items-center gap-3 py-3" key={permission.id}>
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm text-[#102641]">
                            <input
                              aria-label={`Grant ${permission.code}`}
                              checked={Boolean(draft[permission.code])}
                              className="size-4 accent-[#086bd4]"
                              disabled={protectedRole || !selectedRole}
                              onChange={(event) =>
                                setDraft((current) => {
                                  const next = { ...current };
                                  if (event.target.checked)
                                    next[permission.code] = defaultScope(selectedRole!.code);
                                  else delete next[permission.code];
                                  return next;
                                })
                              }
                              type="checkbox"
                            />
                            <span className="min-w-0">
                              <strong className="block capitalize">
                                {(permission.action ?? permission.code).replaceAll(/[._]/g, ' ')}
                              </strong>
                              <small className="block break-all text-xs text-slate-500">
                                {permission.code}
                              </small>
                            </span>
                          </label>
                          {draft[permission.code] && (
                            <select
                              aria-label={`Scope for ${permission.code}`}
                              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs"
                              disabled={protectedRole}
                              onChange={(event) =>
                                setDraft((current) => ({
                                  ...current,
                                  [permission.code]: event.target.value as PermissionScope,
                                }))
                              }
                              value={draft[permission.code]}
                            >
                              {scopes.map((scope) => (
                                <option key={scope} value={scope}>
                                  {scope}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
                {!groups.length && (
                  <p className="text-sm text-slate-500">No permissions match your search.</p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function AccessPage() {
  return (
    <StaffDashboardGuard role="SUPER_ADMIN">
      <RolePermissionsEditor />
    </StaffDashboardGuard>
  );
}
