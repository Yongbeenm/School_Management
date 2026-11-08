'use client';

import { useRouter } from 'next/navigation';
import { PropsWithChildren, useEffect } from 'react';
import { workspaceRoute } from '@/lib/workspace-route';
import { useAuth } from '@/providers/auth-provider';

export function FinanceGuard({ children }: PropsWithChildren) {
  const { user, isLoading, can } = useAuth();
  const router = useRouter();
  const allowed = Boolean(user && can('fee.read', 'SCHOOL') && can('payment.read', 'SCHOOL'));
  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/auth/login');
    else if (!allowed) router.replace(workspaceRoute(user));
  }, [allowed, isLoading, router, user]);
  if (isLoading || !user || !allowed)
    return <main className="p-8 text-slate-600">Opening finance workspace…</main>;
  return <>{children}</>;
}

export function FinanceCreateGuard({ children }: PropsWithChildren) {
  const { user, isLoading, can } = useAuth();
  const router = useRouter();
  const allowed = Boolean(user && can('fee.read', 'SCHOOL') && can('payment.read', 'SCHOOL') && can('fee.create', 'SCHOOL'));
  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/auth/login');
    else if (!allowed) router.replace(workspaceRoute(user));
  }, [allowed, isLoading, router, user]);
  if (isLoading || !user || !allowed) return <main className="p-8 text-slate-600">Opening class fees…</main>;
  return <>{children}</>;
}
