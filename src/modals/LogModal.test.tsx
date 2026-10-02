import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import type { MealEntry, Settings } from '@/types';

const estimateMeal = vi.fn();
vi.mock('@/lib/gemini', () => ({
  estimateMeal: (...args: unknown[]) => estimateMeal(...args),
  compressImage: vi.fn(),
  RateLimitError: class RateLimitError extends Error {},
}));

const SETTINGS: Settings = { calorieGoal: 2000, goalWeight: 75, weeklyWeightTarget: -0.3, weightUnit: 'kg', geminiApiKey: '' };

let meals: MealEntry[];
const addMeal = vi.fn();

vi.mock('@/store', () => ({
  useStore: () => ({
    settings: SETTINGS,
    meals,
    addMeal,
    updateMeal: vi.fn(),
    logWeight: vi.fn(),
    logWeightForDate: vi.fn(),
    deleteWeight: vi.fn(),
    weights: [],
  }),
}));

const { LogModal } = await import('@/modals/LogModal');

function oatmeal(createdAt: number, calories = 350): MealEntry {
  return {
    id: `m${createdAt}`,
    date: '2026-01-01',
    mealType: 'Breakfast',
    items: [{ name: 'Oatmeal with berries', calories, protein: 12, carbs: 55, fat: 7, fiber: 8 }],
    calories,
    protein: 12,
    carbs: 55,
    fat: 7,
    fiber: 8,
    reasoning: 'Standard bowl',
    imageDatas: ['data:image/jpeg;base64,AAAA'],
    createdAt,
  };
}

function renderLog() {
  return render(<UndoToastProvider><LogModal open onClose={vi.fn()} /></UndoToastProvider>);
}

function food(name: string, calories: number, createdAt: number): MealEntry {
  return { ...oatmeal(createdAt, calories), id: `${name}${createdAt}`, items: [{ name, calories, protein: 0, carbs: 0, fat: 0, fiber: 0 }] };
}

function swipeAway(rowText: string) {
  const label = screen.getByText(rowText);
  const row = label.closest('.touch-pan-y')!;
  fireEvent.pointerDown(row, { clientX: 300, clientY: 0 });
  fireEvent.pointerMove(row, { clientX: 100, clientY: 0 });
  fireEvent.pointerUp(row, { clientX: 100, clientY: 0 });
  // The browser fires a click where the finger lifted; it must not pick the meal.
  fireEvent.click(label);
}

beforeEach(() => {
  localStorage.clear();
  meals = [];
  addMeal.mockClear();
  estimateMeal.mockClear();
});

describe('LogModal frequent meals', () => {
  it('hides the section when nothing has been logged more than once', () => {
    meals = [oatmeal(1)];
    renderLog();
    expect(screen.queryByText(/Frequent meals/)).not.toBeInTheDocument();
  });

  it('re-logs a frequent meal from history without calling Gemini', () => {
    meals = [oatmeal(2, 360), oatmeal(1)];
    renderLog();

    fireEvent.click(screen.getByText('Oatmeal with berries'));
    expect(estimateMeal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Save meal'));
    expect(addMeal).toHaveBeenCalledTimes(1);
    const saved = addMeal.mock.calls[0][0];
    expect(saved.calories).toBe(360);
    expect(saved.mealType).toBe('Breakfast');
    expect(saved.items[0].name).toBe('Oatmeal with berries');
    // The old photo isn't copied onto the new entry.
    expect(saved.imageDatas).toBeUndefined();
  });

  it('honors a meal type picked before choosing the frequent meal', () => {
    meals = [oatmeal(2), oatmeal(1)];
    renderLog();

    fireEvent.click(screen.getByText('Snack'));
    fireEvent.click(screen.getByText('Oatmeal with berries'));
    fireEvent.click(screen.getByText('Save meal'));

    expect(addMeal.mock.calls[0][0].mealType).toBe('Snack');
  });
});

describe('LogModal hiding frequent meals', () => {
  // Six distinct repeated meals, so one is held back by the 5-item limit.
  const sixFrequent = () => ['Apple', 'Bagel', 'Cereal', 'Dates', 'Eggs', 'Figs']
    .flatMap((name, i) => Array.from({ length: 7 - i }, (_, j) => food(name, 100 + i * 50, i * 10 + j)));

  it('swiping a meal away removes it without selecting it, and the next one fills in', () => {
    meals = sixFrequent();
    renderLog();
    expect(screen.queryByText('Figs')).not.toBeInTheDocument();

    swipeAway('Apple');

    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
    expect(screen.getByText('Figs')).toBeInTheDocument();
    expect(screen.queryByText('Save meal')).not.toBeInTheDocument();
  });

  it('remembers hidden meals the next time the sheet opens', () => {
    meals = sixFrequent();
    const { unmount } = renderLog();
    swipeAway('Apple');
    unmount();

    renderLog();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });

  it('brings a hidden meal back on undo', () => {
    meals = sixFrequent();
    renderLog();
    swipeAway('Apple');

    fireEvent.click(screen.getByText('Undo'));

    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.queryByText('Figs')).not.toBeInTheDocument();
  });

  it('a partial swipe (row stays) does not pick the meal; a plain tap still does', () => {
    meals = sixFrequent();
    renderLog();
    const label = screen.getByText('Apple');
    const row = label.closest('.touch-pan-y')!;

    fireEvent.pointerDown(row, { clientX: 300, clientY: 0 });
    fireEvent.pointerMove(row, { clientX: 260, clientY: 0 });
    fireEvent.pointerUp(row, { clientX: 260, clientY: 0 });
    fireEvent.click(label);
    expect(screen.queryByText('Save meal')).not.toBeInTheDocument();

    fireEvent.pointerDown(row, { clientX: 300, clientY: 0 });
    fireEvent.pointerUp(row, { clientX: 300, clientY: 0 });
    fireEvent.click(label);
    expect(screen.getByText('Save meal')).toBeInTheDocument();
  });
});
