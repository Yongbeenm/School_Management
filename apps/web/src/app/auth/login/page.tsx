'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { BookOpenCheck, CalendarCheck2, GraduationCap, ShieldCheck } from 'lucide-react';
import { loginSchema, type LoginInput } from '@school/validation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';
import { workspaceRoute } from '@/lib/workspace-route';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const user = await login(values.email, values.password);
      router.replace(workspaceRoute(user));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in');
    }
  });

  return (
    <main className="grid min-h-screen bg-[#f5fafb] lg:grid-cols-[minmax(0,1fr)_minmax(460px,0.85fr)]">
      <section className="relative hidden overflow-hidden bg-[#071a31] bg-[url('/images/campus-welcome.jpg')] bg-cover bg-center p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute inset-0 bg-gradient-to-r from-[#071a31]/95 via-[#0b2c53]/90 to-[#0b2c53]/60" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white text-teal-800">
            <GraduationCap size={26} />
          </span>
          <span className="text-lg font-bold">School Management</span>
        </div>
        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
            One place for your school
          </p>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            A clearer day for everyone at school.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-blue-50/90">
            Plan lessons, manage records, and follow progress from a workspace designed for your
            role.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <BookOpenCheck size={22} className="text-blue-200" />
              <p className="mt-3 text-sm font-semibold">Organize classes</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <CalendarCheck2 size={22} className="text-blue-200" />
              <p className="mt-3 text-sm font-semibold">Track each day</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <ShieldCheck size={22} className="text-blue-200" />
              <p className="mt-3 text-sm font-semibold">See what matters</p>
            </div>
          </div>
        </div>
        <p className="relative text-xs text-blue-100/75">
          School, teacher, student, and parent workspaces
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-md rounded-[28px] border border-[#dce7ed] bg-white p-7 shadow-[0_24px_64px_-42px_rgba(7,26,49,0.3)] sm:p-10">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-teal-700 text-white">
              <GraduationCap size={23} />
            </span>
            <span className="text-sm font-bold text-slate-950">School Management</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.19em] text-teal-700">
            Your school workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in to see the tools and information for your role.
          </p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              <span>Email address</span>
              <input
                type="email"
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 outline-none ring-teal-600 focus:ring-2"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <span className="text-xs text-red-700">{form.formState.errors.email.message}</span>
              )}
            </label>

            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 outline-none ring-teal-600 focus:ring-2"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <span className="text-xs text-red-700">
                  {form.formState.errors.password.message}
                </span>
              )}
            </label>

            {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <Button
              className="h-12 w-full rounded-xl"
              disabled={form.formState.isSubmitting}
              type="submit"
            >
              {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <Link
              className="block text-center text-sm font-semibold text-teal-700 hover:text-teal-800"
              href="/auth/forgot-password"
            >
              Forgot your password?
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
