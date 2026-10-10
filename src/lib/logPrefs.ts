import type { MealType } from '@/types';

/** How the last meal was logged, so the log sheet can open ready for it. */
export type LogMethod = 'pinned' | 'text' | 'photo' | 'voice';

const METHOD_KEY = 'cc_last_log_method';

export function lastLogMethod(): LogMethod | null {
  try {
    const v = localStorage.getItem(METHOD_KEY);
    return v === 'pinned' || v === 'text' || v === 'photo' || v === 'voice' ? v : null;
  } catch {
    return null;
  }
}

export function rememberLogMethod(m: LogMethod): void {
  try {
    localStorage.setItem(METHOD_KEY, m);
  } catch {
    // ignore
  }
}

/** The meal you're most likely logging at this time of day. */
export function mealTypeForTime(d: Date = new Date()): MealType {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return 'Breakfast';
  if (h >= 10.5 && h < 15) return 'Lunch';
  if (h >= 17 && h < 21.5) return 'Dinner';
  return 'Snack';
}
