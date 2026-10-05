import type { MealEntry } from '@/types';
import { toKey } from '@/lib/dateUtils';

const SEEN_KEY = 'cc_streak_seen';

export interface StreakResult {
  count: number;
  todayLogged: boolean;
}

export function calculateStreak(meals: MealEntry[]): StreakResult {
  if (meals.length === 0) return { count: 0, todayLogged: false };
  const dates = new Set(meals.map((m) => m.date));
  let count = 0;
  const today = new Date();
  const todayKey = toKey(today);
  const todayLogged = dates.has(todayKey);

  const cursor = new Date(today);
  if (!todayLogged) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dates.has(toKey(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { count, todayLogged };
}

/**
 * The celebration pops up only on milestones (the streak itself is always on
 * Home): 3, 7, 14, 21 and 30 days, then 50, 75, 100 and every 50 after.
 */
export function isStreakMilestone(streak: number): boolean {
  if ([3, 7, 14, 21, 30, 50, 75].includes(streak)) return true;
  return streak >= 100 && streak % 50 === 0;
}

/**
 * Once per milestone of a given run of days: the same streak shows twice in a
 * row when today isn't logged yet (it counts up to yesterday), and only the
 * first time should celebrate.
 */
export function shouldShowStreakPopup(streak: number, todayLogged = true): boolean {
  if (!isStreakMilestone(streak)) return false;
  const start = new Date();
  start.setDate(start.getDate() - (todayLogged ? streak - 1 : streak));
  const marker = `${toKey(start)}:${streak}`;
  try {
    if (localStorage.getItem(SEEN_KEY) === marker) return false;
  } catch {
    // ignore storage read errors
  }
  try {
    localStorage.setItem(SEEN_KEY, marker);
  } catch {
    // ignore storage write errors
  }
  return true;
}

export function getEncouragingMessage(streak: number): string {
  if (streak === 1) return "You've started your journey — keep the momentum going!";
  if (streak === 3) return 'Three days in a row! Consistency is your superpower.';
  if (streak === 7) return 'A full week of logging! You are building a real habit.';
  if (streak === 14) return 'Two weeks strong! Your dedication is inspiring.';
  if (streak === 30) return 'A whole month! This is who you are now.';
  if (streak > 30) return 'Incredible streak! You are unstoppable.';
  return `${streak} days of consistent logging. Keep showing up!`;
}
