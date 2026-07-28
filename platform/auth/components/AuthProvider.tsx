'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
  isLoading: boolean;
  isOwner: boolean;
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  signOut: async () => {},
  isLoading: true,
  isOwner: false,
  completeOnboarding: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Track the currently-resolved user id so we can ignore duplicate
  // SIGNED_IN events that Supabase emits on tab focus / visibility change.
  const resolvedUserId = useRef<string | null>(null);

  // Resolves ownership for a signed-in user. Returns nothing; sets state.
  async function resolveOwnership(authUser: User) {
    try {
      const { data: store } = await supabase
        .from('store')
        .select('owner_user_id, onboarding_complete')
        .limit(1)
        .maybeSingle();

      if (store?.owner_user_id && store.owner_user_id !== authUser.id) {
        // Another account owns this app — reject
        setIsOwner(false);
        setUser(null);
        setSession(null);
        resolvedUserId.current = null;
        await supabase.auth.signOut();
      } else if (store?.owner_user_id) {
        setIsOwner(true);
        setIsOnboardingComplete(!!store.onboarding_complete);
        resolvedUserId.current = authUser.id;
      } else {
        // No store yet — this user becomes owner via onboarding
        setIsOwner(true);
        setIsOnboardingComplete(false);
        resolvedUserId.current = authUser.id;
      }
    } catch (e) {
      console.error('Ownership check failed', e);
      // Fail open as owner so the app is usable; onboarding will correct it
      setIsOwner(true);
      resolvedUserId.current = authUser.id;
    }
  }

  // ─── Initial load (runs once) ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (s?.user) {
          setSession(s);
          setUser(s.user);
          await resolveOwnership(s.user);
        }
      } catch (e) {
        console.error('Initial auth load failed', e);
      } finally {
        // ALWAYS mark ready — never get stuck on the skeleton
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ─── Auth state listener (runs once) ───────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_IN' && newSession?.user) {
        // Supabase re-emits SIGNED_IN on tab focus with the same user.
        // Only resolve ownership if this is a genuinely new user.
        if (resolvedUserId.current === newSession.user.id) {
          return; // same user, ignore — prevents reload cascade
        }
        setSession(newSession);
        setUser(newSession.user);
        await resolveOwnership(newSession.user);
        setReady(true);
      } else if (event === 'SIGNED_OUT') {
        resolvedUserId.current = null;
        setSession(null);
        setUser(null);
        setIsOwner(false);
        setIsOnboardingComplete(false);
        setReady(true);
      }
      // TOKEN_REFRESHED / USER_UPDATED — ignored entirely.
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─── Route guard ───────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;

    if (!user && pathname !== '/login') {
      router.push('/login');
    } else if (user && !isOwner && pathname !== '/login') {
      router.push('/login');
    } else if (user && isOwner) {
      if (!isOnboardingComplete && pathname !== '/onboarding' && pathname !== '/login') {
        router.push('/onboarding');
      } else if (isOnboardingComplete && (pathname === '/login' || pathname === '/onboarding')) {
        router.push('/dashboard');
      } else if (!isOnboardingComplete && pathname === '/login') {
        router.push('/onboarding');
      }
    }
  }, [ready, user, isOwner, isOnboardingComplete, pathname, router]);

  // ─── Actions ───────────────────────────────────────────────────────
  const signOut = async () => {
    resolvedUserId.current = null;
    setReady(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setIsOwner(false);
    setIsOnboardingComplete(false);
    router.push('/login');
  };

  const completeOnboarding = () => {
    setIsOnboardingComplete(true);
    router.push('/dashboard');
  };

  // ─── Render ────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="h-screen w-screen flex bg-slate-50">
        <div className="w-56 border-r border-slate-200 bg-white animate-pulse">
          <div className="h-14 px-5 flex items-center border-b border-slate-200">
            <div className="h-4 w-24 bg-slate-100 rounded" />
          </div>
          <div className="py-3 px-2.5 space-y-1">
            {[...Array(10)].map((_, i) => <div key={i} className="h-8 bg-slate-50 rounded-lg" />)}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="h-14 border-b border-slate-200 bg-white animate-pulse" />
          <div className="flex-1 p-8 animate-pulse space-y-5">
            <div className="h-4 w-32 bg-slate-100 rounded" />
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}
            </div>
            <div className="h-32 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!user && pathname !== '/login') return null;

  return (
    <AuthContext.Provider value={{ session, user, signOut, isLoading: false, isOwner, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

