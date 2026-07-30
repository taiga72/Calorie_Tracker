import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSupabase } from '@/lib/supabase';
import { migrateLocalToCloud, pullCloudToLocal, resync as resyncCloud, toCloudUser } from '@/lib/cloudSync';
import { storage } from '@/lib/storage';
import { useStore } from '@/store';

interface AuthValue {
  loading: boolean;
  migrating: boolean;
  migrationError: string | null;
  signOut: () => Promise<void>;
  resync: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setMeals, setWeights, setSettings, setAuthUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(toCloudUser(data.session?.user ?? null));
      setLoading(false);
    });

    // onAuthStateChange runs synchronously — wrap async work to avoid deadlock.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        const u = toCloudUser(session?.user ?? null);
        setAuthUser(u);

        if (event === 'SIGNED_IN' && u) {
          setMigrating(true);
          setMigrationError(null);
          // First-time sign-in: ensure profile, then push local data to cloud, then pull back.
          const mig = await migrateLocalToCloud(u.id, { email: u.email, avatarUrl: u.avatarUrl });
          // Clear the warning banner once the profile or initial data syncs successfully;
          // otherwise surface the specific failure.
          if (mig.profileReady) {
            setMigrationError(null);
          } else {
            setMigrationError(mig.error ?? 'Migration failed.');
          }
          if (mig.error && mig.profileReady) {
            // Profile synced but some items failed — keep a soft notice.
            setMigrationError(mig.error);
          }

          const pulled = await pullCloudToLocal(u.id);
          setMeals(pulled.meals);
          setWeights(pulled.weights);
          setSettings(pulled.settings);
          storage.setMeals(pulled.meals);
          storage.setWeights(pulled.weights);
          storage.setSettings(pulled.settings);
          setMigrating(false);
        }

        if (event === 'SIGNED_OUT') {
          setMigrationError(null);
        }
      })();
    });

    return () => { sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthUser(null);
  };

  const resync = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const u = toCloudUser(data.session?.user ?? null);
    if (!u) return;
    setMigrating(true);
    setMigrationError(null);
    const result = await resyncCloud(u.id, { email: u.email, avatarUrl: u.avatarUrl });
    setMeals(result.meals);
    setWeights(result.weights);
    setSettings(result.settings);
    storage.setMeals(result.meals);
    storage.setWeights(result.weights);
    storage.setSettings(result.settings);
    if (result.profileReady) {
      setMigrationError(result.error ?? null);
    } else {
      setMigrationError(result.error ?? 'Migration failed.');
    }
    setMigrating(false);
  }, [setMeals, setWeights, setSettings]);

  return (
    <AuthContext.Provider value={{ loading, migrating, migrationError, signOut, resync }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
