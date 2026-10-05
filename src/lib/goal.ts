/**
 * How a day's calories compare with the goal — one set of rules for Home, the
 * calendar, Statistics, the weekly recap and the calorie target check.
 */

/** Over by up to 5% of the goal (100 kcal on 2,000) still counts as on target. */
export const GOAL_TOLERANCE = 0.05;

/**
 * A finished day under half the goal almost always means meals weren't all
 * logged. Such days are shown, but kept out of averages and goal counts so a
 * forgotten dinner doesn't read as a great day (or drag the maintenance
 * estimate down).
 */
export const PARTIAL_DAY_SHARE = 0.5;

export type DayStatus = 'empty' | 'partial' | 'within' | 'over';

export function goalTolerance(goal: number): number {
  return Math.round(Math.max(goal, 0) * GOAL_TOLERANCE);
}

export function isOverGoal(calories: number, goal: number): boolean {
  return calories > goal + goalTolerance(goal);
}

export function isPartialDay(calories: number, goal: number): boolean {
  return calories > 0 && calories < goal * PARTIAL_DAY_SHARE;
}

/**
 * `inProgress` is for today: it isn't over yet, so a low total is just
 * "so far", not a partly logged day.
 */
export function dayStatus(calories: number, goal: number, { inProgress = false }: { inProgress?: boolean } = {}): DayStatus {
  if (calories <= 0) return 'empty';
  if (isOverGoal(calories, goal)) return 'over';
  if (!inProgress && isPartialDay(calories, goal)) return 'partial';
  return 'within';
}
