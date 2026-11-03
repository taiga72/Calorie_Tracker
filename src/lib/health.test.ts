import { describe, expect, it, vi } from 'vitest';
import { fromHealthWorkout, kindOf, workoutName } from '@/lib/health';
import { plannedReminders, DEFAULT_REMINDERS } from '@/lib/reminders';

vi.mock('@/lib/native', () => ({ isNative: () => false, setNativeStatusBar: () => {} }));

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

  it('turns a Health workout into one here, correcting lifting calories', () => {
    const w = fromHealthWorkout({ workoutType: 'traditionalStrengthTraining', duration: 2651, totalEnergyBurned: 416, startDate: '2026-11-03T09:11:00', endDate: '2026-11-03T09:55:11', sourceName: 'CMF Watch', platformId: 'ABC' }, 124);
    expect(w).toMatchObject({ id: 'hk-ABC', date: '2026-11-03', kind: 'strength', name: 'Strength training', minutes: 44, calories: 277 });
    expect(w.notes).toBe('Apple Health (CMF Watch): 416 kcal · HR avg 124 bpm');
    const run = fromHealthWorkout({ workoutType: 'running', duration: 1800, totalEnergyBurned: 320, startDate: '2026-11-02T07:00:00', endDate: '2026-11-02T07:30:00' });
    expect(run).toMatchObject({ kind: 'cardio', calories: 320, minutes: 30, notes: 'Apple Health: 320 kcal' });
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
