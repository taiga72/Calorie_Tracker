import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MealEntry, WeightEntry, Settings, Profile, DaySummary } from '@/types';
import { storage, type BackupPayload } from '@/lib/storage';
import { toKey } from '@/lib/dateUtils';
import { unitToKg } from '@/lib/units';
import { upsertMeal, deleteMealCloud, upsertWeight, deleteWeightCloud, upsertSettings, upsertProfile, type CloudUser } from '@/lib/cloudSync';

interface StoreValue {
  meals: MealEntry[];
  weights: WeightEntry[];
  settings: Settings;
  profile: Profile;
  authUser: CloudUser | null;
  setAuthUser: (u: CloudUser | null) => void;
  setMeals: (m: MealEntry[]) => void;
  setWeights: (w: WeightEntry[]) => void;
  setSettings: (s: Settings) => void;
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
  getDay: (dateKey: string) => DaySummary;
}

const StoreContext = createContext<StoreValue | null>(null);

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [meals, setMeals] = useState<MealEntry[]>(() => storage.getMeals());
  const [weights, setWeights] = useState<WeightEntry[]>(() => storage.getWeights());
  const [settings, setSettings] = useState<Settings>(() => storage.getSettings());
  const [profile, setProfile] = useState<Profile>(() => storage.getProfile());
  const [authUser, setAuthUser] = useState<CloudUser | null>(null);

  // Keep a ref to the latest auth user so sync callbacks read current value.
  const authRef = useRef<CloudUser | null>(null);
  useEffect(() => { authRef.current = authUser; }, [authUser]);

  useEffect(() => { storage.setMeals(meals); }, [meals]);
  useEffect(() => { storage.setWeights(weights); }, [weights]);
  useEffect(() => { storage.setSettings(settings); }, [settings]);
  useEffect(() => { storage.setProfile(profile); }, [profile]);

  const value = useMemo<StoreValue>(() => {
    const addMeal: StoreValue['addMeal'] = (m) => {
      const entry: MealEntry = { ...m, id: makeId(), createdAt: Date.now() };
      setMeals((prev) => [entry, ...prev]);
      const u = authRef.current;
      if (u) void upsertMeal(entry, u.id);
    };

    const deleteMeal: StoreValue['deleteMeal'] = (id) => {
      setMeals((prev) => prev.filter((m) => m.id !== id));
      const u = authRef.current;
      if (u) void deleteMealCloud(id, u.id);
    };

    const updateMeal: StoreValue['updateMeal'] = (id, patch) => {
      let updated: MealEntry | null = null;
      setMeals((prev) => prev.map((m) => {
        if (m.id === id) { updated = { ...m, ...patch }; return updated; }
        return m;
      }));
      const u = authRef.current;
      if (u && updated) void upsertMeal(updated, u.id);
    };

    const clearAll: StoreValue['clearAll'] = () => {
      storage.clearAll();
      setMeals([]);
      setWeights([]);
      setSettings(storage.getSettings());
      setProfile(storage.getProfile());
    };

    const importBackup: StoreValue['importBackup'] = (payload) => {
      storage.importBackup(payload);
      setMeals(storage.getMeals());
      setWeights(storage.getWeights());
      setSettings(storage.getSettings());
      setProfile(storage.getProfile());
    };

    const logWeight: StoreValue['logWeight'] = (displayValue) => {
      const kg = unitToKg(displayValue, settings.weightUnit);
      const dateKey = toKey(new Date());
      const entry: WeightEntry = { date: dateKey, weight: kg, createdAt: Date.now() };
      setWeights((prev) => {
        const filtered = prev.filter((w) => w.date !== dateKey);
        return [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date));
      });
      const u = authRef.current;
      if (u) void upsertWeight(entry, u.id);
    };

    const logWeightForDate: StoreValue['logWeightForDate'] = (displayValue, dateKey) => {
      const kg = unitToKg(displayValue, settings.weightUnit);
      const entry: WeightEntry = { date: dateKey, weight: kg, createdAt: Date.now() };
      setWeights((prev) => {
        const filtered = prev.filter((w) => w.date !== dateKey);
        return [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date));
      });
      const u = authRef.current;
      if (u) void upsertWeight(entry, u.id);
    };

    const deleteWeight: StoreValue['deleteWeight'] = (dateKey) => {
      setWeights((prev) => prev.filter((w) => w.date !== dateKey));
      const u = authRef.current;
      if (u) void deleteWeightCloud(dateKey, u.id);
    };

    const updateSettings: StoreValue['updateSettings'] = (patch) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        const u = authRef.current;
        if (u) void upsertSettings(next, u.id);
        return next;
      });
    };

    const updateProfile: StoreValue['updateProfile'] = (patch) => {
      setProfile((prev) => {
        const next = { ...prev, ...patch };
        const u = authRef.current;
        if (u) void upsertProfile(next, u.id);
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

    return { meals, weights, settings, profile, authUser, setAuthUser, setMeals, setWeights, setSettings, addMeal, updateMeal, deleteMeal, logWeight, logWeightForDate, deleteWeight, updateSettings, updateProfile, clearAll, importBackup, getDay };
  }, [meals, weights, settings, profile, authUser]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
