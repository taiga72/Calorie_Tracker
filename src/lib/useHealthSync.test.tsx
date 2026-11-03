import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Workout } from '@/types';

const updateWorkout = vi.fn();
const restoreWorkout = vi.fn();
const oldImport: Workout = { id: 'hk-A', date: '2026-11-03', kind: 'strength', name: 'Strength training', minutes: 44, calories: 277, notes: 'Apple Health (Nothing X): 416 kcal · HR avg 125 bpm', createdAt: 1 };
const typed: Workout = { id: 'w1', date: '2026-11-03', kind: 'cardio', name: 'Run', minutes: 30, calories: 300, createdAt: 2 };

vi.mock('@/lib/native', () => ({ isNative: () => true }));
vi.mock('@/store', () => ({
  useStore: () => ({ meals: [], workouts: [oldImport, typed], weights: [], settings: { weightUnit: 'kg' }, restoreWorkout, updateWorkout, logWeightForDate: vi.fn() }),
}));
vi.mock('@/lib/health', async (orig) => ({
  ...(await orig<typeof import('@/lib/health')>()),
  loadHealthPrefs: () => ({ connected: true, workouts: true, weights: false, writeMeals: false }),
  saveHealthPrefs: vi.fn(),
  newHealthWorkouts: async () => [],
  markImported: vi.fn(),
}));

const { useHealthSync } = await import('@/lib/useHealthSync');

describe('useHealthSync', () => {
  it('moves heart rate and Health calories out of the notes of workouts imported the old way', async () => {
    const { result } = renderHook(() => useHealthSync(false));
    await act(async () => { await result.current(); });
    expect(updateWorkout).toHaveBeenCalledTimes(1);
    expect(updateWorkout).toHaveBeenCalledWith('hk-A', { calories: 416, avgHeartRate: 125, notes: 'From Apple Health (Nothing X)' });
  });
});
