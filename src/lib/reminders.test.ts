import { describe, it, expect, beforeEach } from 'vitest';
import {
  dueReminders, DEFAULT_REMINDERS, loadFired, saveFired, loadReminderConfig, saveReminderConfig,
  type ReminderConfig,
} from '@/lib/reminders';
import type { MealType } from '@/types';

const on: ReminderConfig = { ...DEFAULT_REMINDERS, enabled: true };
const at = (h: number, m = 0) => new Date(2026, 9, 2, h, m);
const status = (types: MealType[] = [], weighedIn = false) => ({ loggedMealTypes: new Set(types), weighedIn });

beforeEach(() => localStorage.clear());

describe('dueReminders', () => {
  it('does nothing while reminders are off', () => {
    expect(dueReminders(DEFAULT_REMINDERS, at(14, 5), status(), new Set())).toEqual([]);
  });

  it('fires once the time has come and the meal is not logged', () => {
    expect(dueReminders(on, at(13, 59), status(['Breakfast'], true), new Set())).toEqual([]);
    expect(dueReminders(on, at(14, 0), status(['Breakfast'], true), new Set())).toEqual(['Lunch']);
  });

  it('skips a meal that is already logged, and the weigh-in once weighed', () => {
    expect(dueReminders(on, at(14, 30), status(['Breakfast', 'Lunch'], true), new Set())).toEqual([]);
    expect(dueReminders(on, at(8, 30), status([], false), new Set())).toEqual(['weighIn']);
    expect(dueReminders(on, at(8, 30), status([], true), new Set())).toEqual([]);
  });

  it('fires each reminder at most once a day', () => {
    expect(dueReminders(on, at(14, 30), status(['Breakfast'], true), new Set(['Lunch']))).toEqual([]);
  });

  it('drops reminders missed by more than 3 hours', () => {
    // Opening the app at 21:00: breakfast (10:00) and lunch (14:00) are stale; dinner (20:30) is not.
    expect(dueReminders(on, at(21, 0), status([], true), new Set())).toEqual(['Dinner']);
  });

  it('respects individually switched-off reminders', () => {
    const noLunch = { ...on, slots: { ...on.slots, Lunch: { on: false, time: '14:00' } } };
    expect(dueReminders(noLunch, at(14, 5), status(['Breakfast'], true), new Set())).toEqual([]);
  });
});

describe('persistence', () => {
  it('round-trips the config and fills in defaults for missing slots', () => {
    expect(loadReminderConfig()).toEqual(DEFAULT_REMINDERS);
    saveReminderConfig({ ...on, slots: { ...on.slots, Dinner: { on: false, time: '19:00' } } });
    const loaded = loadReminderConfig();
    expect(loaded.enabled).toBe(true);
    expect(loaded.slots.Dinner).toEqual({ on: false, time: '19:00' });
    expect(loaded.slots.Lunch).toEqual(DEFAULT_REMINDERS.slots.Lunch);
  });

  it('forgets which reminders fired once the day changes', () => {
    saveFired('2026-10-02', new Set(['Lunch']));
    expect([...loadFired('2026-10-02')]).toEqual(['Lunch']);
    expect([...loadFired('2026-10-03')]).toEqual([]);
  });
});
