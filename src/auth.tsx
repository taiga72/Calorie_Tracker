import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

interface AuthValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const LAST_USER_KEY = 'calorie_tracker_last_user';

function rememberUser(user: User | null) {
  try {
    if (user) localStorage.setItem(LAST_USER_KEY, JSON.stringify({ id: user.id, email: user.email }));
    else localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // ignore
  }
}

/**
 * Opening the app with no connection after the access token expired can't
 * refresh the session, so Supabase reports none — even though the user never
 * signed out. Falling back to the last signed-in user lets the app open from
 * its offline cache (and queue changes); Supabase restores the real session
 * by itself once the connection is back.
 */
function lastUserIfOffline(error: unknown): User | null {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (!offline && !isAuthRetryableFetchError(error)) return null;
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [offlineUser, setOfflineUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) rememberUser(data.session.user);
      else setOfflineUser(lastUserIfOffline(error));
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (newSession) {
        rememberUser(newSession.user);
        setOfflineUser(null);
      } else if (event === 'SIGNED_OUT') {
        rememberUser(null);
        setOfflineUser(null);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp: AuthValue['signUp'] = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  };

  const signIn: AuthValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const signOut: AuthValue['signOut'] = async () => {
    rememberUser(null);
    setOfflineUser(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? offlineUser, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
