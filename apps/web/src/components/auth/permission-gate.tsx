'use client';

import type { PropsWithChildren, ReactNode } from 'react';
import type { PermissionScope } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

/**
 * UI convenience only. Every action is still authorized again by the API.
 */
export function PermissionGate({
  permission,
  anyOf,
  scope,
  fallback = null,
  children,
}: PropsWithChildren<{
  permission?: string;
  anyOf?: string[];
  scope?: PermissionScope;
  fallback?: ReactNode;
}>) {
  const { can, hasAnyPermission } = useAuth();
  const allowed = permission ? can(permission, scope) : Boolean(anyOf && hasAnyPermission(anyOf));
  return allowed ? children : fallback;
}
