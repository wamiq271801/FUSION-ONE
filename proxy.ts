import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware — the single authentication and authorization checkpoint.
 *
 * Responsibilities:
 * 1. Refresh the Supabase auth token on every request and propagate the
 *    updated cookie to both the server (request) and the browser (response).
 * 2. Validate the session using getClaims() — this validates the JWT
 *    signature locally and is safe for server-side route protection.
 * 3. Enforce route protection before any page renders:
 *    - Unauthenticated users are redirected to /login
 *    - Authenticated users who haven't completed onboarding go to /onboarding
 *    - Authenticated users on /login are sent to /dashboard
 * 4. Return 401 for unauthenticated API requests to /api/accounts/*
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through WhatsApp API routes — they use their own internal key auth.
  if (pathname.startsWith('/api/whatsapp')) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          // Write cookies onto the request so Server Components see the
          // refreshed token on this same request cycle.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Rebuild the response so we can attach the refreshed cookies and
          // any cache-control headers that prevent CDN caching of sessions.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(cacheHeaders).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  // IMPORTANT: Do NOT add any logic between createServerClient and
  // getClaims/getUser. The token refresh only fires inside those calls.
  // getClaims() validates the JWT signature — safe for server-side protection.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;

  // ── /api/accounts/* — return 401 for unauthenticated API calls ────────────
  if (pathname.startsWith('/api/accounts')) {
    if (!claims) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return supabaseResponse;
  }

  // ── /login ─────────────────────────────────────────────────────────────────
  if (pathname === '/login') {
    if (claims) {
      // Authenticated user visiting login — check if onboarding is done.
      const { data: store } = await supabase
        .from('store')
        .select('onboarding_complete')
        .limit(1)
        .maybeSingle();

      if (store?.onboarding_complete) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
      // Authenticated but onboarding not done — send to onboarding.
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }
    // Not authenticated — show the login page.
    return supabaseResponse;
  }

  // ── /onboarding ────────────────────────────────────────────────────────────
  if (pathname === '/onboarding') {
    if (!claims) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    // Authenticated — allow onboarding regardless of onboarding_complete flag.
    return supabaseResponse;
  }

  // ── All other routes (authenticated app pages) ─────────────────────────────
  if (!claims) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Validate ownership and onboarding status for app pages.
  const { data: store } = await supabase
    .from('store')
    .select('owner_user_id, onboarding_complete')
    .limit(1)
    .maybeSingle();

  if (store?.owner_user_id && store.owner_user_id !== claims.sub) {
    // A different user owns this instance — reject.
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (!store?.onboarding_complete) {
    // Authenticated but setup not done — redirect to onboarding.
    const url = request.nextUrl.clone();
    url.pathname = '/onboarding';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public files with common extensions
     *
     * The /api/invoice and /api/whatsapp routes:
     * - /api/whatsapp is excluded above via early return
     * - /api/invoice generates PDFs from provided data — no DB auth needed
     *   but it is still matched so the token is refreshed on each call
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
