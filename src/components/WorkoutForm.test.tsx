import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import type { Settings, Workout } from '@/types';

const estimateWorkout = vi.fn();
const readWatchScreenshots = vi.fn();
vi.mock('@/lib/workouts', async (orig) => ({
  ...(await orig<typeof import('@/lib/workouts')>()),
  estimateWorkout: (...args: unknown[]) => estimateWorkout(...args),
  readWatchScreenshots: (...args: unknown[]) => readWatchScreenshots(...args),
}));
vi.mock('@/lib/gemini', async (orig) => ({
  ...(await orig<typeof import('@/lib/gemini')>()),
  compressImage: async () => ({ dataUrl: 'data:image/jpeg;base64,AAA', base64: { data: 'AAA', mimeType: 'image/jpeg' } }),
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
  localStorage.clear();
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
    // Both sets under one exercise.
    expect(screen.getAllByDisplayValue('Bench press')).toHaveLength(1);
    expect(screen.getByLabelText('Exercise 1 set 2 reps')).toHaveValue('8');
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

  it('moves a workout to another day', () => {
    const w: Workout = { id: 'w4', date: '2026-10-11', kind: 'cardio', name: 'Swim', minutes: 30, calories: 250, createdAt: 1 };
    renderForm({ editWorkout: w });
    fireEvent.change(screen.getByLabelText('Workout date'), { target: { value: '2026-10-09' } });
    expect(screen.getByText(/Will move to/)).toBeTruthy();
    fireEvent.click(screen.getByText('Save changes'));
    expect(updateWorkout).toHaveBeenCalledWith('w4', expect.objectContaining({ date: '2026-10-09' }));
  });

  it('has no day picker when logging a new workout', () => {
    renderForm();
    expect(screen.queryByLabelText('Workout date')).toBeNull();
  });

  it('takes decimal weights with a comma or a point, in kg or lb', () => {
    renderForm();
    fireEvent.click(screen.getByText('Strength'));
    fireEvent.change(screen.getByPlaceholderText(/Upper body/), { target: { value: 'Push' } });
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.change(screen.getByLabelText('Exercise 1 name'), { target: { value: 'Incline bench' } });
    fireEvent.change(screen.getByLabelText('Exercise 1 set 1 reps'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Exercise 1 set 1 weight'), { target: { value: '22,5' } });
    expect(screen.getByLabelText('Exercise 1 set 1 weight')).toHaveValue('22,5');
    fireEvent.click(screen.getByLabelText('Add set to exercise 1'));
    fireEvent.change(screen.getByLabelText('Exercise 1 set 2 weight'), { target: { value: '22.5' } });
    fireEvent.change(screen.getByLabelText('Exercise 1 weight unit'), { target: { value: 'lb' } });
    fireEvent.click(screen.getByText('Save workout'));
    const saved = addWorkout.mock.calls[0][0];
    // 22.5 lb ≈ 10.21 kg, stored in kg.
    expect(saved.sets?.map((x) => x.weight)).toEqual([10.21, 10.21]);
  });

  it('groups sets by exercise: add exercises, each with its own sets', () => {
    renderForm();
    fireEvent.click(screen.getByText('Strength'));
    fireEvent.change(screen.getByPlaceholderText(/Upper body/), { target: { value: 'Push day' } });
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.change(screen.getByLabelText('Exercise 1 name'), { target: { value: 'Bench press' } });
    fireEvent.change(screen.getByLabelText('Exercise 1 set 1 reps'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Exercise 1 set 1 weight'), { target: { value: '60' } });
    // A new set copies the one before.
    fireEvent.click(screen.getByLabelText('Add set to exercise 1'));
    expect(screen.getByLabelText('Exercise 1 set 2 weight')).toHaveValue('60');
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.change(screen.getByLabelText('Exercise 2 name'), { target: { value: 'Dips' } });
    fireEvent.change(screen.getByLabelText('Exercise 2 set 1 reps'), { target: { value: '12' } });
    fireEvent.click(screen.getByText('Save workout'));
    expect(addWorkout.mock.calls[0][0].sets).toEqual([
      { exercise: 'Bench press', reps: 8, weight: 60 },
      { exercise: 'Bench press', reps: 8, weight: 60 },
      { exercise: 'Dips', reps: 12, weight: 0 },
    ]);
  });

  it('opens a saved workout grouped by exercise, and can drop a whole exercise', () => {
    const w: Workout = { id: 'w9', date: '2026-10-11', kind: 'strength', name: 'Push', minutes: 45, calories: 250, createdAt: 1, sets: [
      { exercise: 'Bench press', reps: 8, weight: 60 }, { exercise: 'Dips', reps: 10, weight: 0 }, { exercise: 'Bench press', reps: 6, weight: 65 },
    ] };
    renderForm({ editWorkout: w });
    expect(screen.getByLabelText('Exercise 1 name')).toHaveValue('Bench press');
    expect(screen.getByLabelText('Exercise 1 set 2 weight')).toHaveValue('65');
    expect(screen.getByLabelText('Exercise 2 name')).toHaveValue('Dips');
    fireEvent.click(screen.getByLabelText('Remove exercise 2'));
    fireEvent.click(screen.getByText('Save changes'));
    expect(updateWorkout).toHaveBeenCalledWith('w9', expect.objectContaining({ sets: [
      { exercise: 'Bench press', reps: 8, weight: 60 }, { exercise: 'Bench press', reps: 6, weight: 65 },
    ] }));
  });

  it('lets each exercise use its own unit, and remembers it next time', () => {
    renderForm();
    fireEvent.click(screen.getByText('Strength'));
    fireEvent.change(screen.getByPlaceholderText(/Upper body/), { target: { value: 'Arms' } });
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.change(screen.getByLabelText('Exercise 1 name'), { target: { value: 'Barbell curl' } });
    fireEvent.change(screen.getByLabelText('Exercise 1 set 1 reps'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Exercise 1 set 1 weight'), { target: { value: '30' } });
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.change(screen.getByLabelText('Exercise 2 name'), { target: { value: 'Dumbbell curl' } });
    fireEvent.change(screen.getByLabelText('Exercise 2 weight unit'), { target: { value: 'lb' } });
    fireEvent.change(screen.getByLabelText('Exercise 2 set 1 reps'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Exercise 2 set 1 weight'), { target: { value: '25' } });
    expect(screen.getByLabelText('Exercise 1 weight unit')).toHaveValue('kg');
    fireEvent.click(screen.getByText('Save workout'));
    expect(addWorkout.mock.calls[0][0].sets).toEqual([
      { exercise: 'Barbell curl', reps: 10, weight: 30 },
      { exercise: 'Dumbbell curl', reps: 12, weight: 11.34 },
    ]);
    cleanup();

    // Next time, naming the exercise brings lb back.
    renderForm();
    fireEvent.click(screen.getByText('Strength'));
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.change(screen.getByLabelText('Exercise 1 name'), { target: { value: 'dumbbell curl' } });
    expect(screen.getByLabelText('Exercise 1 weight unit')).toHaveValue('lb');
  });

  it('imports a watch screenshot, keeping the exercises already typed', async () => {
    readWatchScreenshots.mockResolvedValueOnce({ kind: 'strength', name: 'Strength training', minutes: 44, calories: 277, watchCalories: 416, avgHeartRate: 124, maxHeartRate: 142 });
    renderForm();
    fireEvent.click(screen.getByText('Strength'));
    fireEvent.change(screen.getByPlaceholderText(/Upper body/), { target: { value: 'Push Workout' } });
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.change(screen.getByLabelText('Exercise 1 name'), { target: { value: 'Incline bench' } });
    fireEvent.change(screen.getByLabelText('Exercise 1 set 1 reps'), { target: { value: '8' } });
    const shot = new File(['x'], 'watch.png', { type: 'image/png' });
    await act(async () => { fireEvent.change(screen.getByLabelText('Watch screenshots'), { target: { files: [shot] } }); });
    expect(readWatchScreenshots).toHaveBeenCalledWith('k', [{ data: 'AAA', mimeType: 'image/jpeg' }]);
    expect(screen.getByDisplayValue('Push Workout')).toBeInTheDocument();
    expect(screen.getByDisplayValue('44')).toBeInTheDocument();
    expect(screen.getByDisplayValue('277')).toBeInTheDocument();
    expect(screen.getByText(/It said 416 kcal/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save workout'));
    expect(addWorkout).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Push Workout', minutes: 44, calories: 277, notes: 'Watch: 416 kcal · HR avg 124, max 142 bpm',
      sets: [{ exercise: 'Incline bench', reps: 8, weight: 0 }],
    }));
  });
});
