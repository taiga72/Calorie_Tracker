import type { CardLayout, GoalsCardId, HomeCardId, Prefs, StatsCardId } from '@/types';

/**
 * Which cards a screen shows, in what order (Settings → Layout). Saved
 * layouts are merged with the defaults, so cards added in later versions
 * still appear (in their default spot) for people who customized earlier.
 */

export interface LayoutDef<T extends string> {
  defaults: T[];
  hiddenByDefault: T[];
  labels: Record<T, string>;
}

export const HOME_LAYOUT: LayoutDef<HomeCardId> = {
  defaults: ['summary', 'brief', 'quickPins', 'forecast', 'milestones', 'meals'],
  hiddenByDefault: ['quickPins', 'forecast', 'milestones'],
  labels: {
    summary: "Today's summary",
    brief: 'End-of-week brief',
    quickPins: 'Quick add: pinned meals',
    forecast: 'Goal forecast',
    milestones: 'Milestones',
    meals: 'Meals today',
  },
};

export const STATS_LAYOUT: LayoutDef<StatsCardId> = {
  defaults: ['recap', 'calories', 'macros', 'weight'],
  hiddenByDefault: [],
  labels: { recap: 'Weekly recap', calories: 'Calories trend', macros: 'Macros breakdown', weight: 'Weight trend' },
};

export const GOALS_LAYOUT: LayoutDef<GoalsCardId> = {
  defaults: ['forecast', 'target', 'milestones', 'phases'],
  hiddenByDefault: [],
  labels: { phases: 'Goal plan', forecast: 'Goal forecast', target: 'Calorie target check', milestones: 'Milestones' },
};

export interface LayoutItem<T extends string> {
  id: T;
  visible: boolean;
}

export function resolveLayout<T extends string>(saved: CardLayout<T> | undefined, def: LayoutDef<T>): LayoutItem<T>[] {
  if (!saved) return def.defaults.map((id) => ({ id, visible: !def.hiddenByDefault.includes(id) }));
  const known = saved.order.filter((id) => def.defaults.includes(id));
  const order = [...new Set(known)];
  // New cards: slot them in after the card they follow by default.
  def.defaults.forEach((id, i) => {
    if (order.includes(id)) return;
    const prev = def.defaults.slice(0, i).reverse().find((p) => order.includes(p));
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, id);
  });
  return order.map((id) => ({
    id,
    visible: saved.order.includes(id) ? !saved.hidden.includes(id) : !def.hiddenByDefault.includes(id),
  }));
}

export function toLayout<T extends string>(items: LayoutItem<T>[]): CardLayout<T> {
  return { order: items.map((i) => i.id), hidden: items.filter((i) => !i.visible).map((i) => i.id) };
}

export function visibleCards<T extends string>(saved: CardLayout<T> | undefined, def: LayoutDef<T>): T[] {
  return resolveLayout(saved, def).filter((i) => i.visible).map((i) => i.id);
}

export function homeSummaryPrefs(prefs: Prefs | undefined) {
  return { weight: prefs?.homeSummary?.weight ?? true, macros: prefs?.homeSummary?.macros ?? true };
}
