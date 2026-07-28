'use client';

import React, { createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/platform/supabase/client';
import { signOut as serverSignOut } from '@/app/actions/auth';

interface SessionUser {
  id: string;
  email: string;
}

interface SessionContextType {
  user: SessionUser;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function useSession(): SessionContextType {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}

interface SessionProviderProps {
  user: SessionUser;
  children: React.ReactNode;
}

/**
 * Thin client context that holds the authenticated user for display purposes
 * (email in Sidebar, user id for query keys).
 *
 * This context has NO auth decision-making logic. Authentication and
 * authorization are handled entirely by the middleware. This provider only
 * exists so client components can read the user that the server already
 * confirmed is authenticated.
 */
export function SessionProvider({ user, children }: SessionProviderProps) {
  const router = useRouter();

  const signOut = async () => {
    await serverSignOut();
    // Clear the browser-side Supabase state after the server cookie is cleared.
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <SessionContext.Provider value={{ user, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}
