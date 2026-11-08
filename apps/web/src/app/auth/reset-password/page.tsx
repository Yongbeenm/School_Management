'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiJson } from '@/lib/api';

function ResetPasswordForm() {
  const query = useSearchParams(); const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const newPassword = String(form.get('password')); const confirmPassword = String(form.get('confirmPassword'));
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setPending(true); setError(null);
    try { await apiJson('/auth/reset-password', 'POST', { email: query.get('email'), token: query.get('token'), newPassword }); setMessage('Password reset successfully. You can now sign in.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to reset password.'); }
    finally { setPending(false); }
  };
  const linkValid = query.get('email') && query.get('token');
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><p className="text-sm font-semibold tracking-widest text-teal-700">ACCOUNT RECOVERY</p><h1 className="mt-2 text-3xl font-semibold">Choose a new password</h1>{!linkValid ? <p className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-700">This reset link is incomplete or invalid.</p> : <form className="mt-7 grid gap-4" onSubmit={submit}><input className="h-11 rounded-md border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-teal-600" minLength={12} name="password" placeholder="New password" required type="password" /><input className="h-11 rounded-md border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-teal-600" minLength={12} name="confirmPassword" placeholder="Confirm password" required type="password" />{message && <p className="rounded-md bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}{error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button disabled={pending}>{pending ? 'Resetting…' : 'Reset password'}</Button></form>}<Link className="mt-5 block text-center text-sm font-medium text-teal-700" href="/auth/login">Back to sign in</Link></section></main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-sm text-slate-600">Loading password reset…</main>}><ResetPasswordForm /></Suspense>;
}
