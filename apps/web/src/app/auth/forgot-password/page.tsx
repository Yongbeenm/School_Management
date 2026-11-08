'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiJson } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPending(true); setError(null);
    const email = String(new FormData(event.currentTarget).get('email'));
    try { await apiJson('/auth/forgot-password', 'POST', { email }); setMessage('If this account exists, reset instructions have been sent.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to request a reset.'); }
    finally { setPending(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><p className="text-sm font-semibold tracking-widest text-teal-700">ACCOUNT RECOVERY</p><h1 className="mt-2 text-3xl font-semibold">Reset your password</h1><p className="mt-2 text-sm text-slate-600">Enter your account email and we’ll send a secure reset link.</p><form className="mt-7 grid gap-4" onSubmit={submit}><input className="h-11 rounded-md border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-teal-600" name="email" placeholder="Email address" required type="email" />{message && <p className="rounded-md bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}{error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</Button></form><Link className="mt-5 block text-center text-sm font-medium text-teal-700" href="/auth/login">Back to sign in</Link></section></main>;
}
