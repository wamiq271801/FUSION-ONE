import { ToastProvider } from '@/components/ui/Toast';

/**
 * Minimal layout for authentication pages (/login, /onboarding).
 * No sidebar, header, or auth providers — just the Toast system.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
