import { describe, expect, it } from 'vitest';
import { habitStreaks, streakOf } from '@/lib/habits';
import type { MealEntry, Settings, Workout } from '@/types';

const settings: Settings = {
  calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: -0.5, weightUnit: 'kg', geminiApiKey: '',
  calc: { bmr: 1600, tdee: 2400, dailyDeficit: -400, estimatedGoalDate: null, recommendedMacros: { protein: 120, carbs: 200, fat: 60 }, suggestedMealSplit: { breakfast: 500, lunch: 600, dinner: 700, snack: 200 } },
};
const today = new Date(2026, 9, 14); // Wednesday

function meal(date: string, calories: number, protein = 50, fiber = 10): MealEntry {
  return { id: `${date}-${calories}`, date, mealType: 'Lunch', items: [], calories, protein, carbs: 0, fat: 0, fiber, reasoning: '', createdAt: 0 };
}

describe('streakOf', () => {
  it('counts back from the latest period, which may still be open', () => {
    expect(streakOf(['a', 'b', 'c', 'd'], (p) => p !== 'a')).toEqual({ current: 3, best: 3 });
    expect(streakOf(['a', 'b', 'c', 'd'], (p) => p === 'b' || p === 'c')).toEqual({ current: 2, best: 2 });
    expect(streakOf(['a', 'b', 'c', 'd'], (p) => p === 'a' || p === 'c')).toEqual({ current: 1, best: 1 });
    expect(streakOf(['a', 'b', 'c', 'd'], () => false)).toEqual({ current: 0, best: 0 });
  });
});

describe('habitStreaks', () => {
  const meals = [
    meal('2026-10-11', 1900, 130, 30),
    meal('2026-10-12', 2500, 130, 30), // over
    meal('2026-10-13', 1800, 125, 10),
    meal('2026-10-14', 600, 40, 5), // today, so far
  ];
  const byId = (id: string) => habitStreaks({ meals, workouts: [], weights: [], settings, today }).find((h) => h.id === id)!;

  it('logging streak includes today', () => {
    expect(byId('logging').current).toBe(4);
  });

  it('within goal judges finished days only', () => {
    const h = byId('withinGoal');
    expect(h.current).toBe(1);
    expect(h.recent[h.recent.length - 1]).toBe('open');
  });

  it('protein uses the target and allows a little under', () => {
    expect(byId('protein').current).toBe(3);
  });

  it('fiber follows the calorie goal', () => {
    expect(byId('fiber').current).toBe(0);
    expect(byId('fiber').best).toBe(2);
  });

  it('counts active weeks by minutes or number of workouts', () => {
    const w = (date: string, minutes: number): Workout => ({ id: date + minutes, date, kind: 'cardio', name: 'Run', minutes, calories: 0, createdAt: 0 });
    const workouts = [
      w('2026-09-28', 160), // week of Sep 27
      w('2026-10-05', 20), w('2026-10-06', 20), w('2026-10-07', 20), // week of Oct 4: three workouts
      w('2026-10-12', 30), // this week, not yet
    ];
    const active = habitStreaks({ meals, workouts, weights: [], settings, today }).find((h) => h.id === 'active')!;
    expect(active.unit).toBe('week');
    expect(active.current).toBe(2);
    expect(active.recent[active.recent.length - 1]).toBe('open');
  });

  it('leaves protein out without a target', () => {
    const list = habitStreaks({ meals, workouts: [], weights: [], settings: { ...settings, calc: null }, today });
    expect(list.some((h) => h.id === 'protein')).toBe(false);
  });
});
