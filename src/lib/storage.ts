import type { MealEntry, WeightEntry, Settings, Profile } from '@/types';

const KEYS = {
  meals: 'calorie_tracker_meals',
  weights: 'cc_weights',
  settings: 'cc_settings',
  profile: 'cc_profile',
};

const LEGACY_MEALS_KEY = 'cc_meals';

const DEFAULT_SETTINGS: Settings = {
  calorieGoal: 2200,
  goalWeight: 75,
  weeklyWeightTarget: -0.3,
  weightUnit: 'kg',
  geminiApiKey: '',
};

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  meals: MealEntry[];
  weights: WeightEntry[];
  settings: Settings;
  profile?: Profile;
}

const DEFAULT_PROFILE: Profile = {
  name: '',
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
  getMeals: (): MealEntry[] => {
    const current = read<MealEntry[]>(KEYS.meals, []);
    if (current.length) return current;
    const legacy = read<MealEntry[]>(LEGACY_MEALS_KEY, []);
    if (legacy.length) {
      write(KEYS.meals, legacy);
      try { localStorage.removeItem(LEGACY_MEALS_KEY); } catch { /* ignore */ }
      return legacy;
    }
    return [];
  },
  setMeals: (m: MealEntry[]) => write(KEYS.meals, m),

  getWeights: (): WeightEntry[] => read<WeightEntry[]>(KEYS.weights, []),
  setWeights: (w: WeightEntry[]) => write(KEYS.weights, w),

  getSettings: (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEYS.settings, {}) }),
  setSettings: (s: Settings) => write(KEYS.settings, s),

  getProfile: (): Profile => ({ ...DEFAULT_PROFILE, ...read<Partial<Profile>>(KEYS.profile, {}) }),
  setProfile: (p: Profile) => write(KEYS.profile, p),

  exportBackup: (): BackupPayload => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    meals: read<MealEntry[]>(KEYS.meals, []),
    weights: read<WeightEntry[]>(KEYS.weights, []),
    settings: { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEYS.settings, {}) },
    profile: { ...DEFAULT_PROFILE, ...read<Partial<Profile>>(KEYS.profile, {}) },
  }),

  importBackup: (payload: BackupPayload) => {
    write(KEYS.meals, payload.meals ?? []);
    write(KEYS.weights, payload.weights ?? []);
    write(KEYS.settings, { ...DEFAULT_SETTINGS, ...payload.settings });
    write(KEYS.profile, { ...DEFAULT_PROFILE, ...payload.profile });
  },

  clearAll: () => {
    localStorage.removeItem(KEYS.meals);
    try { localStorage.removeItem(LEGACY_MEALS_KEY); } catch { /* ignore */ }
    localStorage.removeItem(KEYS.weights);
    localStorage.removeItem(KEYS.settings);
    localStorage.removeItem(KEYS.profile);
  },
};
