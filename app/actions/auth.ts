'use server';

import { createClient } from '@/platform/supabase/server';

/**
 * Server Action: sign out the current user.
 *
 * Clears the HTTP-only session cookie server-side. The client-side
 * SessionProvider's signOut calls this first, then clears the browser
 * Supabase state and navigates to /login.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
