import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MealEntry, WeightEntry, Settings, DaySummary } from '@/types';
import { storage, type BackupPayload } from '@/lib/storage';
import { toKey } from '@/lib/dateUtils';
import { unitToKg } from '@/lib/units';

interface StoreValue {
  meals: MealEntry[];
  weights: WeightEntry[];
  settings: Settings;
  addMeal: (m: Omit<MealEntry, 'id' | 'createdAt'>) => void;
  updateMeal: (id: string, patch: Partial<Omit<MealEntry, 'id' | 'createdAt'>>) => void;
  deleteMeal: (id: string) => void;
  logWeight: (value: number) => void; // value in display unit
  updateSettings: (patch: Partial<Settings>) => void;
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

  useEffect(() => { storage.setMeals(meals); }, [meals]);
  useEffect(() => { storage.setWeights(weights); }, [weights]);
  useEffect(() => { storage.setSettings(settings); }, [settings]);

  const value = useMemo<StoreValue>(() => {
    const addMeal: StoreValue['addMeal'] = (m) => {
      const entry: MealEntry = { ...m, id: makeId(), createdAt: Date.now() };
      setMeals((prev) => [entry, ...prev]);
    };

    const deleteMeal: StoreValue['deleteMeal'] = (id) => {
      setMeals((prev) => prev.filter((m) => m.id !== id));
    };

    const updateMeal: StoreValue['updateMeal'] = (id, patch) => {
      setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    };

    const clearAll: StoreValue['clearAll'] = () => {
      storage.clearAll();
      setMeals([]);
      setWeights([]);
      setSettings(storage.getSettings());
    };

    const importBackup: StoreValue['importBackup'] = (payload) => {
      storage.importBackup(payload);
      setMeals(storage.getMeals());
      setWeights(storage.getWeights());
      setSettings(storage.getSettings());
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

    const updateSettings: StoreValue['updateSettings'] = (patch) => {
      setSettings((prev) => ({ ...prev, ...patch }));
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

    return { meals, weights, settings, addMeal, updateMeal, deleteMeal, logWeight, updateSettings, clearAll, importBackup, getDay };
  }, [meals, weights, settings]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
