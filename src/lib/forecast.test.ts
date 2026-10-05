import { describe, it, expect } from 'vitest';
import { weightTrend, goalForecast, adaptiveTarget, KCAL_PER_KG } from '@/lib/forecast';
import { addDays, toKey } from '@/lib/dateUtils';
import type { MealEntry, WeightEntry } from '@/types';

const TODAY = new Date(2026, 9, 2); // 2 Oct 2026

const daysAgo = (n: number) => toKey(addDays(TODAY, -n));

/** One weigh-in per day for `days` days ending today, changing by `perDay`. */
function linearWeights(startKg: number, perDay: number, days: number): WeightEntry[] {
  return Array.from({ length: days }, (_, i) => ({
    date: daysAgo(days - 1 - i),
    weight: startKg + perDay * i,
    createdAt: i,
  }));
}

function mealOn(date: string, calories: number): MealEntry {
  return { id: date, date, mealType: 'Lunch', items: [], calories, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '', createdAt: 1 };
}

describe('weightTrend', () => {
  it('needs at least two weigh-ins spread over a week', () => {
    expect(weightTrend([], TODAY)).toBeNull();
    expect(weightTrend(linearWeights(80, -0.1, 3), TODAY)).toBeNull();
    expect(weightTrend(linearWeights(80, -0.1, 8), TODAY)).not.toBeNull();
  });

  it('fits the slope and today’s weight', () => {
    const t = weightTrend(linearWeights(80, -0.1, 14), TODAY)!;
    expect(t.slopeKgPerDay).toBeCloseTo(-0.1, 6);
    expect(t.currentKg).toBeCloseTo(80 - 0.1 * 13, 6);
  });

  it('is not thrown off by one noisy weigh-in', () => {
    const ws = linearWeights(80, -0.05, 21);
    ws[20] = { ...ws[20], weight: ws[20].weight + 1.5 }; // salty dinner yesterday
    const t = weightTrend(ws, TODAY)!;
    expect(t.slopeKgPerDay).toBeLessThan(0.01);
  });

  it('ignores weigh-ins older than the window', () => {
    const old = { date: daysAgo(90), weight: 100, createdAt: 0 };
    const t = weightTrend([old, ...linearWeights(80, -0.1, 10)], TODAY)!;
    expect(t.points).toBe(10);
  });
});

describe('goalForecast', () => {
  it('projects the date the goal is reached at the current pace', () => {
    // 80 → 78.6 over 14 days (−0.1 kg/day); 3.6 kg left to 75 → 36 days.
    const f = goalForecast(linearWeights(80, -0.1, 15), 75, TODAY);
    expect(f.status).toBe('on-track');
    if (f.status !== 'on-track') return;
    expect(f.date).toBe(toKey(addDays(TODAY, 36)));
    expect(f.weeks).toBe(6);
    expect(f.weeklyChangeKg).toBeCloseTo(-0.7, 6);
  });

  it('works for weight gain goals too', () => {
    const f = goalForecast(linearWeights(60, 0.05, 15), 62, TODAY);
    expect(f.status).toBe('on-track');
  });

  it('reports off-track when the trend moves away from the goal', () => {
    const f = goalForecast(linearWeights(80, 0.05, 15), 75, TODAY);
    expect(f.status).toBe('off-track');
  });

  it('reports off-track when weight is flat', () => {
    expect(goalForecast(linearWeights(80, 0, 15), 75, TODAY).status).toBe('off-track');
  });

  it('reports reached when within a few hundred grams of the goal', () => {
    expect(goalForecast(linearWeights(75.2, 0, 15), 75, TODAY).status).toBe('reached');
  });

  it('asks for more data with too few weigh-ins', () => {
    expect(goalForecast(linearWeights(80, -0.1, 2), 75, TODAY).status).toBe('not-enough-data');
  });
});

describe('adaptiveTarget', () => {
  const threeWeeksOfMeals = (kcal: number) => Array.from({ length: 21 }, (_, i) => mealOn(daysAgo(i + 1), kcal));
  /** Daily weigh-ins over the 21 days before today. */
  const windowWeights = (startKg: number, perDay: number) =>
    Array.from({ length: 21 }, (_, i) => ({ date: daysAgo(21 - i), weight: startKg + perDay * i, createdAt: i }));

  it('estimates maintenance from intake and weight change, and suggests a goal', () => {
    // Eating 2000/day while losing 0.05 kg/day → burning 2000 + 385 = 2385.
    const r = adaptiveTarget(threeWeeksOfMeals(2000), windowWeights(80, -0.05), -0.35, TODAY);

    expect(r.status).toBe('ready');
    if (r.status !== 'ready') return;
    expect(r.avgIntake).toBe(2000);
    expect(r.tdee).toBe(Math.round(2000 + 0.05 * KCAL_PER_KG));
    // −0.35 kg/week = −385 kcal/day below maintenance.
    expect(r.suggestedGoal).toBe(Math.round((r.tdee - 385) / 10) * 10);
  });

  it('skips unlogged days instead of counting them as zero', () => {
    const meals = threeWeeksOfMeals(2000).filter((_, i) => i % 2 === 0); // 11 days
    const weights = windowWeights(80, 0);
    const r = adaptiveTarget(meals, weights, 0, TODAY);
    expect(r.status === 'ready' && r.avgIntake).toBe(2000);
  });

  it("leaves today's (unfinished) meals out", () => {
    const meals = [...threeWeeksOfMeals(2000), mealOn(daysAgo(0), 300)];
    const weights = windowWeights(80, 0);
    const r = adaptiveTarget(meals, weights, 0, TODAY);
    expect(r.status === 'ready' && r.avgIntake).toBe(2000);
  });

  it('needs at least 10 logged days and a weight trend', () => {
    const weights = windowWeights(80, 0);
    const few = adaptiveTarget(threeWeeksOfMeals(2000).slice(0, 5), weights, 0, TODAY);
    expect(few).toMatchObject({ status: 'not-enough-data', loggedDays: 5, hasWeightTrend: true });

    const noWeights = adaptiveTarget(threeWeeksOfMeals(2000), [], 0, TODAY);
    expect(noWeights).toMatchObject({ status: 'not-enough-data', loggedDays: 21, hasWeightTrend: false });
  });

  it('leaves partly logged days out when given the calorie goal', () => {
    const meals = [...threeWeeksOfMeals(2000).slice(0, 15), ...Array.from({ length: 6 }, (_, i) => mealOn(daysAgo(16 + i), 500))];
    const weights = windowWeights(80, 0);
    const r = adaptiveTarget(meals, weights, 0, TODAY, 2000);
    expect(r).toMatchObject({ status: 'ready', avgIntake: 2000, loggedDays: 15, partialDays: 6 });
    // Without the goal they'd count and drag the average down.
    expect(adaptiveTarget(meals, weights, 0, TODAY)).toMatchObject({ status: 'ready', avgIntake: 1571 });
  });

  it('refuses implausible results from incomplete logging', () => {
    const weights = windowWeights(80, 0);
    expect(adaptiveTarget(threeWeeksOfMeals(400), weights, 0, TODAY).status).toBe('not-enough-data');
  });

  it('never suggests a goal below 1200 kcal', () => {
    const weights = windowWeights(80, 0);
    const r = adaptiveTarget(threeWeeksOfMeals(1300), weights, -1, TODAY);
    expect(r.status === 'ready' && r.suggestedGoal).toBe(1200);
  });
});
