import type { MealEntry, Settings, WeightEntry } from '@/types';
import { addDays, fromKey, toKey } from '@/lib/dateUtils';
import { normalizeItemName } from '@/lib/pinnedMeals';

export interface WeeklyRecap {
  /** Monday of the recapped week (YYYY-MM-DD) — also the cache key. */
  weekStart: string;
  weekEnd: string;
  loggedDays: number;
  /** Average over logged days only (unlogged days aren't zero-calorie days). */
  avgCalories: number;
  /** Change vs. the week before, when that week was logged too. */
  avgCaloriesDelta: number | null;
  /** Logged days at or under the calorie goal (the calendar's "within goal"). */
  daysOnTarget: number;
  avgProtein: number;
  proteinTarget: number | null;
  daysProteinHit: number;
  /** Last minus first weigh-in of the week, in kg; null with fewer than two. */
  weightChangeKg: number | null;
  topFoods: { name: string; count: number }[];
  bestDay: { date: string; calories: number } | null;
}

/** Monday of the week containing `d`. */
export function startOfIsoWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // Mon = 0
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - day);
  return s;
}

/** Monday–Sunday of the week before the one containing `today`. */
export function lastWeek(today: Date): { start: string; end: string } {
  const thisMonday = startOfIsoWeek(today);
  return { start: toKey(addDays(thisMonday, -7)), end: toKey(addDays(thisMonday, -1)) };
}

function dailyTotals(meals: MealEntry[], start: string, end: string) {
  const days = new Map<string, { calories: number; protein: number }>();
  for (const m of meals) {
    if (m.date < start || m.date > end) continue;
    const d = days.get(m.date) ?? { calories: 0, protein: 0 };
    d.calories += m.calories;
    d.protein += m.protein;
    days.set(m.date, d);
  }
  return [...days.entries()].filter(([, d]) => d.calories > 0);
}

/** Title-cases a normalized name for display ("greek yogurt" → "Greek yogurt"). */
function displayName(n: string) {
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Last week's numbers, or null when nothing was logged that week. */
export function computeWeeklyRecap(meals: MealEntry[], weights: WeightEntry[], settings: Settings, today = new Date()): WeeklyRecap | null {
  const { start, end } = lastWeek(today);
  const days = dailyTotals(meals, start, end);
  if (days.length === 0) return null;

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const avgCalories = Math.round(avg(days.map(([, d]) => d.calories)));

  const prevStart = toKey(addDays(fromKey(start), -7));
  const prevEnd = toKey(addDays(fromKey(start), -1));
  const prevDays = dailyTotals(meals, prevStart, prevEnd);
  const avgCaloriesDelta = prevDays.length ? avgCalories - Math.round(avg(prevDays.map(([, d]) => d.calories))) : null;

  const proteinTarget = settings.calc?.recommendedMacros?.protein ?? null;

  const weekWeights = weights.filter((w) => w.date >= start && w.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  const weightChangeKg = weekWeights.length >= 2 ? weekWeights[weekWeights.length - 1].weight - weekWeights[0].weight : null;

  // Counted by normalized name (so "Oats (80g)" and "Oats 100 g" are one
  // food), shown by its shortest real name with bracketed portions removed —
  // usually the one without portion details.
  const foodCounts = new Map<string, { count: number; label: string }>();
  for (const m of meals) {
    if (m.date < start || m.date > end) continue;
    for (const item of m.items) {
      const n = normalizeItemName(item.name);
      if (!n) continue;
      const prev = foodCounts.get(n);
      const label = item.name.replace(/\s*\([^)]*\)/g, '').trim() || n;
      foodCounts.set(n, {
        count: (prev?.count ?? 0) + 1,
        label: prev && prev.label.length <= label.length ? prev.label : label,
      });
    }
  }
  const topFoods = [...foodCounts.values()]
    .filter((f) => f.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((f) => ({ name: displayName(f.label), count: f.count }));

  // "Best" = closest to the goal without going over.
  const under = days.filter(([, d]) => d.calories <= settings.calorieGoal);
  const best = under.sort((a, b) => b[1].calories - a[1].calories)[0];

  return {
    weekStart: start,
    weekEnd: end,
    loggedDays: days.length,
    avgCalories,
    avgCaloriesDelta,
    daysOnTarget: days.filter(([, d]) => d.calories <= settings.calorieGoal).length,
    avgProtein: Math.round(avg(days.map(([, d]) => d.protein))),
    proteinTarget,
    daysProteinHit: proteinTarget ? days.filter(([, d]) => d.protein >= proteinTarget * 0.9).length : 0,
    weightChangeKg,
    topFoods,
    bestDay: best ? { date: best[0], calories: Math.round(best[1].calories) } : null,
  };
}

// ---- Showing it on Home at the start of the week

const DISMISSED_KEY = 'calorie_tracker_recap_dismissed';
const SUMMARY_KEY = 'calorie_tracker_recap_summary';

/** Home shows the recap Monday to Wednesday, until dismissed. */
export function showRecapOnHome(today: Date, weekStart: string): boolean {
  const weekday = (today.getDay() + 6) % 7; // Mon = 0
  if (weekday > 2) return false;
  try {
    return localStorage.getItem(DISMISSED_KEY) !== weekStart;
  } catch {
    return true;
  }
}

export function dismissRecap(weekStart: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, weekStart);
  } catch {
    // ignore
  }
}

/** The AI summary is generated once per week and reused (one Gemini call a week). */
export function cachedRecapSummary(weekStart: string): string | null {
  try {
    const raw = localStorage.getItem(SUMMARY_KEY);
    const parsed = raw ? (JSON.parse(raw) as { weekStart: string; text: string }) : null;
    return parsed?.weekStart === weekStart ? parsed.text : null;
  } catch {
    return null;
  }
}

export function cacheRecapSummary(weekStart: string, text: string): void {
  try {
    localStorage.setItem(SUMMARY_KEY, JSON.stringify({ weekStart, text }));
  } catch {
    // ignore
  }
}
