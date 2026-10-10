import { describe, expect, it } from 'vitest';
import { lastLogMethod, mealTypeForTime, rememberLogMethod } from '@/lib/logPrefs';

const at = (h: number, m = 0) => new Date(2026, 9, 10, h, m);

describe('log preferences', () => {
  it('guesses the meal from the time of day', () => {
    expect(mealTypeForTime(at(7, 30))).toBe('Breakfast');
    expect(mealTypeForTime(at(12))).toBe('Lunch');
    expect(mealTypeForTime(at(16))).toBe('Snack');
    expect(mealTypeForTime(at(19))).toBe('Dinner');
    expect(mealTypeForTime(at(23))).toBe('Snack');
  });

  it('remembers how you last logged', () => {
    rememberLogMethod('photo');
    expect(lastLogMethod()).toBe('photo');
  });
});
