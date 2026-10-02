import { describe, it, expect } from 'vitest';
import { getFrequentMeals } from '@/lib/frequentMeals';
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
    expect(getFrequentMeals([...many, meal([], 100, 99), meal([''], 100, 100)], 3)).toHaveLength(3);
  });
});
