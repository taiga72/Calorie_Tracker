import type { MealEntry, WeightEntry } from '@/types';
import { addDays, fromKey, toKey } from '@/lib/dateUtils';

/** Roughly the energy in 1 kg of body weight change. */
export const KCAL_PER_KG = 7700;

const DAY_MS = 86_400_000;

function dayIndex(key: string): number {
  return Math.round(fromKey(key).getTime() / DAY_MS);
}

export interface WeightTrend {
  /** Fitted weight today, in kg — smooths out day-to-day water swings. */
  currentKg: number;
  slopeKgPerDay: number;
  points: number;
  spanDays: number;
}

/**
 * A least-squares line through the weigh-ins of the last `windowDays`. One
 * noisy weigh-in barely moves it, unlike "latest minus first".
 */
export function weightTrend(weights: WeightEntry[], today: Date, windowDays = 28, minSpanDays = 7): WeightTrend | null {
  const end = dayIndex(toKey(today));
  const pts = weights
    .map((w) => ({ x: dayIndex(w.date), y: w.weight }))
    .filter((p) => p.x <= end && p.x > end - windowDays);
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.x);
  const spanDays = Math.max(...xs) - Math.min(...xs);
  if (spanDays < minSpanDays) return null;

  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const slope = sxy / sxx;
  return { currentKg: my + slope * (end - mx), slopeKgPerDay: slope, points: n, spanDays };
}

export type GoalForecast =
  | { status: 'not-enough-data' }
  | { status: 'reached'; currentKg: number }
  | { status: 'off-track'; currentKg: number; weeklyChangeKg: number; remainingKg: number }
  | { status: 'on-track'; currentKg: number; weeklyChangeKg: number; remainingKg: number; date: string; weeks: number };

const REACHED_TOLERANCE_KG = 0.3;
// Slower than this (~35 g/week) is treated as "not really moving".
const MIN_MEANINGFUL_SLOPE = 0.005;
const MAX_FORECAST_DAYS = 3 * 365;

/** When the goal weight will be reached at the current pace. */
export function goalForecast(weights: WeightEntry[], goalKg: number, today = new Date()): GoalForecast {
  const trend = weightTrend(weights, today);
  if (!trend) return { status: 'not-enough-data' };
  const { currentKg, slopeKgPerDay } = trend;
  const remainingKg = goalKg - currentKg;
  if (Math.abs(remainingKg) <= REACHED_TOLERANCE_KG) return { status: 'reached', currentKg };

  const weeklyChangeKg = slopeKgPerDay * 7;
  const headingToGoal = Math.sign(slopeKgPerDay) === Math.sign(remainingKg) && Math.abs(slopeKgPerDay) >= MIN_MEANINGFUL_SLOPE;
  const days = remainingKg / slopeKgPerDay;
  if (!headingToGoal || days > MAX_FORECAST_DAYS) {
    return { status: 'off-track', currentKg, weeklyChangeKg, remainingKg };
  }
  return {
    status: 'on-track',
    currentKg,
    weeklyChangeKg,
    remainingKg,
    date: toKey(addDays(today, Math.ceil(days))),
    weeks: Math.ceil(days / 7),
  };
}

export type AdaptiveTarget =
  | { status: 'not-enough-data'; loggedDays: number; neededDays: number; hasWeightTrend: boolean }
  | {
      status: 'ready';
      /** Maintenance calories implied by what was eaten vs. how weight moved. */
      tdee: number;
      avgIntake: number;
      loggedDays: number;
      weeklyChangeKg: number;
      /** Daily goal that hits the weekly weight target at that maintenance. */
      suggestedGoal: number;
    };

export const ADAPTIVE_WINDOW_DAYS = 21;
const MIN_LOGGED_DAYS = 10;
const MIN_GOAL_KCAL = 1200;

/**
 * Estimates real maintenance calories from the last three weeks: average
 * intake on logged days, minus the energy the weight trend says was stored
 * (or plus what was burned). Today is left out since it's still in progress,
 * and unlogged days are skipped rather than counted as zero.
 */
export function adaptiveTarget(meals: MealEntry[], weights: WeightEntry[], weeklyTargetKg: number, today = new Date()): AdaptiveTarget {
  const startKey = toKey(addDays(today, -ADAPTIVE_WINDOW_DAYS));
  const endKey = toKey(addDays(today, -1));
  const perDay = new Map<string, number>();
  for (const m of meals) {
    if (m.date < startKey || m.date > endKey) continue;
    perDay.set(m.date, (perDay.get(m.date) ?? 0) + m.calories);
  }
  const intakes = [...perDay.values()].filter((c) => c > 0);
  const trend = weightTrend(weights, addDays(today, -1), ADAPTIVE_WINDOW_DAYS, 10);

  if (intakes.length < MIN_LOGGED_DAYS || !trend) {
    return { status: 'not-enough-data', loggedDays: intakes.length, neededDays: MIN_LOGGED_DAYS, hasWeightTrend: !!trend };
  }

  const avgIntake = intakes.reduce((a, b) => a + b, 0) / intakes.length;
  const tdee = avgIntake - trend.slopeKgPerDay * KCAL_PER_KG;
  // Way outside a human range means the logs don't reflect what was eaten.
  if (tdee < 1000 || tdee > 5000) {
    return { status: 'not-enough-data', loggedDays: intakes.length, neededDays: MIN_LOGGED_DAYS, hasWeightTrend: true };
  }
  const suggestedGoal = Math.max(MIN_GOAL_KCAL, Math.round((tdee + (weeklyTargetKg * KCAL_PER_KG) / 7) / 10) * 10);
  return {
    status: 'ready',
    tdee: Math.round(tdee),
    avgIntake: Math.round(avgIntake),
    loggedDays: intakes.length,
    weeklyChangeKg: trend.slopeKgPerDay * 7,
    suggestedGoal,
  };
}

export function formatForecastDate(key: string, withYear = true): string {
  return fromKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}
