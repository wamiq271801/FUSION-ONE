import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Proxy — runs on every request before route handlers.
 *
 * Responsibilities:
 * 1. Refresh the Supabase auth session (cookie refresh).
 * 2. Redirect unauthenticated users from /(app)/* to /login.
 * 3. Redirect authenticated users from /login and /onboarding to /dashboard.
 *
 * This is the ONLY place that should call createServerClient with
 * cookie write access. The platform/supabase/server.ts createClient
 * delegates cookie writes here.
 *
 * Note: Next.js 16 renamed the `middleware` file convention to `proxy`
 * (the function is exported as `proxy` instead of `middleware`). The
 * `config`/`matcher` export is unchanged.
 */
export async function proxy(request: NextRequest) {
    const response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        },
    );

    // Refresh the session by calling getUser() — this extends the cookie expiry.
    const { data: { user } } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Public routes that don't require authentication.
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/onboarding');
    const isAppRoute = pathname.startsWith('/dashboard') ||
                       pathname.startsWith('/sales') ||
                       pathname.startsWith('/purchases') ||
                       pathname.startsWith('/proformas') ||
                       pathname.startsWith('/parties') ||
                       pathname.startsWith('/inventory') ||
                       pathname.startsWith('/payments') ||
                       pathname.startsWith('/accounts') ||
                       pathname.startsWith('/settings') ||
                       pathname.startsWith('/financial-year') ||
                       pathname.startsWith('/exchange');

    // Redirect: authenticated user visiting /login or /onboarding → /dashboard
    if (user && isAuthRoute) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Redirect: unauthenticated user visiting app routes → /login
    if (!user && isAppRoute) {
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(redirectUrl);
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - public assets
         * - api routes (they handle their own auth)
         */
        '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|bmp)$).*)',
    ],
};