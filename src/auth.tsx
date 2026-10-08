import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { deleteAllPhotos } from '@/lib/photoStorage';

/**
 * - pending: not confirmed yet, but this device's last user is shown from
 *   the offline cache so the app opens immediately
 * - verified: a real session — safe to sync
 * - offline: the session couldn't be refreshed for lack of a connection
 */
export type AuthStatus = 'pending' | 'verified' | 'offline';

interface AuthValue {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Emails a password-reset link that opens this app. */
  sendPasswordReset: (email: string) => Promise<string | null>;
  /** True after opening a password-reset link: the app asks for a new password. */
  recovering: boolean;
  updatePassword: (password: string) => Promise<string | null>;
  /** Supabase emails a confirmation link to the new address before it switches. */
  updateEmail: (email: string) => Promise<string | null>;
  /** Deletes the account and everything in it (needs supabase/schema.sql's delete_my_account). */
  deleteAccount: () => Promise<string | null>;
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

function readLastUser(): User | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

/**
 * Opening the app with no connection after the access token expired can't
 * refresh the session, so Supabase reports none — even though the user never
 * signed out. Supabase restores the real session by itself once the
 * connection is back.
 */
function isOfflineFailure(error: unknown): boolean {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return offline || isAuthRetryableFetchError(error);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Checking the session can mean a token refresh over the network — slow on
  // a weak connection. Meanwhile the last user on this device is assumed, so
  // the app opens from its cache right away (it won't sync until verified).
  const [provisionalUser, setProvisionalUser] = useState<User | null>(readLastUser);
  const [status, setStatus] = useState<AuthStatus>('pending');
  const [loading, setLoading] = useState(() => readLastUser() === null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) {
        rememberUser(data.session.user);
        setStatus('verified');
      } else if (isOfflineFailure(error) && readLastUser()) {
        setStatus('offline');
      } else {
        // Genuinely signed out (or the session was revoked): sign-in screen.
        setProvisionalUser(null);
      }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(newSession);
      if (newSession) {
        rememberUser(newSession.user);
        setProvisionalUser(null);
        setStatus('verified');
      } else if (event === 'SIGNED_OUT') {
        rememberUser(null);
        setProvisionalUser(null);
        setStatus('pending');
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
    setProvisionalUser(null);
    await supabase.auth.signOut();
  };

  const sendPasswordReset: AuthValue['sendPasswordReset'] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    return error?.message ?? null;
  };

  const updatePassword: AuthValue['updatePassword'] = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setRecovering(false);
    return error?.message ?? null;
  };

  const updateEmail: AuthValue['updateEmail'] = async (email) => {
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: window.location.origin });
    return error?.message ?? null;
  };

  const deleteAccount: AuthValue['deleteAccount'] = async () => {
    const userId = session?.user.id;
    if (!userId) return 'You need to be online and signed in to delete your account.';
    // Photos live in Storage, outside the tables the account deletion cascades to.
    await deleteAllPhotos(userId);
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      const missing = error.code === 'PGRST202' || error.code === '42883';
      return missing
        ? 'Account deletion isn\'t set up yet: re-run supabase/schema.sql in Supabase, then try again.'
        : error.message;
    }
    // Drop this account's caches (offline snapshot, queued changes, chat…).
    try {
      Object.keys(localStorage).filter((k) => k.includes(userId)).forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
    await signOut();
    return null;
  };

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? provisionalUser, status, loading, signUp, signIn, signOut,
      sendPasswordReset, recovering, updatePassword, updateEmail, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
