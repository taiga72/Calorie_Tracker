import type { MealEntry, Settings, WeightEntry, Workout } from '@/types';
import { addDays, fromKey, toKey } from '@/lib/dateUtils';
import { isOverGoal, isPartialDay } from '@/lib/goal';
import { calorieGoalOn, plannedGoalOn, weeklyTargetOn } from '@/lib/goalPlan';
import { weightTrend } from '@/lib/forecast';

/**
 * Two patterns worth catching early: a weight plateau (with its likely
 * causes, from the user's own logs) and eating noticeably more on weekends.
 */

interface Inputs {
  meals: MealEntry[];
  weights: WeightEntry[];
  workouts: Workout[];
  settings: Settings;
  today: Date;
}

function dailyTotals(meals: MealEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of meals) out.set(m.date, (out.get(m.date) ?? 0) + m.calories);
  return out;
}

/** The finished days before today, newest last. */
function pastDays(today: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => toKey(addDays(today, -(count - i))));
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// ---- Weekend pattern

/** Friday, Saturday and Sunday. */
export const isWeekend = (key: string) => [0, 5, 6].includes(fromKey(key).getDay());

export interface WeekendPattern {
  weekdayAvg: number;
  weekendAvg: number;
  /** Extra kcal per weekend day. */
  diff: number;
  weekdayDays: number;
  weekendDays: number;
  /** A budget shift that matches the pattern and keeps the weekly total: weekends +plus, Mon–Thu −minus. */
  shift: { plus: number; minus: number };
  /** Weekday goals already differ (the user has planned for it). */
  alreadyShifted: boolean;
}

export const WEEKEND_WINDOW_DAYS = 28;
export const WEEKEND_GAP_KCAL = 300;
const MAX_SHIFT_KCAL = 500;

export function weekendPattern({ meals, settings, today }: Pick<Inputs, 'meals' | 'settings' | 'today'>): WeekendPattern | null {
  const totals = dailyTotals(meals);
  const full = pastDays(today, WEEKEND_WINDOW_DAYS).filter((k) => {
    const c = totals.get(k) ?? 0;
    return c > 0 && !isPartialDay(c, plannedGoalOn(settings, k));
  });
  const weekend = full.filter(isWeekend).map((k) => totals.get(k)!);
  const weekday = full.filter((k) => !isWeekend(k)).map((k) => totals.get(k)!);
  if (weekend.length < 3 || weekday.length < 4) return null;
  const weekendAvg = Math.round(avg(weekend));
  const weekdayAvg = Math.round(avg(weekday));
  const diff = weekendAvg - weekdayAvg;
  if (diff < WEEKEND_GAP_KCAL) return null;
  // 3 weekend days × plus = 4 weekdays × minus, and plus + minus = the gap.
  const plus = Math.min(MAX_SHIFT_KCAL, Math.round(((diff * 4) / 7) / 10) * 10);
  const minus = Math.round(((plus * 3) / 4) / 10) * 10;
  const offsets = settings.prefs?.weekdayOffsets;
  return {
    weekdayAvg, weekendAvg, diff, weekdayDays: weekday.length, weekendDays: weekend.length,
    shift: { plus, minus },
    alreadyShifted: !!offsets && offsets.some((o) => o),
  };
}

/** Weekday offsets for the shift, Sunday first (like Prefs.weekdayOffsets). */
export function weekendOffsets(shift: { plus: number; minus: number }): number[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => ([0, 5, 6].includes(d) ? shift.plus : -shift.minus));
}

// ---- Plateau

export interface PlateauCause {
  id: 'logging' | 'over' | 'weekends' | 'maintenance' | 'training' | 'water';
  title: string;
  text: string;
}

export interface Plateau {
  weeks: number;
  /** Change per week over the stall (kg). */
  weeklyChangeKg: number;
  direction: 'lose' | 'gain';
  causes: PlateauCause[];
  /** About what they've been eating while the weight held — roughly maintenance now. */
  maintenance: number | null;
}

export const PLATEAU_MIN_DAYS = 21;
// Less than ~100 g a week either way is "not moving".
const FLAT_KG_PER_WEEK = 0.1;

export function plateau({ meals, weights, workouts, settings, today }: Inputs): Plateau | null {
  const todayKey = toKey(today);
  const target = weeklyTargetOn(settings, todayKey);
  if (!target) return null; // maintaining: a flat weight is the point
  const direction = target < 0 ? 'lose' : 'gain';

  const trend = weightTrend(weights, today, 28, PLATEAU_MIN_DAYS - 3);
  if (!trend || trend.points < 4) return null;
  const remaining = settings.goalWeight - trend.currentKg;
  if (Math.abs(remaining) < 0.5 || Math.sign(remaining) !== Math.sign(target)) return null; // at (or past) the goal
  const weekly = trend.slopeKgPerDay * 7;
  const movingRightWay = direction === 'lose' ? weekly < -FLAT_KG_PER_WEEK : weekly > FLAT_KG_PER_WEEK;
  if (movingRightWay) return null;

  const windowDays = Math.min(28, Math.max(PLATEAU_MIN_DAYS, trend.spanDays));
  const days = pastDays(today, windowDays);
  const totals = dailyTotals(meals);
  const full = days.filter((k) => {
    const c = totals.get(k) ?? 0;
    return c > 0 && !isPartialDay(c, calorieGoalOn(settings, k));
  });
  const causes: PlateauCause[] = [];

  const loggedShare = full.length / days.length;
  if (loggedShare < 0.7) {
    causes.push({
      id: 'logging',
      title: 'Gaps in logging',
      text: `Only ${full.length} of the last ${days.length} days were fully logged. Unlogged bites, drinks and weekends are the most common hidden cause of a stall.`,
    });
  }

  const avgIntake = full.length ? Math.round(avg(full.map((k) => totals.get(k)!))) : null;
  const avgGoal = full.length ? Math.round(avg(full.map((k) => calorieGoalOn(settings, k)))) : null;
  if (avgIntake && avgGoal && direction === 'lose' && isOverGoal(avgIntake, avgGoal)) {
    causes.push({
      id: 'over',
      title: 'Eating above the goal',
      text: `You've averaged ${avgIntake.toLocaleString()} kcal on logged days, against a goal of ${avgGoal.toLocaleString()}.`,
    });
  }

  const weekend = weekendPattern({ meals, settings, today });
  if (weekend && direction === 'lose') {
    causes.push({
      id: 'weekends',
      title: 'Bigger weekends',
      text: `Fridays to Sundays average ${weekend.diff.toLocaleString()} kcal more than the rest of the week — enough to cancel out a weekday deficit.`,
    });
  }

  // With weight flat and logging solid, what they eat is about maintenance.
  const maintenance = avgIntake && full.length >= 14 ? Math.round(avgIntake / 10) * 10 : null;
  if (maintenance && avgGoal && direction === 'lose' && !isOverGoal(avgIntake!, avgGoal) && loggedShare >= 0.7) {
    causes.push({
      id: 'maintenance',
      title: 'Your maintenance has moved',
      text: `Your weight held steady on about ${maintenance.toLocaleString()} kcal a day, so that's roughly your maintenance now — lighter bodies burn less. Around ${(maintenance - 400).toLocaleString()} kcal should get things moving again.`,
    });
  }

  const recentStart = toKey(addDays(today, -windowDays));
  const strengthBefore = workouts.some((w) => w.date < recentStart && (w.kind === 'strength' || w.sets?.length));
  const strengthNow = workouts.filter((w) => w.date >= recentStart && (w.kind === 'strength' || w.sets?.length)).length;
  if (strengthNow >= 2 && !strengthBefore) {
    causes.push({
      id: 'training',
      title: 'New training',
      text: 'You started strength training recently. Muscles hold extra water while they adapt, which can hide fat loss on the scale for 2–4 weeks.',
    });
  }


  causes.push({
    id: 'water',
    title: 'Water can mask progress',
    text: 'Salt, carbs, stress and hormones shift water weight by 1–2 kg. Keep going a week or two before changing much.',
  });

  return {
    weeks: Math.round(trend.spanDays / 7),
    weeklyChangeKg: weekly,
    direction,
    causes,
    maintenance,
  };
}
