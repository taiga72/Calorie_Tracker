import { supabase } from '@/lib/supabaseClient';
import type { MealEntry, WeightEntry, Settings, Profile, MealType } from '@/types';

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

export const storage = {
  getMeals: async (userId: string): Promise<MealEntry[]> => {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load meals', error);
      return [];
    }
    return ((data as MealRow[] | null) ?? []).map(rowToMeal);
  },

  insertMeal: async (userId: string, meal: MealEntry): Promise<boolean> => {
    const { error } = await supabase.from('meals').insert(mealToRow(userId, meal));
    if (error) console.error('Failed to save meal', error);
    return !error;
  },

  updateMeal: async (userId: string, id: string, patch: Partial<Omit<MealEntry, 'id' | 'createdAt'>>): Promise<boolean> => {
    const { error } = await supabase.from('meals').update(mealPatchToRow(patch)).eq('user_id', userId).eq('id', id);
    if (error) console.error('Failed to update meal', error);
    return !error;
  },

  deleteMeal: async (userId: string, id: string): Promise<boolean> => {
    const { error } = await supabase.from('meals').delete().eq('user_id', userId).eq('id', id);
    if (error) console.error('Failed to delete meal', error);
    return !error;
  },

  getWeights: async (userId: string): Promise<WeightEntry[]> => {
    const { data, error } = await supabase
      .from('weights')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true });
    if (error) {
      console.error('Failed to load weights', error);
      return [];
    }
    return ((data as WeightRow[] | null) ?? []).map(rowToWeight);
  },

  upsertWeight: async (userId: string, entry: WeightEntry): Promise<boolean> => {
    const { error } = await supabase.from('weights').upsert(weightToRow(userId, entry), { onConflict: 'user_id,date' });
    if (error) console.error('Failed to save weight', error);
    return !error;
  },

  deleteWeight: async (userId: string, dateKey: string): Promise<boolean> => {
    const { error } = await supabase.from('weights').delete().eq('user_id', userId).eq('date', dateKey);
    if (error) console.error('Failed to delete weight', error);
    return !error;
  },

  getSettings: async (userId: string): Promise<Settings> => {
    const { data, error } = await supabase.from('settings').select('*').eq('user_id', userId).maybeSingle();
    if (error) {
      console.error('Failed to load settings', error);
      return DEFAULT_SETTINGS;
    }
    return rowToSettings(data as SettingsRow | null);
  },

  setSettings: async (userId: string, s: Settings): Promise<boolean> => {
    const { error } = await supabase.from('settings').upsert(settingsToRow(userId, s), { onConflict: 'user_id' });
    if (error) console.error('Failed to save settings', error);
    return !error;
  },

  getProfile: async (userId: string): Promise<Profile> => {
    const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error) {
      console.error('Failed to load profile', error);
      return DEFAULT_PROFILE;
    }
    return rowToProfile(data as ProfileRow | null);
  },

  setProfile: async (userId: string, p: Profile): Promise<boolean> => {
    const { error } = await supabase.from('profiles').upsert(profileToRow(userId, p), { onConflict: 'user_id' });
    if (error) console.error('Failed to save profile', error);
    return !error;
  },

  importBackup: async (userId: string, payload: BackupPayload): Promise<void> => {
    // Replace all of this user's rows with the backup's contents.
    await supabase.from('meals').delete().eq('user_id', userId);
    await supabase.from('weights').delete().eq('user_id', userId);
    if (payload.meals?.length) {
      const { error } = await supabase.from('meals').insert(payload.meals.map((m) => mealToRow(userId, m)));
      if (error) console.error('Failed to import meals', error);
    }
    if (payload.weights?.length) {
      const { error } = await supabase.from('weights').insert(payload.weights.map((w) => weightToRow(userId, w)));
      if (error) console.error('Failed to import weights', error);
    }
    await supabase.from('settings').upsert(
      settingsToRow(userId, { ...DEFAULT_SETTINGS, ...payload.settings }),
      { onConflict: 'user_id' }
    );
    await supabase.from('profiles').upsert(
      profileToRow(userId, { ...DEFAULT_PROFILE, ...payload.profile }),
      { onConflict: 'user_id' }
    );
  },

  clearAll: async (userId: string): Promise<void> => {
    await supabase.from('meals').delete().eq('user_id', userId);
    await supabase.from('weights').delete().eq('user_id', userId);
    await supabase.from('settings').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('user_id', userId);
  },
};
