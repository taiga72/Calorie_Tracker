import type { MealEntry } from '@/types';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Past meals matching a query, newest first. Every word has to appear
 * somewhere in the meal (item names, meal type or the note), so "chicken
 * rice" finds "Chicken rice bowl" and "rice with grilled chicken".
 */
export function searchMeals(meals: MealEntry[], query: string, limit = 100): MealEntry[] {
  const words = norm(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  return meals
    .filter((m) => {
      const text = norm([m.mealType, ...m.items.map((i) => i.name)].join(' '));
      return words.every((w) => text.includes(w));
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, limit);
}
