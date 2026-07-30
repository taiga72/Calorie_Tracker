import { getSupabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import type { MealEntry, WeightEntry, Settings, Profile } from '@/types';

export interface CloudUser {
  id: string;
  email: string | undefined;
  avatarUrl: string | undefined;
}

export function toCloudUser(u: { id: string; email?: string; user_metadata?: { avatar_url?: string } } | null): CloudUser | null {
  if (!u) return null;
  return { id: u.id, email: u.email, avatarUrl: u.user_metadata?.avatar_url };
}

function mealRow(m: MealEntry, userId: string) {
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
    reasoning: m.reasoning ?? '',
    image_data: m.imageData ?? null,
    image_datas: m.imageDatas ?? null,
    client_created_at: m.createdAt,
  };
}

function rowToMeal(r: any): MealEntry {
  return {
    id: r.id,
    date: r.date,
    mealType: r.meal_type,
    items: r.items ?? [],
    calories: r.calories ?? 0,
    protein: r.protein ?? 0,
    carbs: r.carbs ?? 0,
    fat: r.fat ?? 0,
    fiber: r.fiber ?? 0,
    reasoning: r.reasoning ?? '',
    imageData: r.image_data ?? undefined,
    imageDatas: r.image_datas ?? undefined,
    createdAt: r.client_created_at ?? Date.parse(r.created_at),
  };
}

function weightRow(w: WeightEntry, userId: string) {
  return {
    user_id: userId,
    date: w.date,
    weight: w.weight,
    client_created_at: w.createdAt,
  };
}

function rowToWeight(r: any): WeightEntry {
  return {
    date: r.date,
    weight: r.weight,
    createdAt: r.client_created_at ?? Date.parse(r.created_at),
  };
}

export async function migrateLocalToCloud(userId: string): Promise<{ migrated: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { migrated: false, error: 'Cloud not configured.' };

  const localMeals = storage.getMeals();
  const localWeights = storage.getWeights();
  const localSettings = storage.getSettings();
  const localProfile = storage.getProfile();

  try {
    if (localMeals.length > 0) {
      const { error } = await supabase
        .from('meals')
        .upsert(localMeals.map((m) => mealRow(m, userId)), { onConflict: 'id' });
      if (error) throw error;
    }

    if (localWeights.length > 0) {
      const { error } = await supabase
        .from('weights')
        .upsert(localWeights.map((w) => weightRow(w, userId)), { onConflict: 'user_id,date' });
      if (error) throw error;
    }

    const { error: sErr } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, payload: localSettings, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (sErr) throw sErr;

    void localProfile;
    return { migrated: true };
  } catch (e) {
    return { migrated: false, error: e instanceof Error ? e.message : 'Migration failed.' };
  }
}

export async function pullCloudToLocal(userId: string): Promise<{ meals: MealEntry[]; weights: WeightEntry[]; settings: Settings; error?: string }> {
  const supabase = getSupabase();
  const fallbackSettings = storage.getSettings();
  if (!supabase) return { meals: [], weights: [], settings: fallbackSettings, error: 'Cloud not configured.' };

  try {
    const [{ data: meals, error: mErr }, { data: weights, error: wErr }, { data: settingsRow, error: sErr }] = await Promise.all([
      supabase.from('meals').select('*').eq('user_id', userId).order('client_created_at', { ascending: false }),
      supabase.from('weights').select('*').eq('user_id', userId).order('date', { ascending: true }),
      supabase.from('user_settings').select('payload').eq('user_id', userId).maybeSingle(),
    ]);

    if (mErr) throw mErr;
    if (wErr) throw wErr;
    if (sErr) throw sErr;

    const settings: Settings = settingsRow?.payload ? { ...fallbackSettings, ...settingsRow.payload } : fallbackSettings;

    return {
      meals: (meals ?? []).map(rowToMeal),
      weights: (weights ?? []).map(rowToWeight),
      settings,
    };
  } catch (e) {
    return { meals: [], weights: [], settings: fallbackSettings, error: e instanceof Error ? e.message : 'Pull failed.' };
  }
}

export async function upsertMeal(m: MealEntry, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('meals').upsert(mealRow(m, userId), { onConflict: 'id' });
  return !error;
}

export async function deleteMealCloud(id: string, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('meals').delete().eq('id', id).eq('user_id', userId);
  return !error;
}

export async function upsertWeight(w: WeightEntry, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('weights').upsert(weightRow(w, userId), { onConflict: 'user_id,date' });
  return !error;
}

export async function deleteWeightCloud(dateKey: string, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('weights').delete().eq('user_id', userId).eq('date', dateKey);
  return !error;
}

export async function upsertSettings(s: Settings, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, payload: s, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return !error;
}

export async function upsertProfile(p: Profile, _userId: string): Promise<boolean> {
  // Profile (name, avatar) is kept locally; optionally extend to a profile table later.
  void p;
  return true;
}
