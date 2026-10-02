import type { MealEntry } from '@/types';

export interface FrequentMeal {
  /** Stable id for the group (its most-logged member's key). */
  key: string;
  /** Every grouping key merged into this entry — hiding one hides all of them. */
  memberKeys: string[];
  label: string;
  count: number;
  /** The most recent entry in the group — its nutrition values are what get reused. */
  template: MealEntry;
}

/**
 * Strips the portion details Gemini varies between estimates of the same food
 * ("French press coffee (150ml)" vs "(100ml)"), so they group together.
 */
export function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\d+(\.\d+)?/g, ' ')
    .replace(/\b(ml|l|g|kg|oz|lb|lbs|cups?|tbsp|tsp|pcs?|pieces?|slices?|servings?|bottles?|cans?|glass(es)?|scoops?)\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mealKey(meal: MealEntry): string {
  return [...new Set(meal.items.map((i) => normalizeItemName(i.name)).filter(Boolean))].sort().join('|');
}

function tokens(key: string): Set<string> {
  return new Set(key.split(/[|\s]+/).filter(Boolean));
}

function similarity(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

const SAME_MEAL_WORD_OVERLAP = 0.6;
const SAME_MEAL_CALORIE_TOLERANCE = 0.1;

function sameMeal(a: FrequentMeal, b: FrequentMeal): boolean {
  const ca = a.template.calories;
  const cb = b.template.calories;
  const calorieGap = Math.abs(ca - cb) / Math.max(ca, cb, 1);
  return calorieGap <= SAME_MEAL_CALORIE_TOLERANCE && similarity(tokens(a.key), tokens(b.key)) >= SAME_MEAL_WORD_OVERLAP;
}

const HIDDEN_KEY = 'calorie_tracker_hidden_frequent_meals';

export function loadHiddenFrequentMeals(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveHiddenFrequentMeals(keys: Set<string>): void {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...keys]));
  } catch {
    // Best-effort, per-device convenience only.
  }
}

/**
 * Meals logged repeatedly, so they can be re-logged from history without
 * spending a Gemini call. Entries with the same normalized item names are one
 * meal; groups that are near-duplicates (similar calories, mostly the same
 * words) are merged too, so the list never shows the same meal twice.
 */
export function getFrequentMeals(
  meals: MealEntry[],
  { limit = 5, minCount = 2, hidden = new Set<string>() }: { limit?: number; minCount?: number; hidden?: Set<string> } = {},
): FrequentMeal[] {
  const byKey = new Map<string, FrequentMeal>();
  for (const meal of meals) {
    const key = mealKey(meal);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { key, memberKeys: [key], label: meal.items.map((i) => i.name.trim()).join(', '), count: 1, template: meal });
    } else {
      existing.count += 1;
      if (meal.createdAt > existing.template.createdAt) {
        existing.template = meal;
        existing.label = meal.items.map((i) => i.name.trim()).join(', ');
      }
    }
  }

  const merged: FrequentMeal[] = [];
  const byCount = [...byKey.values()].sort((a, b) => b.count - a.count || b.template.createdAt - a.template.createdAt);
  for (const group of byCount) {
    const target = merged.find((m) => sameMeal(m, group));
    if (!target) {
      merged.push({ ...group, memberKeys: [...group.memberKeys] });
      continue;
    }
    target.count += group.count;
    target.memberKeys.push(...group.memberKeys);
    if (group.template.createdAt > target.template.createdAt) {
      target.template = group.template;
      target.label = group.label;
    }
  }

  return merged
    .filter((g) => g.count >= minCount && !g.memberKeys.some((k) => hidden.has(k)))
    .sort((a, b) => b.count - a.count || b.template.createdAt - a.template.createdAt)
    .slice(0, limit);
}
