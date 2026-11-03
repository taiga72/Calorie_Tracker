import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import type { Workout } from '@/types';

vi.mock('@/store', () => ({
  useStore: () => ({ settings: { weightUnit: 'kg' }, deleteWorkout: vi.fn(), restoreWorkout: vi.fn() }),
}));

const { WorkoutList } = await import('@/components/ActivityCard');

describe('WorkoutList', () => {
  it('shows the average heart rate beside the duration and calories', () => {
    const w: Workout = { id: 'hk-1', date: '2026-11-03', kind: 'strength', name: 'Strength training', minutes: 44, calories: 416, avgHeartRate: 125, notes: 'From Apple Health (Nothing X)', createdAt: 1 };
    render(<UndoToastProvider><WorkoutList workouts={[w]} onEdit={() => {}} /></UndoToastProvider>);
    expect(screen.getByText('44 min · 416 kcal · avg 125 bpm')).toBeInTheDocument();
    expect(screen.getByText('From Apple Health (Nothing X)')).toBeInTheDocument();
  });
});
