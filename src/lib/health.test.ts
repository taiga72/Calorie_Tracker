import { describe, expect, it, vi } from 'vitest';
import { fromHealthWorkout, heartRateForWorkout, kindOf, tidyHealthImport, workoutName } from '@/lib/health';
import type { Workout } from '@/types';
import { plannedReminders, DEFAULT_REMINDERS } from '@/lib/reminders';

vi.mock('@/lib/native', () => ({ isNative: () => false, setNativeStatusBar: () => {} }));
const readSamples = vi.fn();
vi.mock('@capgo/capacitor-health', () => ({ Health: { readSamples: (o: unknown) => readSamples(o) } }));

describe('Apple Health workouts', () => {
  it('sorts workout types into the app\'s kinds and names them', () => {
    expect(kindOf('traditionalStrengthTraining')).toBe('strength');
    expect(kindOf('running')).toBe('cardio');
    expect(kindOf('tennis')).toBe('sport');
    expect(kindOf('yoga')).toBe('other');
    expect(workoutName('traditionalStrengthTraining')).toBe('Strength training');
    expect(workoutName('runningTreadmill')).toBe('Treadmill run');
    expect(workoutName('tableTennis')).toBe('Table tennis');
  });

  it('turns a Health workout into one here, with Health\'s calories and average heart rate in their own fields', () => {
    const w = fromHealthWorkout({ workoutType: 'traditionalStrengthTraining', duration: 2651, totalEnergyBurned: 416, startDate: '2026-11-03T09:11:00', endDate: '2026-11-03T09:55:11', sourceName: 'CMF Watch', platformId: 'ABC' }, 124);
    expect(w).toMatchObject({ id: 'hk-ABC', date: '2026-11-03', kind: 'strength', name: 'Strength training', minutes: 44, calories: 416, avgHeartRate: 124 });
    expect(w.notes).toBe('From Apple Health (CMF Watch)');
    const run = fromHealthWorkout({ workoutType: 'running', duration: 1800, totalEnergyBurned: 320, startDate: '2026-11-02T07:00:00', endDate: '2026-11-02T07:30:00' });
    expect(run).toMatchObject({ kind: 'cardio', calories: 320, minutes: 30, notes: 'From Apple Health' });
    expect(run).not.toHaveProperty('avgHeartRate');
  });

  it('tidies a workout imported the old way: heart rate and Health calories out of the note', () => {
    const old: Workout = { id: 'hk-ABC', date: '2026-11-03', kind: 'strength', name: 'Strength training', minutes: 44, calories: 277, notes: 'Apple Health (Nothing X): 416 kcal · HR avg 125 bpm', createdAt: 1 };
    expect(tidyHealthImport(old)).toEqual({ calories: 416, avgHeartRate: 125, notes: 'From Apple Health (Nothing X)' });
  });

  it('keeps calories the user changed when tidying an old import', () => {
    const edited: Workout = { id: 'hk-A', date: '2026-11-03', kind: 'strength', name: 'Lift', minutes: 44, calories: 300, notes: 'Apple Health (Nothing X): 416 kcal · HR avg 125 bpm', createdAt: 1 };
    expect(tidyHealthImport(edited)).toEqual({ avgHeartRate: 125, notes: 'From Apple Health (Nothing X)' });
    const noHr: Workout = { id: 'hk-B', date: '2026-11-02', kind: 'cardio', name: 'Walking', minutes: 9, calories: 51, notes: 'Apple Health: 51 kcal', createdAt: 1 };
    expect(tidyHealthImport(noHr)).toEqual({ notes: 'From Apple Health' });
  });

  it('leaves alone workouts that are not old Health imports', () => {
    const tidy: Workout = { id: 'hk-C', date: '2026-11-03', kind: 'cardio', name: 'Run', minutes: 30, calories: 320, avgHeartRate: 140, notes: 'From Apple Health', createdAt: 1 };
    const typed: Workout = { id: 'w1', date: '2026-11-03', kind: 'cardio', name: 'Run', minutes: 30, calories: 320, notes: 'Apple Health: 320 kcal', createdAt: 1 };
    expect(tidyHealthImport(tidy)).toBeNull();
    expect(tidyHealthImport(typed)).toBeNull();
  });

  it('reads heart rate again from Health over the workout\'s own time', async () => {
    readSamples.mockResolvedValueOnce({ samples: [{ value: 120 }, { value: 130 }, { value: 125 }] });
    const start = Date.parse('2026-11-03T09:11:00Z');
    const w: Workout = { id: 'hk-A', date: '2026-11-03', kind: 'strength', name: 'Lift', minutes: 44, calories: 416, notes: 'From Apple Health', createdAt: start };
    expect(await heartRateForWorkout(w)).toBe(125);
    expect(readSamples).toHaveBeenCalledWith(expect.objectContaining({ dataType: 'heartRate', startDate: '2026-11-03T09:11:00.000Z', endDate: '2026-11-03T09:55:00.000Z' }));
    readSamples.mockResolvedValueOnce({ samples: [] });
    expect(await heartRateForWorkout(w)).toBeUndefined();
  });
});

describe('scheduled reminders (iPhone app)', () => {
  const config = { ...DEFAULT_REMINDERS, enabled: true };
  const at9 = new Date(2026, 10, 3, 9, 0);

  it('plans a week ahead, skipping today\'s past times and things already logged', () => {
    const plan = plannedReminders(config, at9, { loggedMealTypes: new Set(['Lunch']), weighedIn: false });
    const today = plan.filter((p) => p.at.getDate() === 3).map((p) => p.reminder);
    // 08:00 weigh-in already passed; lunch logged; breakfast 10:00 and dinner 20:30 to come.
    expect(today).toEqual(['Breakfast', 'Dinner']);
    expect(plan.filter((p) => p.at.getDate() === 4)).toHaveLength(4);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
    expect(plan[plan.length - 1].at.getDate()).toBe(9);
  });

  it('plans nothing when reminders are off', () => {
    expect(plannedReminders(DEFAULT_REMINDERS, at9, { loggedMealTypes: new Set(), weighedIn: false })).toEqual([]);
  });
});
