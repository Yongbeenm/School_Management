'use client';

import { useRouter } from 'next/navigation';
import { PropsWithChildren, useEffect } from 'react';
import { workspaceRoute } from '@/lib/workspace-route';
import { useAuth } from '@/providers/auth-provider';

export function StaffDashboardGuard({ role, children }: PropsWithChildren<{ role: string }>) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/auth/login');
    else if (!user.roles.includes(role)) router.replace(workspaceRoute(user));
  }, [isLoading, role, router, user]);

  if (isLoading || !user || !user.roles.includes(role)) {
    return <main className="p-8 text-slate-600">Opening your dashboard…</main>;
  }
  return <>{children}</>;
}
