import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSupabase } from '@/lib/supabase';
import { migrateLocalToCloud, pullCloudToLocal, pullProfile, ensureProfile, resync as resyncCloud, toCloudUser } from '@/lib/cloudSync';
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

// Push local profile + settings UP to cloud (used when cloud is empty but local has data).
async function pushLocalProfileUp(userId: string, email?: string, avatarUrl?: string): Promise<boolean> {
  const localProfile = storage.getProfile();
  const localSettings = storage.getSettings();
  return ensureProfile(userId, localProfile, localSettings, email, avatarUrl);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setMeals, setWeights, setSettings, setProfile, setAuthUser } = useStore();
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

          // Bidirectional profile & settings sync:
          // 1. Check if the cloud profile already has a name / calorie goal.
          const cloudProfile = await pullProfile(u.id);

          if (cloudProfile?.hasData) {
            // Cloud has valid profile + goals -> hydrate local Zustand state.
            const localSettings = storage.getSettings();
            const merged = { ...localSettings };
            if (cloudProfile.calorieGoal != null) merged.calorieGoal = cloudProfile.calorieGoal;
            if (cloudProfile.goalWeight != null) merged.goalWeight = cloudProfile.goalWeight;
            if (cloudProfile.weeklyWeightTarget != null) merged.weeklyWeightTarget = cloudProfile.weeklyWeightTarget;
            if (cloudProfile.weightUnit) merged.weightUnit = cloudProfile.weightUnit as typeof merged.weightUnit;
            if (cloudProfile.calcPayload) merged.calc = cloudProfile.calcPayload;
            setSettings(merged);
            storage.setSettings(merged);
            setProfile({ name: cloudProfile.name, avatar: cloudProfile.avatarUrl });
            storage.setProfile({ name: cloudProfile.name, avatar: cloudProfile.avatarUrl });
          } else {
            // Cloud profile is empty -> push local profile + settings UP.
            const localProfile = storage.getProfile();
            const localSettings = storage.getSettings();
            const hasLocalData = !!(localProfile.name || localSettings.calorieGoal);
            if (hasLocalData) {
              await pushLocalProfileUp(u.id, u.email, u.avatarUrl);
            }
          }

          // 2. Migrate meals/weights/settings (idempotent) then pull everything back.
          const mig = await migrateLocalToCloud(u.id, { email: u.email, avatarUrl: u.avatarUrl });
          if (mig.profileReady) {
            setMigrationError(null);
          } else {
            setMigrationError(mig.error ?? 'Migration failed.');
          }
          if (mig.error && mig.profileReady) {
            setMigrationError(mig.error);
          }

          // 3. Pull cloud state back so meals, weights, settings AND profile all hydrate.
          const pulled = await pullCloudToLocal(u.id);
          setMeals(pulled.meals);
          setWeights(pulled.weights);
          setSettings(pulled.settings);
          setProfile(pulled.profile);
          storage.setMeals(pulled.meals);
          storage.setWeights(pulled.weights);
          storage.setSettings(pulled.settings);
          storage.setProfile(pulled.profile);
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
    setProfile(result.profile);
    storage.setMeals(result.meals);
    storage.setWeights(result.weights);
    storage.setSettings(result.settings);
    storage.setProfile(result.profile);
    if (result.profileReady) {
      setMigrationError(result.error ?? null);
    } else {
      setMigrationError(result.error ?? 'Migration failed.');
    }
    setMigrating(false);
  }, [setMeals, setWeights, setSettings, setProfile]);

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
