import { createClient } from '@/platform/supabase/server';
import AppShell from '@/components/layout/AppShell';

/**
 * Server layout for all authenticated app pages.
 *
 * By the time this renders, middleware has already:
 * 1. Validated the session with getClaims()
 * 2. Confirmed the user is the store owner
 * 3. Confirmed onboarding is complete
 *
 * This layout reads the user once per request and passes it down to the
 * AppShell which provides it to the SessionProvider for client-side display.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Middleware guarantees user is non-null here. The non-null assertion is safe.
  const sessionUser = {
    id: user!.id,
    email: user!.email ?? '',
  };

  return <AppShell user={sessionUser}>{children}</AppShell>;
}
