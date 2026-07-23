import type { MealEntry, WeightEntry, Settings } from '@/types';

const KEYS = {
  meals: 'cc_meals',
  weights: 'cc_weights',
  settings: 'cc_settings',
};

const DEFAULT_SETTINGS: Settings = {
  calorieGoal: 2200,
  goalWeight: 75,
  weeklyWeightTarget: -0.3,
  weightUnit: 'kg',
  geminiApiKey: '',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('localStorage write failed', err);
  }
}

export const storage = {
  getMeals: (): MealEntry[] => read<MealEntry[]>(KEYS.meals, []),
  setMeals: (m: MealEntry[]) => write(KEYS.meals, m),

  getWeights: (): WeightEntry[] => read<WeightEntry[]>(KEYS.weights, []),
  setWeights: (w: WeightEntry[]) => write(KEYS.weights, w),

  getSettings: (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEYS.settings, {}) }),
  setSettings: (s: Settings) => write(KEYS.settings, s),
};
