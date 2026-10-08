import { describe, expect, it } from 'vitest';
import { searchMeals } from '@/lib/mealSearch';
import type { MealEntry } from '@/types';

const meal = (id: string, date: string, names: string[], mealType: MealEntry['mealType'] = 'Lunch'): MealEntry => ({
  id, date, mealType, items: names.map((name) => ({ name, calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0 })),
  calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '', createdAt: 1,
});

describe('searchMeals', () => {
  const meals = [
    meal('a', '2026-09-01', ['Chicken rice bowl']),
    meal('b', '2026-10-01', ['Rice', 'Grilled chicken'], 'Dinner'),
    meal('c', '2026-10-02', ['Ramen (tonkotsu)']),
    meal('d', '2026-10-03', ['Crème brûlée'], 'Snack'),
  ];

  it('needs every word, in any order and item, newest first', () => {
    expect(searchMeals(meals, 'chicken rice').map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('ignores case and accents, and matches meal types', () => {
    expect(searchMeals(meals, 'RAMEN').map((m) => m.id)).toEqual(['c']);
    expect(searchMeals(meals, 'creme brulee').map((m) => m.id)).toEqual(['d']);
    expect(searchMeals(meals, 'dinner').map((m) => m.id)).toEqual(['b']);
  });

  it('returns nothing for an empty query', () => {
    expect(searchMeals(meals, '  ')).toEqual([]);
  });
});
