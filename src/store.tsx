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
  logWeight: (value: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  clearAll: () => void;
  importBackup: (payload: BackupPayload) => void;
  getDay: (dateKey: string) => DaySummary;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [meals, setMeals] = useState<MealEntry[]>(() => storage.getMeals());
  const [weights, setWeights] = useState<WeightEntry[]>(() => storage.getWeights());
  const [settings, setSettings] = useState<Settings>(() => storage.getSettings());

  useEffect(() => { storage.setMeals(meals); }, [meals]);
  useEffect(() => { storage.setWeights(weights); }, [weights]);
  useEffect(() => { storage.setSettings(settings); }, [settings]);

  const value = useMemo<StoreValue>(() => {
    const addMeal: StoreValue['addMeal'] = (m) => {
      setMeals((prev) => [...prev, { ...m, id: crypto.randomUUID(), createdAt: Date.now() }]);
    };

    const updateMeal: StoreValue['updateMeal'] = (id, patch) => {
      setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    };

    const deleteMeal: StoreValue['deleteMeal'] = (id) => {
      setMeals((prev) => prev.filter((m) => m.id !== id));
    };

    const logWeight: StoreValue['logWeight'] = (val) => {
      const kg = unitToKg(val, settings.weightUnit);
      const dateKey = toKey(new Date());
      setWeights((prev) => {
        const filtered = prev.filter((w) => w.date !== dateKey);
        return [...filtered, { date: dateKey, weight: kg, createdAt: Date.now() }];
      });
    };

    const updateSettings: StoreValue['updateSettings'] = (patch) => {
      setSettings((prev) => ({ ...prev, ...patch }));
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

    const getDay: StoreValue['getDay'] = (dateKey) => {
      const dayMeals = meals.filter((m) => m.date === dateKey);
      const weight = weights.find((w) => w.date === dateKey);
      return {
        date: dateKey,
        meals: dayMeals,
        weight,
        totalCalories: dayMeals.reduce((s, m) => s + m.calories, 0),
        totalProtein: dayMeals.reduce((s, m) => s + m.protein, 0),
        totalCarbs: dayMeals.reduce((s, m) => s + m.carbs, 0),
        totalFat: dayMeals.reduce((s, m) => s + m.fat, 0),
        totalFiber: dayMeals.reduce((s, m) => s + m.fiber, 0),
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
