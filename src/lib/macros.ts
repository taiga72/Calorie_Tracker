import type { MacroTargets, Settings } from '@/types';

/** About 14 g of fiber per 1,000 kcal (the usual dietary guideline). */
export function fiberTarget(calorieGoal: number): number {
  return Math.round((Math.max(calorieGoal, 0) / 1000) * 14);
}

/**
 * The user's own macro targets, from the setup wizard or Settings — or null
 * when they haven't set any, rather than a made-up default.
 */
export function macroTargets(settings: Settings): MacroTargets | null {
  const m = settings.calc?.recommendedMacros;
  if (!m || (m.protein <= 0 && m.carbs <= 0 && m.fat <= 0)) return null;
  return m;
}

/**
 * Grams for display: whole numbers from 10 g up, one decimal below that
 * ("37", "4.3", "0") — the same everywhere, instead of a mix of 36.8 / 51 / 31.0.
 */
export function fmtGrams(g: number): string {
  const v = Number.isFinite(g) ? Math.max(0, g) : 0;
  if (v >= 10) return String(Math.round(v));
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
