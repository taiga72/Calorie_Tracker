import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import type { MealEntry, PinnedMeal, Settings } from '@/types';

const estimateMeal = vi.fn();
const estimateItem = vi.fn();
vi.mock('@/lib/gemini', () => ({
  estimateMeal: (...args: unknown[]) => estimateMeal(...args),
  estimateItem: (...args: unknown[]) => estimateItem(...args),
  compressImage: vi.fn(),
  RateLimitError: class RateLimitError extends Error {},
}));

const SETTINGS: Settings = { calorieGoal: 2000, goalWeight: 75, weeklyWeightTarget: -0.3, weightUnit: 'kg', geminiApiKey: '' };

let pinned: PinnedMeal[];
const addMeal = vi.fn();
const pinMeal = vi.fn();
const unpinMeal = vi.fn((id: string) => { pinned = pinned.filter((p) => p.id !== id); });
const restorePin = vi.fn((pin: PinnedMeal) => { pinned = [pin, ...pinned]; });
const updatePin = vi.fn();
const updateMeal = vi.fn();

vi.mock('@/store', () => ({
  useStore: () => ({
    settings: SETTINGS,
    addMeal,
    updateMeal,
    logWeight: vi.fn(),
    logWeightForDate: vi.fn(),
    deleteWeight: vi.fn(),
    weights: [],
    pinned,
    pinMeal,
    unpinMeal,
    updatePin,
    restorePin,
  }),
}));

const { LogModal } = await import('@/modals/LogModal');

function pin(name: string, calories: number, createdAt = 1): PinnedMeal {
  return {
    id: `pin-${name}`,
    name,
    mealType: 'Breakfast',
    items: [{ name, calories, protein: 12, carbs: 55, fat: 7, fiber: 8 }],
    calories,
    protein: 12,
    carbs: 55,
    fat: 7,
    fiber: 8,
    createdAt,
  };
}

function renderLog() {
  return render(<UndoToastProvider><LogModal open onClose={vi.fn()} /></UndoToastProvider>);
}

function swipe(row: Element, toX: number) {
  fireEvent.pointerDown(row, { clientX: 300, clientY: 0 });
  fireEvent.pointerMove(row, { clientX: toX, clientY: 0 });
  fireEvent.pointerUp(row, { clientX: toX, clientY: 0 });
}

beforeEach(() => {
  pinned = [];
  vi.clearAllMocks();
});

describe('LogModal pinned meals', () => {
  it('explains how to pin when nothing is pinned yet', () => {
    renderLog();
    expect(screen.getByText(/Pin a meal you eat often/)).toBeInTheDocument();
  });

  it('re-logs a pinned meal without calling Gemini', () => {
    pinned = [pin('Oat bowl', 360)];
    renderLog();

    fireEvent.click(screen.getByText('Oat bowl'));
    expect(estimateMeal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Save meal'));
    expect(addMeal).toHaveBeenCalledTimes(1);
    const saved = addMeal.mock.calls[0][0];
    expect(saved.calories).toBe(360);
    expect(saved.mealType).toBe('Breakfast');
    expect(saved.items[0].name).toBe('Oat bowl');
    // Re-logging a pin doesn't offer to pin it again.
    expect(screen.queryByText(/Pin this meal/)).not.toBeInTheDocument();
    expect(pinMeal).not.toHaveBeenCalled();
  });

  it('honors a meal type picked before choosing the pin', () => {
    pinned = [pin('Oat bowl', 360)];
    renderLog();

    fireEvent.click(screen.getByText('Snack'));
    fireEvent.click(screen.getByText('Oat bowl'));
    fireEvent.click(screen.getByText('Save meal'));

    expect(addMeal.mock.calls[0][0].mealType).toBe('Snack');
  });

  it('swiping a pin away unpins it without selecting it, with undo', () => {
    pinned = [pin('Oat bowl', 360)];
    renderLog();
    const label = screen.getByText('Oat bowl');

    swipe(label.closest('.touch-pan-y')!, 100);
    // The browser fires a click where the finger lifted; it must not pick the meal.
    fireEvent.click(label);

    expect(unpinMeal).toHaveBeenCalledWith('pin-Oat bowl');
    expect(screen.queryByText('Save meal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Undo'));
    expect(restorePin).toHaveBeenCalledWith(expect.objectContaining({ id: 'pin-Oat bowl' }));
  });

  it('a partial swipe does not pick the pin; a plain tap still does', () => {
    pinned = [pin('Oat bowl', 360)];
    renderLog();
    const label = screen.getByText('Oat bowl');
    const row = label.closest('.touch-pan-y')!;

    swipe(row, 260);
    fireEvent.click(label);
    expect(screen.queryByText('Save meal')).not.toBeInTheDocument();

    fireEvent.pointerDown(row, { clientX: 300, clientY: 0 });
    fireEvent.pointerUp(row, { clientX: 300, clientY: 0 });
    fireEvent.click(label);
    expect(screen.getByText('Save meal')).toBeInTheDocument();
  });
});

describe('LogModal pinning an AI estimate', () => {
  const estimate = {
    mealType: 'Lunch', items: [{ name: 'Chicken rice bowl', calories: 640, protein: 40, carbs: 70, fat: 18, fiber: 4 }],
    calories: 640, protein: 40, carbs: 70, fat: 18, fiber: 4, reasoning: 'Typical bowl',
  };

  async function estimateBowl() {
    estimateMeal.mockResolvedValueOnce({ ...estimate });
    fireEvent.change(screen.getByPlaceholderText(/grilled chicken/), { target: { value: 'chicken rice bowl' } });
    fireEvent.click(screen.getByText('Estimate with AI'));
    await screen.findByText('Save meal');
  }

  it('pins the meal on save when the toggle is on', async () => {
    renderLog();
    await estimateBowl();

    fireEvent.click(screen.getByText(/Pin this meal/));
    fireEvent.click(screen.getByText('Save meal'));

    expect(pinMeal).toHaveBeenCalledWith(expect.objectContaining({ name: 'Chicken rice bowl', calories: 640, mealType: 'Lunch' }));
    expect(addMeal).toHaveBeenCalledTimes(1);
  });

  it('does not pin by default', async () => {
    renderLog();
    await estimateBowl();
    fireEvent.click(screen.getByText('Save meal'));
    expect(pinMeal).not.toHaveBeenCalled();
  });

  it('says so instead of offering the toggle when the same meal is already pinned', async () => {
    pinned = [{ ...pin('Chicken rice bowl (large)', 650), mealType: 'Lunch' }];
    renderLog();
    await estimateBowl();
    expect(screen.getByText('Already in your pinned meals')).toBeInTheDocument();
    expect(screen.queryByText(/Pin this meal/)).not.toBeInTheDocument();
  });
});

describe('LogModal editing a pin', () => {
  it('renames a pin and changes its type', () => {
    pinned = [pin('Oat bowl', 400)];
    renderLog();

    fireEvent.click(screen.getByLabelText('Edit Oat bowl'));
    expect(screen.getByText('Edit pinned meal')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Usual oats' } });
    fireEvent.click(screen.getByText('Snack'));
    fireEvent.click(screen.getByText('Save pin'));

    expect(updatePin).toHaveBeenCalledWith('pin-Oat bowl', expect.objectContaining({ name: 'Usual oats', mealType: 'Snack', calories: 400 }));
    // Back to the normal Quick log view.
    expect(screen.getByText('Estimate with AI')).toBeInTheDocument();
  });

  it('scales macros and items when calories change', () => {
    pinned = [pin('Oat bowl', 400)]; // P 12, C 55, F 7, Fb 8
    renderLog();
    fireEvent.click(screen.getByLabelText('Edit Oat bowl'));

    const kcal = screen.getByLabelText('Calories');
    fireEvent.change(kcal, { target: { value: '200' } });
    fireEvent.blur(kcal);
    expect(screen.getByLabelText('Protein (g)')).toHaveValue(6);
    fireEvent.click(screen.getByText('Save pin'));

    const patch = updatePin.mock.calls[0][1];
    expect(patch).toMatchObject({ calories: 200, protein: 6, carbs: 27.5, fat: 3.5, fiber: 4 });
    expect(patch.items[0].calories).toBe(200);
  });

  it('cancel leaves the pin unchanged', () => {
    pinned = [pin('Oat bowl', 400)];
    renderLog();
    fireEvent.click(screen.getByLabelText('Edit Oat bowl'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(updatePin).not.toHaveBeenCalled();
    expect(screen.getByText('Oat bowl')).toBeInTheDocument();
  });

  it('deletes a pin from the editor, with undo', () => {
    pinned = [pin('Oat bowl', 400)];
    renderLog();
    fireEvent.click(screen.getByLabelText('Edit Oat bowl'));
    fireEvent.click(screen.getByLabelText('Delete pin'));
    expect(unpinMeal).toHaveBeenCalledWith('pin-Oat bowl');
    fireEvent.click(screen.getByText('Undo'));
    expect(restorePin).toHaveBeenCalled();
  });
});

describe('LogModal voice input', () => {
  class FakeRecognition {
    static last: FakeRecognition | null = null;
    lang = '';
    interimResults = false;
    continuous = false;
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn(() => { FakeRecognition.last = this; });
    stop = vi.fn(() => this.onend?.());
    abort = vi.fn();
    say(parts: [string, boolean][]) {
      const results = parts.map(([t, isFinal]) => ({ isFinal, 0: { transcript: t } }));
      act(() => this.onresult?.({ resultIndex: 0, results }));
    }
  }

  beforeEach(() => {
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FakeRecognition;
  });
  afterEach(() => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });

  it('fills the description as you speak', () => {
    renderLog();
    fireEvent.click(screen.getByLabelText('Speak your meal'));
    expect(screen.getByText(/Listening/)).toBeInTheDocument();

    FakeRecognition.last!.say([['two eggs', false]]);
    expect(screen.getByRole('textbox')).toHaveValue('two eggs');
    FakeRecognition.last!.say([['two eggs and toast', true]]);
    expect(screen.getByRole('textbox')).toHaveValue('two eggs and toast');
  });

  it('adds dictation after what was already typed', () => {
    renderLog();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'coffee' } });
    fireEvent.click(screen.getByLabelText('Speak your meal'));
    FakeRecognition.last!.say([['banana', true]]);
    expect(screen.getByRole('textbox')).toHaveValue('coffee, banana');
  });

  it('explains when the microphone is blocked', () => {
    renderLog();
    fireEvent.click(screen.getByLabelText('Speak your meal'));
    act(() => {
      FakeRecognition.last!.onerror?.({ error: 'not-allowed' });
      FakeRecognition.last!.onend?.();
    });
    expect(screen.getByText(/Microphone access is blocked/)).toBeInTheDocument();
  });

  it('tapping again stops listening', () => {
    renderLog();
    fireEvent.click(screen.getByLabelText('Speak your meal'));
    fireEvent.click(screen.getByLabelText('Stop voice input'));
    expect(FakeRecognition.last!.stop).toHaveBeenCalled();
    expect(screen.queryByText(/Listening/)).not.toBeInTheDocument();
  });

  it('hides the mic where the browser has no speech recognition', () => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    renderLog();
    expect(screen.queryByLabelText('Speak your meal')).not.toBeInTheDocument();
  });
});

describe('LogModal editing a meal', () => {
  const meal: MealEntry = {
    id: 'm1', date: '2026-10-01', mealType: 'Lunch',
    items: [{ name: 'Rice bowl', calories: 600, protein: 30, carbs: 80, fat: 15, fiber: 6 }],
    calories: 600, protein: 30, carbs: 80, fat: 15, fiber: 6, reasoning: '', createdAt: 1,
  };
  const renderEdit = () => render(<UndoToastProvider><LogModal open onClose={vi.fn()} editMeal={meal} /></UndoToastProvider>);

  it('keeps the day unless it is changed', () => {
    renderEdit();
    fireEvent.click(screen.getByText('Save changes'));
    expect(updateMeal).toHaveBeenCalledWith('m1', expect.not.objectContaining({ date: expect.anything() }));
  });

  it('moves the meal to another day', () => {
    renderEdit();
    fireEvent.change(screen.getByLabelText('Meal date'), { target: { value: '2026-09-30' } });
    expect(screen.getByText(/Will move to/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save changes'));
    expect(updateMeal).toHaveBeenCalledWith('m1', expect.objectContaining({ date: '2026-09-30', mealType: 'Lunch' }));
  });
});

describe('LogModal re-estimating one item', () => {
  const twoItems: MealEntry = {
    id: 'm2', date: '2026-10-01', mealType: 'Dinner',
    items: [
      { name: 'Rice 1 cup', calories: 200, protein: 4, carbs: 45, fat: 0.5, fiber: 1 },
      { name: 'Chicken 100g', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
    ],
    calories: 365, protein: 35, carbs: 45, fat: 4.1, fiber: 1, reasoning: '', createdAt: 1,
  };

  it('re-estimates just that item in a saved meal, keeping the others', async () => {
    estimateItem.mockResolvedValueOnce({ name: 'Chicken 200g', calories: 330, protein: 62, carbs: 0, fat: 7.2, fiber: 0 });
    render(<UndoToastProvider><LogModal open onClose={vi.fn()} editMeal={twoItems} /></UndoToastProvider>);
    fireEvent.click(screen.getByText(/Items \(2\)/));
    fireEvent.click(screen.getByLabelText('Re-estimate Chicken 100g'));
    fireEvent.change(screen.getByLabelText('Describe this item'), { target: { value: 'Chicken 200g' } });
    await act(async () => { fireEvent.click(screen.getByText('Estimate')); });

    expect(estimateItem).toHaveBeenCalledWith('', 'Chicken 200g', ['Rice 1 cup']);
    fireEvent.click(screen.getByText('Save changes'));
    expect(updateMeal).toHaveBeenCalledWith('m2', expect.objectContaining({
      calories: 530,
      items: [twoItems.items[0], expect.objectContaining({ name: 'Chicken 200g', calories: 330 })],
    }));
  });

  it('re-estimates one item of a new AI result before saving', async () => {
    estimateMeal.mockResolvedValueOnce({ mealType: 'Dinner', items: twoItems.items, calories: 365, protein: 35, carbs: 45, fat: 4.1, fiber: 1, reasoning: '' });
    estimateItem.mockResolvedValueOnce({ name: 'Brown rice 1.5 cups', calories: 330, protein: 7, carbs: 69, fat: 2.6, fiber: 5 });
    renderLog();
    fireEvent.click(screen.getByText('Text'));
    fireEvent.change(screen.getByPlaceholderText(/grilled chicken breast 200g/), { target: { value: 'rice and chicken' } });
    await act(async () => { fireEvent.click(screen.getByText(/Estimate with AI|Analyze|Estimate/)); });
    fireEvent.click(screen.getByLabelText('Re-estimate Rice 1 cup'));
    fireEvent.change(screen.getByLabelText('Describe this item'), { target: { value: 'Brown rice 1.5 cups' } });
    await act(async () => { fireEvent.click(screen.getAllByText('Estimate').pop()!); });

    expect(screen.getByText('Brown rice 1.5 cups')).toBeInTheDocument();
    expect(screen.getByText('495 kcal')).toBeInTheDocument(); // 330 + 165
  });
});

describe('LogModal pinning one food', () => {
  it('pins a single food from a new AI result', async () => {
    estimateMeal.mockResolvedValueOnce({
      mealType: 'Lunch',
      items: [
        { name: 'Rice 1 cup', calories: 200, protein: 4, carbs: 45, fat: 0.5, fiber: 1 },
        { name: 'Chicken 100g', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
      ],
      calories: 365, protein: 35, carbs: 45, fat: 4.1, fiber: 1, reasoning: '',
    });
    pinMeal.mockReturnValueOnce({ pin: { id: 'px' }, alreadyPinned: false });
    renderLog();
    fireEvent.click(screen.getByText('Text'));
    fireEvent.change(screen.getByPlaceholderText(/grilled chicken breast 200g/), { target: { value: 'rice and chicken' } });
    await act(async () => { fireEvent.click(screen.getByText(/Estimate with AI|Analyze|Estimate/)); });
    fireEvent.click(screen.getByLabelText('Pin Chicken 100g'));
    expect(pinMeal).toHaveBeenCalledWith(expect.objectContaining({ name: 'Chicken 100g', mealType: 'Lunch', calories: 165 }));
  });
});
