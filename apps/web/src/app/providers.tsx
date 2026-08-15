'use client';
import React from 'react';

import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '@/lib/apollo/client';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { useApolloErrors } from '@/hooks/useApolloErrors';
import { RealtimeRefresh } from '@/components/ui/RealtimeRefresh';

function ApolloErrorWatcher() {
  useApolloErrors();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ApolloProvider client={apolloClient}>
        <ToastProvider>
          <ApolloErrorWatcher />
          <RealtimeRefresh />
          {children}
        </ToastProvider>
      </ApolloProvider>
    </ThemeProvider>
  );
}
