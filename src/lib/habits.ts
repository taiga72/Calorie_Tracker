import type { CheckIn, MealEntry, Settings, WeightEntry, Workout } from '@/types';
import { addDays, fromKey, startOfWeek, toKey } from '@/lib/dateUtils';
import { dayStatus } from '@/lib/goal';
import { calorieGoalOn, proteinTarget } from '@/lib/goalPlan';
import { fiberTarget } from '@/lib/macros';

/**
 * Streaks for good habits beyond "logged something": staying within the
 * goal, hitting protein and fiber, checking in, and active weeks.
 */

export type HabitId = 'logging' | 'withinGoal' | 'protein' | 'fiber' | 'checkin' | 'active';

export interface HabitStreak {
  id: HabitId;
  label: string;
  /** What counts, in a few words. */
  rule: string;
  unit: 'day' | 'week';
  current: number;
  best: number;
  /** The last few days (or weeks), oldest first: done, not done, or still open (today / this week). */
  recent: ('done' | 'missed' | 'open')[];
}

/** 150 minutes, or three workouts, makes an active week (the usual guideline). */
export const ACTIVE_WEEK_MINUTES = 150;
export const ACTIVE_WEEK_WORKOUTS = 3;
const RECENT_DAYS = 14;
const RECENT_WEEKS = 8;

interface Inputs {
  meals: MealEntry[];
  workouts: Workout[];
  checkins: CheckIn[];
  weights: WeightEntry[];
  settings: Settings;
  today: Date;
}

/**
 * Current and best run of consecutive periods where `done` holds, counting
 * back from the latest. The latest period is still open: it extends the
 * streak once done, but doesn't break it while it isn't yet.
 */
export function streakOf(periods: string[], done: (p: string) => boolean): { current: number; best: number } {
  let best = 0;
  let run = 0;
  for (const p of periods) {
    run = done(p) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  let current = 0;
  for (let i = periods.length - 1; i >= 0; i--) {
    if (done(periods[i])) current++;
    else if (i === periods.length - 1) continue;
    else break;
  }
  return { current, best: Math.max(best, current) };
}

function dayKeysBetween(first: string, last: string): string[] {
  const out: string[] = [];
  for (let d = fromKey(first); toKey(d) <= last; d = addDays(d, 1)) out.push(toKey(d));
  return out;
}

export function habitStreaks({ meals, workouts, checkins, weights, settings, today }: Inputs): HabitStreak[] {
  const todayKey = toKey(today);
  const totals = new Map<string, { calories: number; protein: number; fiber: number }>();
  for (const m of meals) {
    const t = totals.get(m.date) ?? { calories: 0, protein: 0, fiber: 0 };
    t.calories += m.calories;
    t.protein += m.protein;
    t.fiber += m.fiber || 0;
    totals.set(m.date, t);
  }
  const checked = new Set(checkins.filter((c) => c.sleep || c.energy || c.hunger || c.mood).map((c) => c.date));
  const firstDates = [...totals.keys(), ...checked, ...workouts.map((w) => w.date)].filter((k) => k <= todayKey).sort();
  const first = firstDates[0] ?? todayKey;
  const days = dayKeysBetween(first < toKey(addDays(today, -(RECENT_DAYS - 1))) ? first : toKey(addDays(today, -(RECENT_DAYS - 1))), todayKey);

  const latestKg = weights.length ? weights[weights.length - 1].weight : null;
  const protein = proteinTarget(settings, latestKg);

  const dayHabit = (id: HabitId, label: string, rule: string, done: (k: string) => boolean): HabitStreak => {
    const { current, best } = streakOf(days, done);
    const recent = days.slice(-RECENT_DAYS).map((k) => (done(k) ? 'done' : k === todayKey ? 'open' : 'missed') as HabitStreak['recent'][number]);
    return { id, label, rule, unit: 'day', current, best, recent };
  };

  const habits: HabitStreak[] = [
    dayHabit('logging', 'Logging', 'Any meal logged', (k) => totals.has(k)),
    // Today isn't over, so it only counts once the day has ended.
    dayHabit('withinGoal', 'Within goal', 'A full day at or under goal', (k) => {
      if (k === todayKey) return false;
      const t = totals.get(k);
      return !!t && dayStatus(t.calories, calorieGoalOn(settings, k)) === 'within';
    }),
  ];
  if (protein) {
    habits.push(dayHabit('protein', 'Protein', `${protein} g or more`, (k) => (totals.get(k)?.protein ?? 0) >= protein * 0.95));
  }
  habits.push(
    dayHabit('fiber', 'Fiber', 'About 14 g per 1,000 kcal', (k) => {
      const t = totals.get(k);
      return !!t && t.fiber >= fiberTarget(calorieGoalOn(settings, k)) * 0.95;
    }),
    dayHabit('checkin', 'Check-in', 'Daily check-in done', (k) => checked.has(k)),
  );

  // Active weeks (Sunday–Saturday, like the calendar).
  const thisWeek = startOfWeek(today);
  const firstWeek = startOfWeek(fromKey(days[0]));
  const weeks: string[] = [];
  for (let d = firstWeek; d <= thisWeek; d = addDays(d, 7)) weeks.push(toKey(d));
  const perWeek = new Map<string, { minutes: number; count: number }>();
  for (const w of workouts) {
    const k = toKey(startOfWeek(fromKey(w.date)));
    const t = perWeek.get(k) ?? { minutes: 0, count: 0 };
    t.minutes += w.minutes;
    t.count += 1;
    perWeek.set(k, t);
  }
  const active = (k: string) => {
    const t = perWeek.get(k);
    return !!t && (t.minutes >= ACTIVE_WEEK_MINUTES || t.count >= ACTIVE_WEEK_WORKOUTS);
  };
  const { current, best } = streakOf(weeks, active);
  const thisWeekKey = toKey(thisWeek);
  habits.push({
    id: 'active',
    label: 'Active weeks',
    rule: `${ACTIVE_WEEK_MINUTES}+ min or ${ACTIVE_WEEK_WORKOUTS}+ workouts`,
    unit: 'week',
    current,
    best,
    recent: weeks.slice(-RECENT_WEEKS).map((k) => (active(k) ? 'done' : k === thisWeekKey ? 'open' : 'missed')),
  });
  return habits;
}
