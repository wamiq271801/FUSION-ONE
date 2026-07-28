import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a request-scoped Supabase client for use in:
 * - Server Components
 * - Server Actions
 * - Route Handlers
 * - Middleware (via its own variant — see middleware.ts)
 *
 * Do NOT use this in Client Components. Use `platform/supabase/client.ts` there.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from Server Components where cookies cannot be
            // written. The middleware handles writing cookies on every request,
            // so this is safe to ignore here.
          }
        },
      },
    },
  );
}
