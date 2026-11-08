'use client';

import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearAccessToken,
  login as loginRequest,
  logoutRequest,
  refreshSession,
  SessionUser,
} from '@/lib/api';

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasScope: (permission: string, scope: 'GLOBAL' | 'SCHOOL' | 'ASSIGNED' | 'LINKED' | 'OWN') => boolean;
  can: (permission: string, scope?: 'GLOBAL' | 'SCHOOL' | 'ASSIGNED' | 'LINKED' | 'OWN') => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void refreshSession()
      .then((session) => setUser(session?.user ?? null))
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      async login(email, password) {
        const session = await loginRequest(email, password);
        setUser(session.user);
        return session.user;
      },
      async logout() {
        await logoutRequest();
        setUser(null);
      },
      hasPermission(permission) {
        return user?.permissions.includes(permission) ?? false;
      },
      hasAnyPermission(permissions) {
        return permissions.some((permission) => user?.permissions.includes(permission));
      },
      hasScope(permission, scope) {
        const grantedScopes = user?.permissionScopes?.[permission] ?? [];
        return grantedScopes.includes('GLOBAL') || grantedScopes.includes(scope);
      },
      can(permission, scope) {
        return (user?.permissions.includes(permission) ?? false) && (!scope || (user?.permissionScopes?.[permission] ?? []).some((grantedScope) => grantedScope === 'GLOBAL' || grantedScope === scope));
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
