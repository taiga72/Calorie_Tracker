import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MealEntry, WeightEntry, Settings, Profile, DaySummary } from '@/types';
import { storage, DEFAULT_SETTINGS, DEFAULT_PROFILE, type BackupPayload } from '@/lib/storage';
import { toKey } from '@/lib/dateUtils';
import { unitToKg } from '@/lib/units';
import { useAuth } from '@/auth';

interface StoreValue {
  meals: MealEntry[];
  weights: WeightEntry[];
  settings: Settings;
  profile: Profile;
  loading: boolean;
  addMeal: (m: Omit<MealEntry, 'id' | 'createdAt'>) => void;
  updateMeal: (id: string, patch: Partial<Omit<MealEntry, 'id' | 'createdAt'>>) => void;
  deleteMeal: (id: string) => void;
  logWeight: (value: number) => void; // value in display unit
  logWeightForDate: (value: number, dateKey: string) => void; // value in display unit
  deleteWeight: (dateKey: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  clearAll: () => void;
  importBackup: (payload: BackupPayload) => void;
  exportBackup: () => BackupPayload;
  getDay: (dateKey: string) => DaySummary;
}

const StoreContext = createContext<StoreValue | null>(null);

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  // StoreProvider is only mounted once a user is signed in (see App.tsx), but
  // guard against a transient render before that so hooks stay unconditional.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    Promise.all([
      storage.getMeals(userId),
      storage.getWeights(userId),
      storage.getSettings(userId),
      storage.getProfile(userId),
    ]).then(([m, w, s, p]) => {
      if (!active) return;
      setMeals(m);
      setWeights(w);
      setSettings(s);
      setProfile(p);
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  const value = useMemo<StoreValue>(() => {
    const addMeal: StoreValue['addMeal'] = (m) => {
      if (!userId) return;
      const entry: MealEntry = { ...m, id: makeId(), createdAt: Date.now() };
      setMeals((prev) => [entry, ...prev]);
      void storage.insertMeal(userId, entry);
    };

    const deleteMeal: StoreValue['deleteMeal'] = (id) => {
      if (!userId) return;
      setMeals((prev) => prev.filter((m) => m.id !== id));
      void storage.deleteMeal(userId, id);
    };

    const updateMeal: StoreValue['updateMeal'] = (id, patch) => {
      if (!userId) return;
      setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
      void storage.updateMeal(userId, id, patch);
    };

    const clearAll: StoreValue['clearAll'] = () => {
      if (!userId) return;
      setMeals([]);
      setWeights([]);
      setSettings(DEFAULT_SETTINGS);
      setProfile(DEFAULT_PROFILE);
      void storage.clearAll(userId);
    };

    const importBackup: StoreValue['importBackup'] = (payload) => {
      if (!userId) return;
      const nextSettings = { ...DEFAULT_SETTINGS, ...payload.settings };
      const nextProfile = { ...DEFAULT_PROFILE, ...payload.profile };
      setMeals(payload.meals ?? []);
      setWeights(payload.weights ?? []);
      setSettings(nextSettings);
      setProfile(nextProfile);
      void storage.importBackup(userId, payload);
    };

    const exportBackup: StoreValue['exportBackup'] = () => ({
      version: 1,
      exportedAt: new Date().toISOString(),
      meals,
      weights,
      settings,
      profile,
    });

    const logWeight: StoreValue['logWeight'] = (displayValue) => {
      if (!userId) return;
      const kg = unitToKg(displayValue, settings.weightUnit);
      const dateKey = toKey(new Date());
      const entry: WeightEntry = { date: dateKey, weight: kg, createdAt: Date.now() };
      setWeights((prev) => {
        const filtered = prev.filter((w) => w.date !== dateKey);
        return [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date));
      });
      void storage.upsertWeight(userId, entry);
    };

    const logWeightForDate: StoreValue['logWeightForDate'] = (displayValue, dateKey) => {
      if (!userId) return;
      const kg = unitToKg(displayValue, settings.weightUnit);
      const entry: WeightEntry = { date: dateKey, weight: kg, createdAt: Date.now() };
      setWeights((prev) => {
        const filtered = prev.filter((w) => w.date !== dateKey);
        return [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date));
      });
      void storage.upsertWeight(userId, entry);
    };

    const deleteWeight: StoreValue['deleteWeight'] = (dateKey) => {
      if (!userId) return;
      setWeights((prev) => prev.filter((w) => w.date !== dateKey));
      void storage.deleteWeight(userId, dateKey);
    };

    const updateSettings: StoreValue['updateSettings'] = (patch) => {
      if (!userId) return;
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        void storage.setSettings(userId, next);
        return next;
      });
    };

    const updateProfile: StoreValue['updateProfile'] = (patch) => {
      if (!userId) return;
      setProfile((prev) => {
        const next = { ...prev, ...patch };
        void storage.setProfile(userId, next);
        return next;
      });
    };

    const getDay: StoreValue['getDay'] = (dateKey) => {
      const dayMeals = meals.filter((m) => m.date === dateKey);
      const weight = weights.find((w) => w.date === dateKey);
      const sum = (sel: (m: MealEntry) => number) => dayMeals.reduce((a, b) => a + sel(b), 0);
      return {
        date: dateKey,
        meals: dayMeals,
        weight,
        totalCalories: sum((m) => m.calories),
        totalProtein: sum((m) => m.protein),
        totalCarbs: sum((m) => m.carbs),
        totalFat: sum((m) => m.fat),
        totalFiber: sum((m) => m.fiber),
      };
    };

    return {
      meals, weights, settings, profile, loading,
      addMeal, updateMeal, deleteMeal,
      logWeight, logWeightForDate, deleteWeight,
      updateSettings, updateProfile,
      clearAll, importBackup, exportBackup, getDay,
    };
  }, [meals, weights, settings, profile, loading, userId]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
