import type { MealEntry, Milestone, MilestoneKind, Settings, WeightEntry } from '@/types';
import { calculateStreak } from '@/lib/streakUtils';
import { isOverGoal, isPartialDay } from '@/lib/goal';
import { calorieGoalOn } from '@/lib/goalPlan';
import { todayKey } from '@/lib/dateUtils';
import { kgToUnit } from '@/lib/units';

export interface MilestoneProgress {
  current: number;
  target: number;
  /** 0–1 */
  fraction: number;
  achieved: boolean;
}

export const MILESTONE_KINDS: { kind: MilestoneKind; label: string; unitLabel: (u: string) => string }[] = [
  { kind: 'weight', label: 'Reach a weight', unitLabel: (u) => u },
  { kind: 'streak', label: 'Logging streak', unitLabel: () => 'days' },
  { kind: 'withinGoal', label: 'Days within goal', unitLabel: () => 'days' },
  { kind: 'meals', label: 'Meals logged', unitLabel: () => 'meals' },
];

export function milestoneLabel(m: Milestone, settings: Settings): string {
  if (m.label?.trim()) return m.label.trim();
  switch (m.kind) {
    case 'weight': return `Reach ${+kgToUnit(m.target, settings.weightUnit).toFixed(1)} ${settings.weightUnit}`;
    case 'streak': return `${m.target}-day logging streak`;
    case 'withinGoal': return `${m.target} days within goal`;
    case 'meals': return `Log ${m.target} meals`;
  }
}

/** Days since the milestone was set, fully logged and within their goal (today excluded). */
function daysWithinGoalSince(meals: MealEntry[], settings: Settings, since: string): number {
  const today = todayKey();
  const perDay = new Map<string, number>();
  for (const m of meals) {
    if (m.date < since || m.date >= today) continue;
    perDay.set(m.date, (perDay.get(m.date) ?? 0) + m.calories);
  }
  let n = 0;
  for (const [date, kcal] of perDay) {
    const goal = calorieGoalOn(settings, date);
    if (kcal > 0 && !isPartialDay(kcal, goal) && !isOverGoal(kcal, goal)) n++;
  }
  return n;
}

export function milestoneProgress(m: Milestone, data: { meals: MealEntry[]; weights: WeightEntry[]; settings: Settings }): MilestoneProgress {
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  switch (m.kind) {
    case 'weight': {
      const sorted = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sorted[sorted.length - 1]?.weight;
      if (latest === undefined) return { current: NaN, target: m.target, fraction: 0, achieved: false };
      const start = m.startWeight ?? latest;
      const losing = start >= m.target;
      const achieved = losing ? latest <= m.target : latest >= m.target;
      const span = Math.abs(start - m.target);
      const fraction = achieved ? 1 : span > 0 ? clamp((losing ? start - latest : latest - start) / span) : 0;
      return { current: latest, target: m.target, fraction, achieved };
    }
    case 'streak': {
      const current = calculateStreak(data.meals).count;
      return { current, target: m.target, fraction: clamp(current / m.target), achieved: current >= m.target };
    }
    case 'withinGoal': {
      const current = daysWithinGoalSince(data.meals, data.settings, m.createdAt);
      return { current, target: m.target, fraction: clamp(current / m.target), achieved: current >= m.target };
    }
    case 'meals': {
      const current = data.meals.length;
      return { current, target: m.target, fraction: clamp(current / m.target), achieved: current >= m.target };
    }
  }
}

/** Milestones reached now that haven't been celebrated yet. */
export function newlyAchieved(milestones: Milestone[], data: Parameters<typeof milestoneProgress>[1]): Milestone[] {
  return milestones.filter((m) => !m.achievedAt && milestoneProgress(m, data).achieved);
}
