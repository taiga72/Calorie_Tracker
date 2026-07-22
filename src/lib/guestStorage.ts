import type { Profile, MealEntry, WeightLog, MealType, FoodItem } from '@/types';

const GUEST_KEY = 'macroflow-guest-data';

interface GuestData {
  profile: Profile;
  meals: MealEntry[];
  weights: WeightLog[];
}

function loadGuestData(): GuestData | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuestData;
  } catch {
    return null;
  }
}

function saveGuestData(data: GuestData) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(data));
}

export function getGuestProfile(): Profile | null {
  const data = loadGuestData();
  return data?.profile || null;
}

export function getGuestMeals(): MealEntry[] {
  return loadGuestData()?.meals || [];
}

export function getGuestWeights(): WeightLog[] {
  return loadGuestData()?.weights || [];
}

function ensureGuestData(): GuestData {
  const existing = loadGuestData();
  if (existing) return existing;
  const now = new Date().toISOString();
  const data: GuestData = {
    profile: {
      id: 'guest',
      email: null,
      display_name: 'Guest',
      avatar_url: null,
      biological_sex: null,
      age: null,
      height_cm: null,
      current_weight_kg: null,
      activity_level: null,
      target_goal: null,
      target_daily_calories: null,
      target_protein_g: null,
      target_carbs_g: null,
      target_fat_g: null,
      setup_complete: false,
      created_at: now,
    },
    meals: [],
    weights: [],
  };
  saveGuestData(data);
  return data;
}

export function saveGuestProfile(updates: Partial<Profile>): Profile {
  const data = ensureGuestData();
  data.profile = { ...data.profile, ...updates };
  saveGuestData(data);
  return data.profile;
}

export function addGuestMeal(meal: {
  meal_type: MealType;
  logged_at: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  food_items: FoodItem[];
  reasoning: string | null;
}): MealEntry {
  const data = ensureGuestData();
  const entry: MealEntry = {
    id: crypto.randomUUID(),
    profile_id: 'guest',
    ...meal,
    created_at: new Date().toISOString(),
  };
  data.meals.unshift(entry);
  saveGuestData(data);
  return entry;
}

export function deleteGuestMeal(id: string) {
  const data = ensureGuestData();
  data.meals = data.meals.filter((m) => m.id !== id);
  saveGuestData(data);
}

export function addGuestWeight(weightKg: number): WeightLog {
  const data = ensureGuestData();
  const entry: WeightLog = {
    id: crypto.randomUUID(),
    profile_id: 'guest',
    weight_kg: weightKg,
    logged_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  data.weights.unshift(entry);
  saveGuestData(data);
  return entry;
}

export function deleteGuestWeight(id: string) {
  const data = ensureGuestData();
  data.weights = data.weights.filter((w) => w.id !== id);
  saveGuestData(data);
}

export function getGuestWeightLogs(): WeightLog[] {
  return ensureGuestData().weights;
}

export function clearGuestData() {
  localStorage.removeItem(GUEST_KEY);
}
