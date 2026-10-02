import { supabase } from '@/lib/supabaseClient';
import type { MealEntry, WeightEntry, Settings, Profile, MealType, PinnedMeal } from '@/types';

export const DEFAULT_SETTINGS: Settings = {
  calorieGoal: 2200,
  goalWeight: 75,
  weeklyWeightTarget: -0.3,
  weightUnit: 'kg',
  geminiApiKey: '',
};

export const DEFAULT_PROFILE: Profile = {
  name: '',
};

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  meals: MealEntry[];
  weights: WeightEntry[];
  settings: Settings;
  profile?: Profile;
}

interface MealRow {
  id: string;
  date: string;
  meal_type: string;
  items: MealEntry['items'];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  reasoning: string | null;
  image_data: string | null;
  image_datas: string[] | null;
  created_at: number;
}

function rowToMeal(row: MealRow): MealEntry {
  return {
    id: row.id,
    date: row.date,
    mealType: row.meal_type as MealType,
    items: row.items ?? [],
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    reasoning: row.reasoning ?? '',
    imageData: row.image_data ?? undefined,
    imageDatas: row.image_datas ?? undefined,
    createdAt: row.created_at,
  };
}

function mealToRow(userId: string, m: MealEntry) {
  return {
    id: m.id,
    user_id: userId,
    date: m.date,
    meal_type: m.mealType,
    items: m.items,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    fiber: m.fiber,
    reasoning: m.reasoning,
    image_data: m.imageData ?? null,
    image_datas: m.imageDatas ?? null,
    created_at: m.createdAt,
  };
}

function mealPatchToRow(patch: Partial<Omit<MealEntry, 'id' | 'createdAt'>>) {
  const row: Record<string, unknown> = {};
  if (patch.date !== undefined) row.date = patch.date;
  if (patch.mealType !== undefined) row.meal_type = patch.mealType;
  if (patch.items !== undefined) row.items = patch.items;
  if (patch.calories !== undefined) row.calories = patch.calories;
  if (patch.protein !== undefined) row.protein = patch.protein;
  if (patch.carbs !== undefined) row.carbs = patch.carbs;
  if (patch.fat !== undefined) row.fat = patch.fat;
  if (patch.fiber !== undefined) row.fiber = patch.fiber;
  if (patch.reasoning !== undefined) row.reasoning = patch.reasoning;
  if (patch.imageData !== undefined) row.image_data = patch.imageData ?? null;
  if (patch.imageDatas !== undefined) row.image_datas = patch.imageDatas ?? null;
  return row;
}

interface WeightRow {
  date: string;
  weight: number;
  created_at: number;
}

function rowToWeight(row: WeightRow): WeightEntry {
  return { date: row.date, weight: row.weight, createdAt: row.created_at };
}

function weightToRow(userId: string, w: WeightEntry) {
  return { user_id: userId, date: w.date, weight: w.weight, created_at: w.createdAt };
}

interface SettingsRow {
  calorie_goal: number;
  goal_weight: number;
  weekly_weight_target: number;
  weight_unit: Settings['weightUnit'];
  gemini_api_key: string;
  calc: Settings['calc'];
}

function rowToSettings(row: SettingsRow | null): Settings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    calorieGoal: row.calorie_goal,
    goalWeight: row.goal_weight,
    weeklyWeightTarget: row.weekly_weight_target,
    weightUnit: row.weight_unit,
    geminiApiKey: row.gemini_api_key ?? '',
    calc: row.calc ?? null,
  };
}

function settingsToRow(userId: string, s: Settings) {
  return {
    user_id: userId,
    calorie_goal: s.calorieGoal,
    goal_weight: s.goalWeight,
    weekly_weight_target: s.weeklyWeightTarget,
    weight_unit: s.weightUnit,
    gemini_api_key: s.geminiApiKey,
    calc: s.calc ?? null,
  };
}

interface ProfileRow {
  name: string;
  avatar: string | null;
}

function rowToProfile(row: ProfileRow | null): Profile {
  if (!row) return DEFAULT_PROFILE;
  return { name: row.name ?? '', avatar: row.avatar ?? undefined };
}

function profileToRow(userId: string, p: Profile) {
  return { user_id: userId, name: p.name, avatar: p.avatar ?? null };
}

interface PinnedRow {
  id: string;
  name: string;
  meal_type: string;
  items: PinnedMeal['items'];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  created_at: number;
}

function rowToPinned(row: PinnedRow): PinnedMeal {
  return {
    id: row.id,
    name: row.name,
    mealType: row.meal_type as MealType,
    items: row.items ?? [],
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    createdAt: row.created_at,
  };
}

function pinnedToRow(userId: string, p: PinnedMeal) {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    meal_type: p.mealType,
    items: p.items,
    calories: p.calories,
    protein: p.protein,
    carbs: p.carbs,
    fat: p.fat,
    fiber: p.fiber,
    created_at: p.createdAt,
  };
}

// The pinned_meals table was added after launch. Until the updated
// supabase/schema.sql has been run, pins stay on this device instead of
// failing every load and save.
function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === 'PGRST205' || code === '42P01';
}

// Every Supabase call here is a single shot over the network with no
// built-in retry, so a brief mobile connectivity blip (switching between
// wifi/cellular, waking from sleep) fails the whole request outright. A
// short retry-with-backoff absorbs most of those transient failures instead
// of surfacing a load/save failure that a user can't do anything about.
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withRetry<T extends { error: unknown }>(fn: () => PromiseLike<T>): Promise<T> {
  let result = await fn();
  for (let attempt = 1; attempt < RETRY_ATTEMPTS && result.error; attempt++) {
    await sleep(RETRY_DELAY_MS * attempt);
    result = await fn();
  }
  return result;
}

// Meal rows can carry full-size base64 photos, so a backup's full meal list
// can add up to tens of MB — far past what a single insert request survives
// (gateway/network limits reject it outright, failing the whole import).
// Splitting into byte-bounded batches keeps each request small regardless of
// how many oversized photos happen to land in the same backup.
const MAX_IMPORT_BATCH_BYTES = 3_000_000;

function batchRowsBySize<T>(rows: T[], maxBytes: number): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;
  for (const row of rows) {
    const bytes = JSON.stringify(row).length;
    if (current.length > 0 && currentBytes + bytes > maxBytes) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(row);
    currentBytes += bytes;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export const storage = {
  getMeals: async (userId: string): Promise<MealEntry[]> => {
    const { data, error } = await withRetry(() =>
      supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    );
    if (error) {
      console.error('Failed to load meals', error);
      throw error;
    }
    return ((data as MealRow[] | null) ?? []).map(rowToMeal);
  },

  insertMeal: async (userId: string, meal: MealEntry): Promise<boolean> => {
    // An upsert, so replaying a queued insert that already landed (the
    // response was lost when the connection dropped) doesn't fail.
    const { error } = await withRetry(() =>
      supabase.from('meals').upsert(mealToRow(userId, meal), { onConflict: 'id' })
    );
    if (error) console.error('Failed to save meal', error);
    return !error;
  },

  updateMeal: async (userId: string, id: string, patch: Partial<Omit<MealEntry, 'id' | 'createdAt'>>): Promise<boolean> => {
    const { error } = await withRetry(() =>
      supabase.from('meals').update(mealPatchToRow(patch)).eq('user_id', userId).eq('id', id)
    );
    if (error) console.error('Failed to update meal', error);
    return !error;
  },

  deleteMeal: async (userId: string, id: string): Promise<boolean> => {
    const { error } = await withRetry(() => supabase.from('meals').delete().eq('user_id', userId).eq('id', id));
    if (error) console.error('Failed to delete meal', error);
    return !error;
  },

  getWeights: async (userId: string): Promise<WeightEntry[]> => {
    const { data, error } = await withRetry(() =>
      supabase
        .from('weights')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true })
    );
    if (error) {
      console.error('Failed to load weights', error);
      throw error;
    }
    return ((data as WeightRow[] | null) ?? []).map(rowToWeight);
  },

  upsertWeight: async (userId: string, entry: WeightEntry): Promise<boolean> => {
    const { error } = await withRetry(() =>
      supabase.from('weights').upsert(weightToRow(userId, entry), { onConflict: 'user_id,date' })
    );
    if (error) console.error('Failed to save weight', error);
    return !error;
  },

  deleteWeight: async (userId: string, dateKey: string): Promise<boolean> => {
    const { error } = await withRetry(() => supabase.from('weights').delete().eq('user_id', userId).eq('date', dateKey));
    if (error) console.error('Failed to delete weight', error);
    return !error;
  },

  getSettings: async (userId: string): Promise<Settings> => {
    const { data, error } = await withRetry(() => supabase.from('settings').select('*').eq('user_id', userId).maybeSingle());
    if (error) {
      console.error('Failed to load settings', error);
      throw error;
    }
    return rowToSettings(data as SettingsRow | null);
  },

  setSettings: async (userId: string, s: Settings): Promise<boolean> => {
    const { error } = await withRetry(() =>
      supabase.from('settings').upsert(settingsToRow(userId, s), { onConflict: 'user_id' })
    );
    if (error) console.error('Failed to save settings', error);
    return !error;
  },

  getProfile: async (userId: string): Promise<Profile> => {
    const { data, error } = await withRetry(() => supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle());
    if (error) {
      console.error('Failed to load profile', error);
      throw error;
    }
    return rowToProfile(data as ProfileRow | null);
  },

  setProfile: async (userId: string, p: Profile): Promise<boolean> => {
    const { error } = await withRetry(() =>
      supabase.from('profiles').upsert(profileToRow(userId, p), { onConflict: 'user_id' })
    );
    if (error) console.error('Failed to save profile', error);
    return !error;
  },

  /** Returns null when the pinned_meals table hasn't been created yet. */
  getPinnedMeals: async (userId: string): Promise<PinnedMeal[] | null> => {
    const { data, error } = await withRetry(() =>
      supabase
        .from('pinned_meals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    );
    if (error) {
      if (isMissingTable(error)) return null;
      console.error('Failed to load pinned meals', error);
      throw error;
    }
    return ((data as PinnedRow[] | null) ?? []).map(rowToPinned);
  },

  upsertPinnedMeal: async (userId: string, pin: PinnedMeal): Promise<boolean> => {
    const { error } = await withRetry(() =>
      supabase.from('pinned_meals').upsert(pinnedToRow(userId, pin), { onConflict: 'id' })
    );
    if (error && !isMissingTable(error)) console.error('Failed to save pinned meal', error);
    return !error || isMissingTable(error);
  },

  deletePinnedMeal: async (userId: string, id: string): Promise<boolean> => {
    const { error } = await withRetry(() => supabase.from('pinned_meals').delete().eq('user_id', userId).eq('id', id));
    if (error && !isMissingTable(error)) console.error('Failed to delete pinned meal', error);
    return !error || isMissingTable(error);
  },

  importBackup: async (userId: string, payload: BackupPayload): Promise<boolean> => {
    // Replace all of this user's rows with the backup's contents.
    let ok = true;
    const del1 = await withRetry(() => supabase.from('meals').delete().eq('user_id', userId));
    if (del1.error) { console.error('Failed to clear meals before import', del1.error); ok = false; }
    const del2 = await withRetry(() => supabase.from('weights').delete().eq('user_id', userId));
    if (del2.error) { console.error('Failed to clear weights before import', del2.error); ok = false; }
    if (payload.meals?.length) {
      const rows = payload.meals.map((m) => mealToRow(userId, m));
      for (const batch of batchRowsBySize(rows, MAX_IMPORT_BATCH_BYTES)) {
        const { error } = await withRetry(() => supabase.from('meals').insert(batch));
        if (error) { console.error('Failed to import meals', error); ok = false; }
      }
    }
    if (payload.weights?.length) {
      const rows = payload.weights.map((w) => weightToRow(userId, w));
      for (const batch of batchRowsBySize(rows, MAX_IMPORT_BATCH_BYTES)) {
        const { error } = await withRetry(() => supabase.from('weights').insert(batch));
        if (error) { console.error('Failed to import weights', error); ok = false; }
      }
    }
    const s = await withRetry(() =>
      supabase.from('settings').upsert(
        settingsToRow(userId, { ...DEFAULT_SETTINGS, ...payload.settings }),
        { onConflict: 'user_id' }
      )
    );
    if (s.error) { console.error('Failed to import settings', s.error); ok = false; }
    const p = await withRetry(() =>
      supabase.from('profiles').upsert(
        profileToRow(userId, { ...DEFAULT_PROFILE, ...payload.profile }),
        { onConflict: 'user_id' }
      )
    );
    if (p.error) { console.error('Failed to import profile', p.error); ok = false; }
    return ok;
  },

  clearAll: async (userId: string): Promise<boolean> => {
    let ok = true;
    const r1 = await withRetry(() => supabase.from('meals').delete().eq('user_id', userId));
    if (r1.error) { console.error('Failed to clear meals', r1.error); ok = false; }
    const r2 = await withRetry(() => supabase.from('weights').delete().eq('user_id', userId));
    if (r2.error) { console.error('Failed to clear weights', r2.error); ok = false; }
    const r3 = await withRetry(() => supabase.from('settings').delete().eq('user_id', userId));
    if (r3.error) { console.error('Failed to clear settings', r3.error); ok = false; }
    const r4 = await withRetry(() => supabase.from('profiles').delete().eq('user_id', userId));
    if (r4.error) { console.error('Failed to clear profile', r4.error); ok = false; }
    const r5 = await withRetry(() => supabase.from('pinned_meals').delete().eq('user_id', userId));
    if (r5.error && !isMissingTable(r5.error)) { console.error('Failed to clear pinned meals', r5.error); ok = false; }
    return ok;
  },
};
