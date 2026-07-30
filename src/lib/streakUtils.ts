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

  let cursor = new Date(today);
  if (!todayLogged) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dates.has(toKey(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { count, todayLogged };
}

export function shouldShowStreakPopup(streak: number): boolean {
  if (streak <= 0) return false;
  const todayKey = toKey(new Date());
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen === todayKey) return false;
  } catch {
    // ignore storage read errors
  }
  try {
    localStorage.setItem(SEEN_KEY, todayKey);
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
