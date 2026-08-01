import { describe, it, expect } from 'vitest';
import { mealsToCsv } from '@/lib/csv';
import type { MealEntry } from '@/types';

function meal(overrides: Partial<MealEntry> = {}): MealEntry {
  return {
    id: 'id-1',
    date: '2026-01-01',
    mealType: 'Breakfast',
    items: [{ name: 'Oatmeal', calories: 300, protein: 10, carbs: 50, fat: 5, fiber: 8 }],
    calories: 300,
    protein: 10,
    carbs: 50,
    fat: 5,
    fiber: 8,
    reasoning: '',
    createdAt: 1000,
    ...overrides,
  };
}

describe('mealsToCsv', () => {
  it('emits a header row', () => {
    const csv = mealsToCsv([]);
    expect(csv).toBe('Date,Meal Type,Food Items,Calories (kcal),Protein (g),Carbs (g),Fat (g),Fiber (g)');
  });

  it('renders a single meal row with rounded/formatted values', () => {
    const csv = mealsToCsv([meal()]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('2026-01-01,Breakfast,Oatmeal (300 kcal),300,10.0,50.0,5.0,8.0');
  });

  it('sorts by date, then by createdAt within the same date', () => {
    const later = meal({ id: 'a', date: '2026-01-02', createdAt: 500, items: [] });
    const earlierSameDay = meal({ id: 'b', date: '2026-01-01', createdAt: 200, items: [] });
    const laterSameDay = meal({ id: 'c', date: '2026-01-01', createdAt: 900, items: [] });
    const csv = mealsToCsv([later, laterSameDay, earlierSameDay]);
    const dataLines = csv.split('\r\n').slice(1);
    expect(dataLines.map((l) => l.split(',')[0])).toEqual(['2026-01-01', '2026-01-01', '2026-01-02']);
    // within 2026-01-01, earlierSameDay (createdAt 200) should precede laterSameDay (createdAt 900)
    expect(dataLines[0]).toContain('2026-01-01');
    expect(dataLines[1]).toContain('2026-01-01');
  });

  it('quotes and escapes food item names containing commas', () => {
    const csv = mealsToCsv([meal({ items: [{ name: 'Rice, beans', calories: 200, protein: 0, carbs: 0, fat: 0, fiber: 0 }] })]);
    expect(csv).toContain('"Rice, beans (200 kcal)"');
  });

  it('escapes double quotes by doubling them', () => {
    const csv = mealsToCsv([meal({ items: [{ name: '12" Pizza', calories: 200, protein: 0, carbs: 0, fat: 0, fiber: 0 }] })]);
    expect(csv).toContain('"12"" Pizza (200 kcal)"');
  });

  it('quotes fields containing newlines', () => {
    const csv = mealsToCsv([meal({ items: [{ name: 'Line1\nLine2', calories: 200, protein: 0, carbs: 0, fat: 0, fiber: 0 }] })]);
    expect(csv).toContain('"Line1\nLine2 (200 kcal)"');
  });

  it('joins multiple food items with a semicolon', () => {
    const csv = mealsToCsv([
      meal({
        items: [
          { name: 'Eggs', calories: 150, protein: 12, carbs: 1, fat: 10, fiber: 0 },
          { name: 'Toast', calories: 120, protein: 4, carbs: 22, fat: 2, fiber: 2 },
        ],
      }),
    ]);
    expect(csv).toContain('Eggs (150 kcal); Toast (120 kcal)');
  });

  it('rounds fractional calories in item labels and totals', () => {
    const csv = mealsToCsv([
      meal({ calories: 300.6, items: [{ name: 'Snack', calories: 300.4, protein: 0, carbs: 0, fat: 0, fiber: 0 }] }),
    ]);
    expect(csv).toContain('Snack (300 kcal)');
    expect(csv).toContain(',301,');
  });
});
