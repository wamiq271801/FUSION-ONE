'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { ToastProvider } from '../ui/Toast';
import { SessionProvider } from '@/shared/providers/SessionProvider';
import { FinancialYearProvider } from '@/shared/providers/FinancialYearProvider';
import QueryProvider from '@/shared/providers/QueryProvider';

interface SessionUser {
  id: string;
  email: string;
}

interface AppShellProps {
  user: SessionUser;
  children: ReactNode;
}

/**
 * AppShell wraps all authenticated pages with the full layout and providers.
 *
 * The user is passed from the server layout (app/(app)/layout.tsx) which
 * reads it from the session cookie. AppShell does not make any auth decisions —
 * it only renders the layout and provides the user to client components via
 * SessionProvider.
 */
export default function AppShell({ user, children }: AppShellProps) {
  return (
    <ToastProvider>
      <QueryProvider>
        <SessionProvider user={user}>
          <FinancialYearProvider>
            <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
              <Header />
              <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto p-6 md:p-8">
                  <div className="max-w-7xl mx-auto w-full">{children}</div>
                </main>
              </div>
            </div>
          </FinancialYearProvider>
        </SessionProvider>
      </QueryProvider>
    </ToastProvider>
  );
}
