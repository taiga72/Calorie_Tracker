import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MealEntry, WeightEntry, Settings, Profile, DaySummary } from '@/types';
import { storage, type BackupPayload } from '@/lib/storage';
import { toKey } from '@/lib/dateUtils';
import { unitToKg } from '@/lib/units';

const MEALS_KEY = 'calorie_tracker_meals';
function persistMeals(m: MealEntry[]) {
  try { localStorage.setItem(MEALS_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

interface StoreValue {
  meals: MealEntry[];
  weights: WeightEntry[];
  settings: Settings;
  profile: Profile;
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

  useEffect(() => { storage.setMeals(meals); }, [meals]);
  // No background cloud sync or remote fetch — meals are local-only. The effect
  // above mirrors localStorage so storage stays in sync; meal actions also write
  // directly via persistMeals() for instant persistence.
  useEffect(() => { storage.setWeights(weights); }, [weights]);
  useEffect(() => { storage.setSettings(settings); }, [settings]);
  useEffect(() => { storage.setProfile(profile); }, [profile]);

  const value = useMemo<StoreValue>(() => {
    const addMeal: StoreValue['addMeal'] = (m) => {
      const entry: MealEntry = { ...m, id: makeId(), createdAt: Date.now() };
      setMeals((prev) => {
        const next = [entry, ...prev];
        persistMeals(next);
        return next;
      });
    };

    const deleteMeal: StoreValue['deleteMeal'] = (id) => {
      setMeals((prev) => {
        const next = prev.filter((m) => m.id !== id);
        persistMeals(next);
        return next;
      });
    };

    const updateMeal: StoreValue['updateMeal'] = (id, patch) => {
      setMeals((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
        persistMeals(next);
        return next;
      });
    };

    const clearAll: StoreValue['clearAll'] = () => {
      storage.clearAll();
      setMeals([]);
      try { localStorage.removeItem(MEALS_KEY); } catch { /* ignore */ }
      setWeights([]);
      setSettings(storage.getSettings());
      setProfile(storage.getProfile());
    };

    const importBackup: StoreValue['importBackup'] = (payload) => {
      storage.importBackup(payload);
      const restored = storage.getMeals();
      persistMeals(restored);
      setMeals(restored);
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
    };

    const logWeightForDate: StoreValue['logWeightForDate'] = (displayValue, dateKey) => {
      const kg = unitToKg(displayValue, settings.weightUnit);
      const entry: WeightEntry = { date: dateKey, weight: kg, createdAt: Date.now() };
      setWeights((prev) => {
        const filtered = prev.filter((w) => w.date !== dateKey);
        return [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date));
      });
    };

    const deleteWeight: StoreValue['deleteWeight'] = (dateKey) => {
      setWeights((prev) => prev.filter((w) => w.date !== dateKey));
    };

    const updateSettings: StoreValue['updateSettings'] = (patch) => {
      setSettings((prev) => ({ ...prev, ...patch }));
    };

    const updateProfile: StoreValue['updateProfile'] = (patch) => {
      setProfile((prev) => ({ ...prev, ...patch }));
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

    return { meals, weights, settings, profile, addMeal, updateMeal, deleteMeal, logWeight, logWeightForDate, deleteWeight, updateSettings, updateProfile, clearAll, importBackup, getDay };
  }, [meals, weights, settings, profile]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
