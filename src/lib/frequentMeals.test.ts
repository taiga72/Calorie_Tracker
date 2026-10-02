import { describe, it, expect } from 'vitest';
import { getFrequentMeals, normalizeItemName } from '@/lib/frequentMeals';
import type { MealEntry } from '@/types';

let nextId = 0;
function meal(itemNames: string[], calories: number, createdAt: number): MealEntry {
  return {
    id: `m${nextId++}`,
    date: '2026-01-01',
    mealType: 'Lunch',
    items: itemNames.map((name) => ({ name, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })),
    calories,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    reasoning: '',
    createdAt,
  };
}

describe('getFrequentMeals', () => {
  it('returns nothing when no meal has been logged more than once', () => {
    expect(getFrequentMeals([meal(['Oatmeal'], 300, 1), meal(['Salad'], 200, 2)])).toEqual([]);
  });

  it('groups meals with the same items regardless of order and case', () => {
    const result = getFrequentMeals([
      meal(['Rice', 'Chicken'], 600, 1),
      meal(['chicken', 'rice '], 620, 2),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });

  it('uses the most recently logged entry as the template', () => {
    const result = getFrequentMeals([
      meal(['Oatmeal'], 300, 5),
      meal(['Oatmeal'], 350, 10),
      meal(['Oatmeal'], 320, 1),
    ]);
    expect(result[0].template.calories).toBe(350);
    expect(result[0].count).toBe(3);
  });

  it('orders by how often a meal was logged, then by recency', () => {
    const result = getFrequentMeals([
      meal(['Salad'], 200, 1),
      meal(['Salad'], 200, 2),
      meal(['Toast'], 150, 3),
      meal(['Toast'], 150, 4),
      meal(['Oatmeal'], 300, 5),
      meal(['Oatmeal'], 300, 6),
      meal(['Oatmeal'], 300, 7),
    ]);
    expect(result.map((r) => r.label)).toEqual(['Oatmeal', 'Toast', 'Salad']);
  });

  it('skips meals with no named items and respects the limit', () => {
    const many = ['A', 'B', 'C', 'D', 'E', 'F'].flatMap((n, i) => [meal([n], 100, i * 2), meal([n], 100, i * 2 + 1)]);
    expect(getFrequentMeals([...many, meal([], 100, 99), meal([''], 100, 100)], { limit: 3 })).toHaveLength(3);
  });
});

describe('normalizeItemName', () => {
  it('drops portion details so estimates of the same food match', () => {
    expect(normalizeItemName('French press coffee (150ml)')).toBe('french press coffee');
    expect(normalizeItemName('French Press Coffee 100 ml')).toBe('french press coffee');
    expect(normalizeItemName('Yakult (65ml bottle)')).toBe('yakult');
    expect(normalizeItemName('2 slices whole-wheat toast')).toBe('whole wheat toast');
  });
});

describe('getFrequentMeals de-duplication', () => {
  it('collapses the same meal logged with different portion notes into one entry', () => {
    const result = getFrequentMeals([
      ...Array.from({ length: 8 }, (_, i) => meal(['French press coffee (150ml)', 'Oatside oat milk (30ml)'], 132, i)),
      ...Array.from({ length: 8 }, (_, i) => meal(['French press coffee (100ml)', 'Oatside oat milk (30ml)'], 132, 10 + i)),
      ...Array.from({ length: 3 }, (_, i) => meal(['French press coffee', 'Oatside oat milk barista'], 132, 20 + i)),
      meal(['Yakult (65ml bottle)'], 50, 30),
      meal(['Yakult (65ml bottle)'], 50, 31),
    ]);
    expect(result.map((r) => r.count)).toEqual([19, 2]);
    expect(result[0].template.createdAt).toBe(22);
  });

  it('keeps meals with similar words but clearly different calories apart', () => {
    const result = getFrequentMeals([
      meal(['Chicken rice bowl'], 500, 1),
      meal(['Chicken rice bowl'], 500, 2),
      meal(['Chicken rice bowl large'], 900, 3),
      meal(['Chicken rice bowl large'], 900, 4),
    ]);
    expect(result).toHaveLength(2);
  });

  it('leaves out hidden meals and lets the next one take its place', () => {
    const meals = [
      meal(['Oatmeal'], 300, 1), meal(['Oatmeal'], 300, 2), meal(['Oatmeal'], 300, 3),
      meal(['Toast'], 150, 4), meal(['Toast'], 150, 5),
      meal(['Salad'], 200, 6), meal(['Salad'], 200, 7),
    ];
    const [first] = getFrequentMeals(meals, { limit: 2 });
    const result = getFrequentMeals(meals, { limit: 2, hidden: new Set(first.memberKeys) });
    expect(result.map((r) => r.label)).toEqual(['Salad', 'Toast']);
  });

  it('hides every variant that was merged into a hidden meal', () => {
    const meals = [
      meal(['Coffee (150ml)'], 10, 1), meal(['Coffee (150ml)'], 10, 2),
      meal(['Coffee (100ml)'], 10, 3),
    ];
    const [coffee] = getFrequentMeals(meals);
    expect(getFrequentMeals(meals, { hidden: new Set(coffee.memberKeys) })).toEqual([]);
  });
});
