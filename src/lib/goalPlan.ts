import type { GoalPhase, Settings } from '@/types';
import { fromKey } from '@/lib/dateUtils';
import { macroTargets } from '@/lib/macros';

/**
 * The calorie goal for a given day: the goal phase in effect then (cut,
 * maintenance, lean bulk…) or the base goal, plus that weekday's adjustment.
 * Everything that judges a day against "the goal" goes through here, so a
 * past day is judged by the goal it actually had.
 */

const MIN_DAY_GOAL = 800;

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Phases oldest first. */
export function sortedPhases(settings: Settings): GoalPhase[] {
  return [...(settings.prefs?.phases ?? [])].sort((a, b) => a.start.localeCompare(b.start));
}

/** The phase in effect on `dateKey`: the latest one that had started by then. */
export function phaseOn(settings: Settings, dateKey: string): GoalPhase | null {
  let current: GoalPhase | null = null;
  for (const p of sortedPhases(settings)) {
    if (p.start <= dateKey) current = p;
    else break;
  }
  return current;
}

/** The goal before any weekday adjustment. */
export function baseGoalOn(settings: Settings, dateKey: string): number {
  return phaseOn(settings, dateKey)?.calorieGoal ?? settings.calorieGoal;
}

export function weekdayOffset(settings: Settings, dateKey: string): number {
  const offsets = settings.prefs?.weekdayOffsets;
  if (!offsets || offsets.length !== 7) return 0;
  return Math.round(offsets[fromKey(dateKey).getDay()] || 0);
}

export function calorieGoalOn(settings: Settings, dateKey: string): number {
  return Math.max(MIN_DAY_GOAL, Math.round(baseGoalOn(settings, dateKey) + weekdayOffset(settings, dateKey)));
}

export function weeklyTargetOn(settings: Settings, dateKey: string): number {
  return phaseOn(settings, dateKey)?.weeklyWeightTarget ?? settings.weeklyWeightTarget;
}

/** Whether the goal can differ from day to day (for charts' goal line). */
export function goalVaries(settings: Settings): boolean {
  return (settings.prefs?.phases?.length ?? 0) > 0 || (settings.prefs?.weekdayOffsets ?? []).some((o) => o);
}

/** A function form, for code that judges many days. */
export function goalFor(settings: Settings): (dateKey: string) => number {
  return (dateKey) => calorieGoalOn(settings, dateKey);
}

/**
 * Protein target in grams: per kg of body weight when set (follows the
 * latest weigh-in), otherwise the fixed target from setup, if any.
 */
export function proteinTarget(settings: Settings, latestWeightKg?: number | null): number | null {
  const perKg = settings.prefs?.proteinPerKg;
  if (perKg && perKg > 0 && latestWeightKg && latestWeightKg > 0) return Math.round(latestWeightKg * perKg);
  return macroTargets(settings)?.protein ?? null;
}
