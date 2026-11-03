import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Workout } from '@/types';

const updateWorkout = vi.fn();
const restoreWorkout = vi.fn();
const oldImport: Workout = { id: 'hk-A', date: '2026-11-03', kind: 'strength', name: 'Strength training', minutes: 44, calories: 277, notes: 'Apple Health (Nothing X): 416 kcal · HR avg 125 bpm', createdAt: 1 };
const tidied: Workout = { id: 'hk-B', date: '2026-11-02', kind: 'cardio', name: 'Walking', minutes: 20, calories: 90, notes: 'From Apple Health (Nothing X)', createdAt: 3 };
const withHr: Workout = { ...tidied, id: 'hk-C', avgHeartRate: 101 };
const heartRateForWorkout = vi.fn(async (_w: Workout) => 118);
const typed: Workout = { id: 'w1', date: '2026-11-03', kind: 'cardio', name: 'Run', minutes: 30, calories: 300, createdAt: 2 };

vi.mock('@/lib/native', () => ({ isNative: () => true }));
vi.mock('@/store', () => ({
  useStore: () => ({ meals: [], workouts: [oldImport, tidied, withHr, typed], weights: [], settings: { weightUnit: 'kg' }, restoreWorkout, updateWorkout, logWeightForDate: vi.fn() }),
}));
vi.mock('@/lib/health', async (orig) => ({
  ...(await orig<typeof import('@/lib/health')>()),
  loadHealthPrefs: () => ({ connected: true, workouts: true, weights: false, writeMeals: false }),
  saveHealthPrefs: vi.fn(),
  newHealthWorkouts: async () => [],
  markImported: vi.fn(),
  heartRateForWorkout: (w: Workout) => heartRateForWorkout(w),
}));

const { useHealthSync } = await import('@/lib/useHealthSync');

describe('useHealthSync', () => {
  it('moves heart rate and Health calories out of the notes of workouts imported the old way', async () => {
    const { result } = renderHook(() => useHealthSync(false));
    await act(async () => { await result.current(); });
    expect(updateWorkout).toHaveBeenCalledWith('hk-A', { calories: 416, avgHeartRate: 125, notes: 'From Apple Health (Nothing X)' });
  });

  it('reads heart rate again from Health for imported workouts saved without it, and only those', async () => {
    updateWorkout.mockClear();
    heartRateForWorkout.mockClear();
    const { result } = renderHook(() => useHealthSync(false));
    await act(async () => { await result.current(); });
    expect(heartRateForWorkout).toHaveBeenCalledTimes(1);
    expect(heartRateForWorkout).toHaveBeenCalledWith(tidied);
    expect(updateWorkout).toHaveBeenCalledWith('hk-B', { avgHeartRate: 118 });
    expect(updateWorkout).not.toHaveBeenCalledWith('hk-C', expect.anything());
    expect(updateWorkout).not.toHaveBeenCalledWith('w1', expect.anything());
  });
});
