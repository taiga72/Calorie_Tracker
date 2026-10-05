import { describe, it, expect, beforeEach } from 'vitest';
import { computeWeeklyRecap, lastWeek, recapPeriod, startOfIsoWeek, showRecapOnHome, dismissRecap, cacheRecapSummary, cachedRecapSummary } from '@/lib/weeklyRecap';
import type { MealEntry, Settings, WeightEntry } from '@/types';

const settings: Settings = {
  calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: -0.4, weightUnit: 'kg', geminiApiKey: '',
  calc: { bmr: 0, tdee: 0, dailyDeficit: 0, estimatedGoalDate: null, recommendedMacros: { protein: 120, carbs: 0, fat: 0 }, suggestedMealSplit: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 } },
};
// Wednesday 7 Oct 2026 → last week is Mon 28 Sep – Sun 4 Oct.
const TODAY = new Date(2026, 9, 7);

function meal(date: string, calories: number, protein = 100, name = 'Oats (80g)'): MealEntry {
  return { id: `${date}-${calories}-${name}`, date, mealType: 'Lunch', items: [{ name, calories, protein, carbs: 0, fat: 0, fiber: 0 }], calories, protein, carbs: 0, fat: 0, fiber: 0, reasoning: '', createdAt: 1 };
}
const w = (date: string, weight: number): WeightEntry => ({ date, weight, createdAt: 1 });

beforeEach(() => localStorage.clear());

describe('week boundaries', () => {
  it('uses Monday-to-Sunday weeks', () => {
    expect(startOfIsoWeek(new Date(2026, 9, 4)).getDate()).toBe(28); // Sunday belongs to the week of Mon 28 Sep
    expect(lastWeek(TODAY)).toEqual({ start: '2026-09-28', end: '2026-10-04' });
  });
});

describe('computeWeeklyRecap', () => {
  it('returns null when nothing was logged last week', () => {
    expect(computeWeeklyRecap([meal('2026-10-06', 1800)], [], settings, TODAY)).toBeNull();
  });

  it('summarises last week, averaging logged days only', () => {
    const meals = [
      meal('2026-09-28', 1800, 130), meal('2026-09-29', 2200, 90), meal('2026-09-30', 1900, 125),
      meal('2026-10-06', 3000), // this week: ignored
      meal('2026-09-22', 2300), meal('2026-09-23', 2100), // week before
    ];
    const r = computeWeeklyRecap(meals, [w('2026-09-28', 80), w('2026-10-03', 79.4)], settings, TODAY)!;

    expect(r.loggedDays).toBe(3);
    expect(r.avgCalories).toBe(1967);
    expect(r.avgCaloriesDelta).toBe(1967 - 2200);
    expect(r.daysOnTarget).toBe(2);
    expect(r.avgProtein).toBe(115);
    expect(r.daysProteinHit).toBe(2); // ≥ 90% of 120 g
    expect(r.weightChangeKg).toBeCloseTo(-0.6);
    expect(r.bestDay).toEqual({ date: '2026-09-30', calories: 1900 });
  });

  it('leaves partly logged days out of the average and goal count', () => {
    const meals = [meal('2026-09-28', 1800), meal('2026-09-29', 2080), meal('2026-09-30', 400), meal('2026-10-01', 2400)];
    const r = computeWeeklyRecap(meals, [], settings, TODAY)!;
    expect(r.loggedDays).toBe(4);
    expect(r.partialDays).toBe(1);
    expect(r.countedDays).toBe(3);
    expect(r.avgCalories).toBe(Math.round((1800 + 2080 + 2400) / 3));
    // 2080 is within 5% of 2000, so it counts; 2400 doesn't.
    expect(r.daysOnTarget).toBe(2);
  });

  it("doesn't call today partial in the end-of-week brief", () => {
    const friday = new Date(2026, 9, 9);
    const r = computeWeeklyRecap([meal('2026-10-05', 1900), meal('2026-10-09', 500)], [], settings, friday)!;
    expect(r.partialDays).toBe(0);
    expect(r.countedDays).toBe(2);
  });

  it('lists the most eaten foods, ignoring portion details', () => {
    const meals = [meal('2026-09-28', 300, 10, 'Oats (80g)'), meal('2026-09-29', 300, 10, 'Oats 100 g'), meal('2026-09-30', 300, 10, 'Banana')];
    expect(computeWeeklyRecap(meals, [], settings, TODAY)!.topFoods).toEqual([{ name: 'Oats', count: 2 }]);
  });

  it('shows foods by their real name, without portion details', () => {
    const meals = [meal('2026-09-28', 600, 30, 'Salmon, potatoes & greens (1 plate)'), meal('2026-09-29', 600, 30, 'Salmon, potatoes & greens')];
    expect(computeWeeklyRecap(meals, [], settings, TODAY)!.topFoods).toEqual([{ name: 'Salmon, potatoes & greens', count: 2 }]);
  });

  it('has no weight change or comparison without the data for it', () => {
    const r = computeWeeklyRecap([meal('2026-09-28', 1800)], [w('2026-09-29', 80)], settings, TODAY)!;
    expect(r.weightChangeKg).toBeNull();
    expect(r.avgCaloriesDelta).toBeNull();
  });
});

describe('Friday end-of-week brief', () => {
  it('covers last full week Monday–Thursday, and this week so far from Friday', () => {
    expect(recapPeriod(new Date(2026, 9, 8))).toEqual({ start: '2026-09-28', end: '2026-10-04', mode: 'last-week' }); // Thu
    expect(recapPeriod(new Date(2026, 9, 9))).toEqual({ start: '2026-10-05', end: '2026-10-09', mode: 'this-week' }); // Fri
    expect(recapPeriod(new Date(2026, 9, 11))).toEqual({ start: '2026-10-05', end: '2026-10-11', mode: 'this-week' }); // Sun
  });

  it('on Friday, summarises Monday to today', () => {
    const FRI = new Date(2026, 9, 9);
    const r = computeWeeklyRecap([meal('2026-10-05', 1800), meal('2026-10-09', 2100), meal('2026-10-02', 2500)], [], settings, FRI)!;
    expect(r.mode).toBe('this-week');
    expect(r.periodDays).toBe(5);
    expect(r.loggedDays).toBe(2);
    expect(r.avgCalories).toBe(1950);
    expect(r.avgCaloriesDelta).toBe(1950 - 2500); // vs last week
  });

  it('shows on Home Friday to Sunday until dismissed', () => {
    expect(showRecapOnHome(new Date(2026, 9, 8), '2026-10-05')).toBe(false); // Thu
    expect(showRecapOnHome(new Date(2026, 9, 9), '2026-10-05')).toBe(true); // Fri
    expect(showRecapOnHome(new Date(2026, 9, 11), '2026-10-05')).toBe(true); // Sun
    dismissRecap('2026-10-05');
    expect(showRecapOnHome(new Date(2026, 9, 10), '2026-10-05')).toBe(false);
    expect(showRecapOnHome(new Date(2026, 9, 16), '2026-10-12')).toBe(true); // next Friday
  });

  it('caches one brief per week', () => {
    cacheRecapSummary('2026-09-28', 'Nice week.');
    expect(cachedRecapSummary('2026-09-28')).toBe('Nice week.');
    expect(cachedRecapSummary('2026-10-05')).toBeNull();
  });
});
