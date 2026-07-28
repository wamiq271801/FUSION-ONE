/**
 * Server barrel export.
 *
 * Only import from this in API routes (app/api/**) and server components.
 * NEVER import server/* in client components — it will pull in Node.js-only
 * modules and break the browser bundle.
 */
export { supabaseAdmin } from './supabase/admin';
export * from './services/accounts';
