import { describe, expect, it } from 'vitest';
import { milestoneLabel, milestoneProgress, newlyAchieved } from '@/lib/milestones';
import { addDays, toKey } from '@/lib/dateUtils';
import type { MealEntry, Milestone, Settings, WeightEntry } from '@/types';

const settings: Settings = { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: -0.4, weightUnit: 'kg', geminiApiKey: '' };
const daysAgo = (n: number) => toKey(addDays(new Date(), -n));
const meal = (date: string, calories: number): MealEntry => ({ id: `${date}-${calories}`, date, mealType: 'Lunch', items: [], calories, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '', createdAt: 1 });
const w = (date: string, weight: number): WeightEntry => ({ date, weight, createdAt: 1 });
const ms = (m: Partial<Milestone>): Milestone => ({ id: 'x', kind: 'meals', target: 1, createdAt: daysAgo(30), ...m });

describe('milestones', () => {
  it('tracks a weight target in the right direction', () => {
    const m = ms({ kind: 'weight', target: 78, startWeight: 82 });
    const p = milestoneProgress(m, { meals: [], weights: [w(daysAgo(10), 82), w(daysAgo(1), 80)], settings });
    expect(p.fraction).toBeCloseTo(0.5);
    expect(p.achieved).toBe(false);
    expect(milestoneProgress(m, { meals: [], weights: [w(daysAgo(0), 77.9)], settings }).achieved).toBe(true);
    // Gaining toward a higher target.
    expect(milestoneProgress(ms({ kind: 'weight', target: 70, startWeight: 65 }), { meals: [], weights: [w(daysAgo(0), 70.2)], settings }).achieved).toBe(true);
  });

  it('counts streaks, meals and days within goal', () => {
    const meals = [meal(daysAgo(0), 1800), meal(daysAgo(1), 1900), meal(daysAgo(2), 2600), meal(daysAgo(3), 400)];
    const data = { meals, weights: [], settings };
    expect(milestoneProgress(ms({ kind: 'streak', target: 4 }), data).achieved).toBe(true);
    expect(milestoneProgress(ms({ kind: 'meals', target: 10 }), data)).toMatchObject({ current: 4, achieved: false });
    // Yesterday counts; 2,600 is over, 400 is partly logged, today isn't finished.
    expect(milestoneProgress(ms({ kind: 'withinGoal', target: 5 }), data).current).toBe(1);
  });

  it('only reports milestones not yet celebrated', () => {
    const data = { meals: [meal(daysAgo(0), 1800)], weights: [], settings };
    const list = [ms({ id: 'a', kind: 'meals', target: 1 }), ms({ id: 'b', kind: 'meals', target: 1, achievedAt: daysAgo(1) })];
    expect(newlyAchieved(list, data).map((m) => m.id)).toEqual(['a']);
  });

  it('names milestones', () => {
    expect(milestoneLabel(ms({ kind: 'weight', target: 75 }), settings)).toBe('Reach 75 kg');
    expect(milestoneLabel(ms({ kind: 'streak', target: 30 }), settings)).toBe('30-day logging streak');
    expect(milestoneLabel(ms({ kind: 'meals', target: 100, label: 'First 100!' }), settings)).toBe('First 100!');
  });
});
