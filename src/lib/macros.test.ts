import { describe, expect, it } from 'vitest';
import { fiberTarget, fmtGrams, macroTargets } from '@/lib/macros';
import type { Settings } from '@/types';

const base: Settings = { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: 0, weightUnit: 'kg', geminiApiKey: '' };

describe('macros', () => {
  it('suggests about 14 g of fiber per 1,000 kcal', () => {
    expect(fiberTarget(2000)).toBe(28);
  });

  it('has no macro targets until the user sets them', () => {
    expect(macroTargets(base)).toBeNull();
    const calc = { bmr: 0, tdee: 0, dailyDeficit: 0, estimatedGoalDate: null, suggestedMealSplit: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 } };
    expect(macroTargets({ ...base, calc: { ...calc, recommendedMacros: { protein: 0, carbs: 0, fat: 0 } } })).toBeNull();
    expect(macroTargets({ ...base, calc: { ...calc, recommendedMacros: { protein: 140, carbs: 200, fat: 60 } } })).toEqual({ protein: 140, carbs: 200, fat: 60 });
  });
});

describe('fmtGrams', () => {
  it('shows whole grams from 10 up and one decimal below', () => {
    expect(fmtGrams(36.8)).toBe('37');
    expect(fmtGrams(31.0)).toBe('31');
    expect(fmtGrams(10)).toBe('10');
    expect(fmtGrams(4.34)).toBe('4.3');
    expect(fmtGrams(2)).toBe('2');
    expect(fmtGrams(0)).toBe('0');
    expect(fmtGrams(Number.NaN)).toBe('0');
  });
});
