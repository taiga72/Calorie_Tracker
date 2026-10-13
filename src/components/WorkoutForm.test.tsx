import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import type { Settings, Workout } from '@/types';

const estimateWorkout = vi.fn();
vi.mock('@/lib/workouts', async (orig) => ({
  ...(await orig<typeof import('@/lib/workouts')>()),
  estimateWorkout: (...args: unknown[]) => estimateWorkout(...args),
}));

const settings: Settings = { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: -0.5, weightUnit: 'kg', geminiApiKey: 'k' };
let workouts: Workout[] = [];
const addWorkout = vi.fn<(w: Omit<Workout, 'id' | 'createdAt'>) => string>(() => 'new-id');
const updateWorkout = vi.fn();
const deleteWorkout = vi.fn();
const restoreWorkout = vi.fn();

vi.mock('@/store', () => ({
  useStore: () => ({
    settings, weights: [{ date: '2026-10-01', weight: 80, createdAt: 1 }], workouts,
    addWorkout, updateWorkout, deleteWorkout, restoreWorkout,
  }),
}));

const { WorkoutForm } = await import('@/components/WorkoutForm');

function renderForm(props: Partial<Parameters<typeof WorkoutForm>[0]> = {}) {
  const onDone = vi.fn();
  render(<UndoToastProvider><WorkoutForm date="2026-10-13" onDone={onDone} {...props} /></UndoToastProvider>);
  return onDone;
}

beforeEach(() => {
  vi.clearAllMocks();
  workouts = [];
});

describe('WorkoutForm', () => {
  it('logs a manual workout, estimating calories from the duration', () => {
    const onDone = renderForm();
    fireEvent.change(screen.getByPlaceholderText('e.g. Morning run'), { target: { value: 'Evening run' } });
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '30' } });
    expect(screen.getByDisplayValue('280')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save workout'));
    expect(addWorkout).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-13', kind: 'cardio', name: 'Evening run', minutes: 30, calories: 280 }));
    expect(onDone).toHaveBeenCalled();
    expect(screen.getByText('Logged Evening run · 280 kcal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Undo'));
    expect(deleteWorkout).toHaveBeenCalledWith('new-id');
  });

  it('fills sets in from a description and celebrates a record', async () => {
    workouts = [{ id: 'old', date: '2026-10-01', kind: 'strength', name: 'Push', minutes: 40, calories: 150, sets: [{ exercise: 'Bench press', reps: 8, weight: 60 }], createdAt: 1 }];
    estimateWorkout.mockResolvedValueOnce({ kind: 'strength', name: 'Push day', minutes: 45, calories: 210, sets: [{ exercise: 'Bench press', reps: 8, weight: 65 }, { exercise: 'Bench press', reps: 8, weight: 65 }] });
    renderForm();
    fireEvent.change(screen.getByPlaceholderText(/brisk walk/), { target: { value: 'bench 2x8 65kg' } });
    await act(async () => { fireEvent.click(screen.getByText('Fill in with AI')); });
    expect(estimateWorkout).toHaveBeenCalledWith('k', 'bench 2x8 65kg', 80);
    expect(screen.getByDisplayValue('Push day')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Bench press')).toHaveLength(2);
    fireEvent.click(screen.getByText('Save workout'));
    expect(addWorkout).toHaveBeenCalledWith(expect.objectContaining({ sets: [{ exercise: 'Bench press', reps: 8, weight: 65 }, { exercise: 'Bench press', reps: 8, weight: 65 }] }));
    expect(screen.getByText('🏆 New record: Bench press')).toBeInTheDocument();
  });

  it('shows a friendly error with Try again', async () => {
    estimateWorkout.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderForm();
    fireEvent.change(screen.getByPlaceholderText(/brisk walk/), { target: { value: 'yoga' } });
    await act(async () => { fireEvent.click(screen.getByText('Fill in with AI')); });
    expect(screen.getByText(/connection/i)).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('repeats a recent workout with its sets', () => {
    workouts = [{ id: 'w1', date: '2026-10-10', kind: 'strength', name: 'Leg day', minutes: 50, calories: 250, sets: [{ exercise: 'Back squat', reps: 5, weight: 100 }], createdAt: 1 }];
    renderForm();
    fireEvent.click(screen.getByText('Leg day'));
    expect(screen.getByDisplayValue('Back squat')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  it('edits and deletes an existing workout', () => {
    const w: Workout = { id: 'w2', date: '2026-10-11', kind: 'cardio', name: 'Swim', minutes: 30, calories: 250, createdAt: 1 };
    renderForm({ editWorkout: w });
    fireEvent.change(screen.getByDisplayValue('30'), { target: { value: '40' } });
    fireEvent.click(screen.getByText('Save changes'));
    expect(updateWorkout).toHaveBeenCalledWith('w2', expect.objectContaining({ minutes: 40, calories: 250, date: '2026-10-11' }));
  });

  it('offers Undo after deleting', () => {
    const w: Workout = { id: 'w3', date: '2026-10-11', kind: 'cardio', name: 'Swim', minutes: 30, calories: 250, createdAt: 1 };
    renderForm({ editWorkout: w });
    fireEvent.click(screen.getByText('Delete workout'));
    expect(deleteWorkout).toHaveBeenCalledWith('w3');
    fireEvent.click(screen.getByText('Undo'));
    expect(restoreWorkout).toHaveBeenCalledWith(w);
  });
});
