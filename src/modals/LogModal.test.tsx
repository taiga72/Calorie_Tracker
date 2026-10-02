import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import type { PinnedMeal, Settings } from '@/types';

const estimateMeal = vi.fn();
vi.mock('@/lib/gemini', () => ({
  estimateMeal: (...args: unknown[]) => estimateMeal(...args),
  compressImage: vi.fn(),
  RateLimitError: class RateLimitError extends Error {},
}));

const SETTINGS: Settings = { calorieGoal: 2000, goalWeight: 75, weeklyWeightTarget: -0.3, weightUnit: 'kg', geminiApiKey: '' };

let pinned: PinnedMeal[];
const addMeal = vi.fn();
const pinMeal = vi.fn();
const unpinMeal = vi.fn((id: string) => { pinned = pinned.filter((p) => p.id !== id); });
const restorePin = vi.fn((pin: PinnedMeal) => { pinned = [pin, ...pinned]; });

vi.mock('@/store', () => ({
  useStore: () => ({
    settings: SETTINGS,
    addMeal,
    updateMeal: vi.fn(),
    logWeight: vi.fn(),
    logWeightForDate: vi.fn(),
    deleteWeight: vi.fn(),
    weights: [],
    pinned,
    pinMeal,
    unpinMeal,
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
