'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Card, PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { apiFetch, apiJson } from '@/lib/api';

interface School { id: string; code: string; name: string; email?: string | null; phone?: string | null; address?: string | null; organization: { name: string } }
const field = 'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-teal-600';

export default function SettingsPage() {
  const client = useQueryClient(); const [message, setMessage] = useState<string | null>(null);
  const school = useQuery({ queryKey: ['school'], queryFn: () => apiFetch<School>('/schools/current') });
  const update = useMutation({ mutationFn: (body: unknown) => apiJson<School>('/schools/current', 'PATCH', body), onSuccess: () => { void client.invalidateQueries({ queryKey: ['school'] }); setMessage('School settings saved.'); }, onError: (reason: Error) => setMessage(reason.message) });
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const d = new FormData(event.currentTarget); update.mutate({ name: d.get('name'), email: d.get('email') || undefined, phone: d.get('phone') || undefined, address: d.get('address') || undefined }); };
  return <><PageHeader title="School settings" description="Manage the school identity used across Version 1 records and reports." />{message && <p className="mb-4 rounded bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}<Card><h2 className="font-semibold">School profile</h2>{school.data ? <form className="mt-5 grid max-w-xl gap-4" onSubmit={submit}><label className="grid gap-1 text-sm font-medium">School name<input className={field} defaultValue={school.data.name} name="name" required /></label><label className="grid gap-1 text-sm font-medium">School code<input className={field + ' bg-slate-100'} defaultValue={school.data.code} disabled /></label><label className="grid gap-1 text-sm font-medium">Organization<input className={field + ' bg-slate-100'} defaultValue={school.data.organization.name} disabled /></label><label className="grid gap-1 text-sm font-medium">Email<input className={field} defaultValue={school.data.email ?? ''} name="email" type="email" /></label><label className="grid gap-1 text-sm font-medium">Phone<input className={field} defaultValue={school.data.phone ?? ''} name="phone" /></label><label className="grid gap-1 text-sm font-medium">Address<textarea className="min-h-24 rounded-md border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-teal-600" defaultValue={school.data.address ?? ''} name="address" /></label><Button disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save settings'}</Button></form> : <p className="mt-4 text-sm text-slate-500">Loading school profile…</p>}</Card></>;
}
