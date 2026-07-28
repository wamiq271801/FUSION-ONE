import { createBrowserClient } from '@supabase/ssr';

/**
 * Cookie-aware Supabase browser client.
 *
 * createBrowserClient uses a singleton pattern internally — only one instance
 * is ever created, no matter how many times this module is imported.
 *
 * Use this in Client Components and client-side hooks.
 * Use `platform/supabase/server.ts` for Server Components, Server Actions, and Route Handlers.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
