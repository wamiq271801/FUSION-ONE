/**
 * Server-side Supabase client (service-role).
 *
 * Uses the service role key — bypasses Row Level Security.
 * ONLY import this in API routes (app/api/**), never in client code.
 *
 * All API routes that currently inline `createClient(...)` should
 * import from here instead, so the client is created once per module.
 */
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
