import type { MealEntry, WeightEntry, Settings, Profile } from '@/types';

const KEYS = {
  meals: 'calorie_tracker_meals',
  weights: 'calorie_tracker_weights',
  settings: 'cc_settings',
  profile: 'cc_profile',
};

// Older builds stored meals/weights under these keys; migrate on read so
// switching to the new key names doesn't silently drop existing data.
const LEGACY_KEYS = {
  meals: 'cc_meals',
  weights: 'cc_weights',
};

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

function readWithLegacyMigration<T>(key: string, legacyKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
  // Nothing under the new key yet — check the legacy key once and migrate.
  try {
    const legacyRaw = localStorage.getItem(legacyKey);
    if (!legacyRaw) return fallback;
    const migrated = JSON.parse(legacyRaw) as T;
    localStorage.setItem(key, legacyRaw);
    return migrated;
  } catch {
    return fallback;
  }
}

export const storage = {
  getMeals: (): MealEntry[] => readWithLegacyMigration<MealEntry[]>(KEYS.meals, LEGACY_KEYS.meals, []),
  setMeals: (m: MealEntry[]) => write(KEYS.meals, m),

  getWeights: (): WeightEntry[] => readWithLegacyMigration<WeightEntry[]>(KEYS.weights, LEGACY_KEYS.weights, []),
  setWeights: (w: WeightEntry[]) => write(KEYS.weights, w),

  getSettings: (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(KEYS.settings, {}) }),
  setSettings: (s: Settings) => write(KEYS.settings, s),

  getProfile: (): Profile => ({ ...DEFAULT_PROFILE, ...read<Partial<Profile>>(KEYS.profile, {}) }),
  setProfile: (p: Profile) => write(KEYS.profile, p),

  exportBackup: (): BackupPayload => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    meals: readWithLegacyMigration<MealEntry[]>(KEYS.meals, LEGACY_KEYS.meals, []),
    weights: readWithLegacyMigration<WeightEntry[]>(KEYS.weights, LEGACY_KEYS.weights, []),
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
    localStorage.removeItem(KEYS.weights);
    localStorage.removeItem(KEYS.settings);
    localStorage.removeItem(KEYS.profile);
    localStorage.removeItem(LEGACY_KEYS.meals);
    localStorage.removeItem(LEGACY_KEYS.weights);
  },
};
