import type { MealEntry } from '@/types';

export interface FrequentMeal {
  key: string;
  label: string;
  count: number;
  /** The most recent entry in the group — its nutrition values are what get reused. */
  template: MealEntry;
}

function mealKey(meal: MealEntry): string {
  return meal.items
    .map((i) => i.name.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');
}

/**
 * Meals logged repeatedly, so they can be re-logged from history without
 * spending a Gemini call. Two entries count as the same meal when they have
 * the same set of item names (case- and order-insensitive).
 */
export function getFrequentMeals(meals: MealEntry[], limit = 5, minCount = 2): FrequentMeal[] {
  const groups = new Map<string, FrequentMeal>();
  for (const meal of meals) {
    const key = mealKey(meal);
    if (!key) continue;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { key, label: meal.items.map((i) => i.name.trim()).join(', '), count: 1, template: meal });
    } else {
      existing.count += 1;
      if (meal.createdAt > existing.template.createdAt) {
        existing.template = meal;
        existing.label = meal.items.map((i) => i.name.trim()).join(', ');
      }
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= minCount)
    .sort((a, b) => b.count - a.count || b.template.createdAt - a.template.createdAt)
    .slice(0, limit);
}
