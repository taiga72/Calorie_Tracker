import { describe, expect, it } from 'vitest';
import { plateau, weekendOffsets, weekendPattern } from '@/lib/insights';
import { addDays, toKey } from '@/lib/dateUtils';
import type { MealEntry, Settings, WeightEntry, Workout } from '@/types';

const settings: Settings = { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: -0.5, weightUnit: 'kg', geminiApiKey: '' };
const today = new Date(2026, 9, 14);
const day = (n: number) => toKey(addDays(today, -n));
const isWeekendKey = (k: string) => [0, 5, 6].includes(new Date(k + 'T12:00').getDay());

function meal(date: string, calories: number): MealEntry {
  return { id: date, date, mealType: 'Dinner', items: [], calories, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '', createdAt: 0 };
}
/** Every day of the last `n` days, weekdays and weekends at the given totals. */
function days(n: number, weekday: number, weekend: number): MealEntry[] {
  return Array.from({ length: n }, (_, i) => day(i + 1)).map((k) => meal(k, isWeekendKey(k) ? weekend : weekday));
}
function flatWeights(n: number, kg = 80): WeightEntry[] {
  return Array.from({ length: n }, (_, i) => ({ date: day(n - i), weight: kg + (i % 2 ? 0.2 : -0.2), createdAt: i }));
}

describe('weekendPattern', () => {
  it('spots weekends well above weekdays and proposes a balanced shift', () => {
    const p = weekendPattern({ meals: days(28, 1800, 2500), settings, today })!;
    expect(p.diff).toBe(700);
    expect(p.shift.plus).toBe(400);
    expect(p.shift.minus).toBe(300);
    expect(p.alreadyShifted).toBe(false);
    const offsets = weekendOffsets(p.shift);
    expect(offsets).toEqual([400, -300, -300, -300, -300, 400, 400]);
    // The weekly total stays about the same.
    expect(Math.abs(offsets.reduce((a, b) => a + b, 0))).toBeLessThanOrEqual(0);
  });

  it('stays quiet for a small gap or too little data', () => {
    expect(weekendPattern({ meals: days(28, 1900, 2100), settings, today })).toBeNull();
    expect(weekendPattern({ meals: days(5, 1800, 2600), settings, today })).toBeNull();
  });
});

describe('plateau', () => {
  const base = { workouts: [] as Workout[], settings, today };

  it('finds a stall while trying to lose, and suggests the new maintenance', () => {
    const p = plateau({ ...base, meals: days(28, 1950, 1950), weights: flatWeights(24) })!;
    expect(p).not.toBeNull();
    expect(p.direction).toBe('lose');
    expect(p.weeks).toBeGreaterThanOrEqual(3);
    expect(p.causes.map((c) => c.id)).toContain('maintenance');
    expect(p.maintenance).toBe(1950);
    expect(p.causes[p.causes.length - 1].id).toBe('water');
  });

  it('names logging gaps, eating over and big weekends', () => {
    const sparse = days(28, 2300, 2900).filter((_, i) => i % 2 === 0);
    const ids = plateau({ ...base, meals: sparse, weights: flatWeights(24) })!.causes.map((c) => c.id);
    expect(ids).toContain('logging');
    expect(ids).toContain('over');
    expect(ids).toContain('weekends');
  });

  it('mentions newly started strength training', () => {
    const lift = (n: number): Workout => ({ id: `w${n}`, date: day(n), kind: 'strength', name: 'Gym', minutes: 45, calories: 200, createdAt: n });
    const ids = plateau({ ...base, workouts: [lift(3), lift(6)], meals: days(28, 1950, 1950), weights: flatWeights(24) })!.causes.map((c) => c.id);
    expect(ids).toContain('training');
  });

  it('is not a plateau when the weight is moving the right way, or when maintaining', () => {
    const losing = Array.from({ length: 24 }, (_, i) => ({ date: day(24 - i), weight: 82 - i * 0.07, createdAt: i }));
    expect(plateau({ ...base, meals: days(28, 1800, 1800), weights: losing })).toBeNull();
    expect(plateau({ ...base, settings: { ...settings, weeklyWeightTarget: 0 }, meals: days(28, 1950, 1950), weights: flatWeights(24) })).toBeNull();
  });

  it('needs three weeks of weigh-ins', () => {
    expect(plateau({ ...base, meals: days(28, 1950, 1950), weights: flatWeights(10) })).toBeNull();
  });
});
