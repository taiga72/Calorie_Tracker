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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toUuid(id: string | undefined): string {
  if (id && UUID_RE.test(id)) return id;
  return crypto.randomUUID();
}

function mealRow(m: MealEntry, userId: string) {
  return {
    id: toUuid(m.id),
    user_id: userId,
    date: m.date,
    meal_type: m.mealType,
    items: m.items ?? [],
    calories: m.calories || 0,
    protein: m.protein || 0,
    carbs: m.carbs || 0,
    fat: m.fat || 0,
    fiber: m.fiber || 0,
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

export async function ensureProfile(userId: string, profile: Profile, email?: string, avatarUrl?: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { user_id: userId, name: profile.name ?? '', email: email ?? null, avatar_url: avatarUrl ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) console.error('profiles upsert failed:', error.message);
  return !error;
}

export async function migrateLocalToCloud(
  userId: string,
  profile?: { email?: string; avatarUrl?: string },
): Promise<{ migrated: boolean; error?: string; profileReady: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { migrated: false, error: 'Cloud not configured.', profileReady: false };

  const localMeals = storage.getMeals();
  const localWeights = storage.getWeights();
  const localSettings = storage.getSettings();
  const localProfile = storage.getProfile();

  // Step 1: ensure a profile row exists before touching dependent tables.
  let profileReady = false;
  try {
    profileReady = await ensureProfile(userId, localProfile, profile?.email, profile?.avatarUrl);
  } catch (err) {
    console.error('profiles migration failed:', err);
  }
  if (!profileReady) {
    // Without a parent profile we still attempt the rest best-effort, but surface the error.
    return { migrated: false, error: 'Could not create account profile.', profileReady: false };
  }

  // Step 2: meals — migrate each individually so one failure never halts the rest.
  let mealsOk = 0;
  let mealsFailed = 0;
  for (const m of localMeals) {
    try {
      const { error } = await supabase.from('meals').upsert(mealRow(m, userId), { onConflict: 'id' });
      if (error) {
        console.error('Sync error:', error.message);
        throw error;
      }
      mealsOk += 1;
    } catch (err) {
      mealsFailed += 1;
      console.error('Sync error: meal failed to migrate', err);
    }
  }

  // Step 3: weights — same per-row resilience.
  let weightsOk = 0;
  let weightsFailed = 0;
  for (const w of localWeights) {
    try {
      const { error } = await supabase.from('weights').upsert(weightRow(w, userId), { onConflict: 'user_id,date' });
      if (error) throw error;
      weightsOk += 1;
    } catch (err) {
      weightsFailed += 1;
      console.error(err);
    }
  }

  // Step 4: settings.
  let settingsOk = false;
  try {
    const { error: sErr } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, payload: localSettings, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (sErr) throw sErr;
    settingsOk = true;
  } catch (err) {
    console.error('settings migration failed:', err);
  }

  const totalFailed = mealsFailed + weightsFailed;
  const anyDataSynced = profileReady && (localMeals.length === 0 || mealsOk > 0) && (localWeights.length === 0 || weightsOk > 0);

  if (totalFailed > 0) {
    return {
      migrated: anyDataSynced,
      error: `${totalFailed} item(s) could not be synced.`,
      profileReady,
    };
  }
  if (!settingsOk) {
    return { migrated: true, error: 'Settings could not be synced.', profileReady };
  }
  return { migrated: true, profileReady };
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
  if (error) console.error('Sync error:', error.message);
  return !error;
}

export async function deleteMealCloud(id: string, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('meals').delete().eq('id', toUuid(id)).eq('user_id', userId);
  if (error) console.error('Sync error:', error.message);
  return !error;
}

export async function upsertWeight(w: WeightEntry, userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('weights').upsert(weightRow(w, userId), { onConflict: 'user_id,date' });
  if (error) console.error('Sync error:', error.message);
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
  if (error) console.error('Sync error:', error.message);
  return !error;
}

export async function upsertProfile(p: Profile, userId: string): Promise<boolean> {
  return ensureProfile(userId, p);
}

export interface ResyncResult {
  ok: boolean;
  meals: MealEntry[];
  weights: WeightEntry[];
  settings: Settings;
  error?: string;
  profileReady: boolean;
}

// On-demand re-sync: re-ensure profile, re-push local data, then pull cloud state back.
export async function resync(userId: string, profile?: { email?: string; avatarUrl?: string }): Promise<ResyncResult> {
  const mig = await migrateLocalToCloud(userId, profile);
  const pulled = await pullCloudToLocal(userId);
  return {
    ok: mig.migrated && !pulled.error,
    meals: pulled.meals,
    weights: pulled.weights,
    settings: pulled.settings,
    error: mig.error ?? pulled.error,
    profileReady: mig.profileReady,
  };
}
