import { describe, it, expect } from 'vitest';
import { normalizeItemName, findDuplicatePin, pinFromMeal, defaultPinName } from '@/lib/pinnedMeals';
import type { PinnedMeal } from '@/types';

function pin(name: string, calories: number): PinnedMeal {
  return {
    id: name, name, mealType: 'Snack', items: [{ name, calories, protein: 0, carbs: 0, fat: 0, fiber: 0 }],
    calories, protein: 0, carbs: 0, fat: 0, fiber: 0, createdAt: 1,
  };
}

describe('normalizeItemName', () => {
  it('ignores portion details Gemini varies between estimates', () => {
    expect(normalizeItemName('French press coffee (150ml)')).toBe('french press coffee');
    expect(normalizeItemName('French Press Coffee 100 ml')).toBe('french press coffee');
    expect(normalizeItemName('2 slices toast')).toBe('toast');
  });
});

describe('findDuplicatePin', () => {
  it('treats the same food with a different portion label as the same pin', () => {
    const pins = [pin('Coffee with oat milk (150ml)', 60)];
    expect(findDuplicatePin(pins, { items: [{ name: 'Coffee with oat milk (100ml)', calories: 58, protein: 0, carbs: 0, fat: 0, fiber: 0 }], calories: 58 }))
      .toBe(pins[0]);
  });

  it('keeps meals with clearly different calories apart', () => {
    const pins = [pin('Pasta', 400)];
    expect(findDuplicatePin(pins, { items: pin('Pasta', 800).items, calories: 800 })).toBeUndefined();
  });

  it('keeps different foods apart', () => {
    const pins = [pin('Pasta', 400)];
    expect(findDuplicatePin(pins, { items: pin('Pizza', 400).items, calories: 400 })).toBeUndefined();
  });
});

describe('pinFromMeal / defaultPinName', () => {
  it('names a pin after its items and copies the nutrition', () => {
    const p = pinFromMeal({
      mealType: 'Lunch', calories: 500, protein: 30, carbs: 50, fat: 20, fiber: 5,
      items: [
        { name: 'Rice ', calories: 200, protein: 4, carbs: 45, fat: 0, fiber: 1 },
        { name: 'Chicken', calories: 300, protein: 26, carbs: 5, fat: 20, fiber: 4 },
      ],
    });
    expect(p.name).toBe('Rice, Chicken');
    expect(p).toMatchObject({ mealType: 'Lunch', calories: 500, protein: 30 });
  });

  it('falls back to the meal type when items have no names', () => {
    expect(defaultPinName([], 'Snack')).toBe('Snack');
  });
});
