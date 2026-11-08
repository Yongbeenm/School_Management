'use client';

import { PropsWithChildren } from 'react';
import { AuthProvider } from './auth-provider';
import { QueryProvider } from './query-provider';

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}
