import type { FoodItem, MealEntry, PinnedMeal } from '@/types';

/**
 * Strips the portion details Gemini varies between estimates of the same food
 * ("French press coffee (150ml)" vs "(100ml)"), so they compare as equal.
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

function itemsKey(items: FoodItem[]): string {
  return [...new Set(items.map((i) => normalizeItemName(i.name)).filter(Boolean))].sort().join('|');
}

const SAME_MEAL_CALORIE_TOLERANCE = 0.1;

/** An existing pin for the same food (same items, calories within 10%), if any. */
export function findDuplicatePin(pins: PinnedMeal[], candidate: Pick<PinnedMeal, 'items' | 'calories'>): PinnedMeal | undefined {
  const key = itemsKey(candidate.items);
  if (!key) return undefined;
  return pins.find((p) => {
    const gap = Math.abs(p.calories - candidate.calories) / Math.max(p.calories, candidate.calories, 1);
    return itemsKey(p.items) === key && gap <= SAME_MEAL_CALORIE_TOLERANCE;
  });
}

export function defaultPinName(items: FoodItem[], fallback: string): string {
  const names = items.map((i) => i.name.trim()).filter(Boolean);
  return names.length ? names.join(', ') : fallback;
}

/** The nutrition part of a logged meal, ready to pin (photos aren't kept). */
export function pinFromMeal(meal: Pick<MealEntry, 'mealType' | 'items' | 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber'>): Omit<PinnedMeal, 'id' | 'createdAt'> {
  return {
    name: defaultPinName(meal.items, meal.mealType),
    mealType: meal.mealType,
    items: meal.items.map((i) => ({ ...i })),
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    fiber: meal.fiber,
  };
}

/** One food from a meal, ready to pin on its own (e.g. the chicken from "chicken, rice & salad"). */
export function pinFromItem(item: FoodItem, mealType: MealEntry['mealType']): Omit<PinnedMeal, 'id' | 'createdAt'> {
  return pinFromMeal({
    mealType,
    items: [item],
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    fiber: item.fiber,
  });
}
