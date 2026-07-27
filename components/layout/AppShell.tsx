'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { ToastProvider } from '../ui/Toast';
import { AuthProvider } from '../auth/AuthProvider';
import { FinancialYearProvider } from '../providers/FinancialYearProvider';
import QueryProvider from '../providers/QueryProvider';

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthOrOnboardingPage = pathname === '/login' || pathname === '/onboarding';

  return (
    <ToastProvider>
      <QueryProvider>
        <AuthProvider>
          <FinancialYearProvider>
            {isAuthOrOnboardingPage ? (
              children
            ) : (
              <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
                <Sidebar />
                <div className="flex flex-col flex-1 overflow-hidden">
                  <main className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="max-w-7xl mx-auto w-full">
                      {children}
                    </div>
                  </main>
                </div>
              </div>
            )}
          </FinancialYearProvider>
        </AuthProvider>
      </QueryProvider>
    </ToastProvider>
  );
}
