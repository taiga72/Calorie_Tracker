import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toKey, addDays } from '@/lib/dateUtils';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import type { DaySummary, MealEntry, PinnedMeal, Profile, Settings, WeightEntry } from '@/types';

const DEFAULT_SETTINGS: Settings = {
  calorieGoal: 2200,
  goalWeight: 75,
  weeklyWeightTarget: -0.3,
  weightUnit: 'kg',
  geminiApiKey: '',
};
const DEFAULT_PROFILE: Profile = { name: '' };

const emptyDay = (date: string): DaySummary => ({
  date, meals: [], weight: undefined, totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0,
});

let weights: WeightEntry[];
let pinned: PinnedMeal[];
const getDay = vi.fn((key: string) => emptyDay(key));
const pinMeal = vi.fn((m: Omit<PinnedMeal, 'id' | 'createdAt'>) => {
  const pin = { ...m, id: 'p1', createdAt: 1 };
  pinned = [pin];
  return { pin, alreadyPinned: false };
});
const unpinMeal = vi.fn();

vi.mock('@/store', () => ({
  useStore: () => ({
    getDay,
    settings: DEFAULT_SETTINGS,
    meals: [],
    addMeal: vi.fn(),
    deleteMeal: vi.fn(),
    profile: DEFAULT_PROFILE,
    weights,
    pinned,
    pinMeal,
    unpinMeal,
    restorePin: vi.fn(),
    refresh: vi.fn(),
    refreshing: false,
  }),
}));

const { HomeTab } = await import('@/tabs/HomeTab');

function renderHomeTab() {
  return render(<UndoToastProvider><HomeTab /></UndoToastProvider>);
}

beforeEach(() => {
  weights = [];
  pinned = [];
  vi.clearAllMocks();
  getDay.mockImplementation((key: string) => emptyDay(key));
});

describe('HomeTab weight card', () => {
  it('shows "No weight logged" when there is no weight history at all', () => {
    renderHomeTab();
    expect(screen.getByText('No weight logged')).toBeInTheDocument();
  });

  it("shows today's weight without a relative-day badge when logged today", () => {
    const today = toKey(new Date());
    weights = [{ date: today, weight: 70, createdAt: 1 }];

    renderHomeTab();

    expect(screen.getByText('70.0')).toBeInTheDocument();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
  });

  it('falls back to the most recently logged weight, labeled with how long ago, when nothing was logged today', () => {
    const threeDaysAgo = toKey(addDays(new Date(), -3));
    weights = [{ date: threeDaysAgo, weight: 68.2, createdAt: 1 }];

    renderHomeTab();

    expect(screen.getByText('68.2')).toBeInTheDocument();
    expect(screen.getByText('3 days ago')).toBeInTheDocument();
  });

  it('uses the latest of several weight entries, not the first', () => {
    const today = toKey(new Date());
    const yesterday = toKey(addDays(new Date(), -1));
    weights = [
      { date: yesterday, weight: 71, createdAt: 1 },
      { date: today, weight: 70, createdAt: 2 },
    ];

    renderHomeTab();

    expect(screen.getByText('70.0')).toBeInTheDocument();
    expect(screen.queryByText('71.0')).not.toBeInTheDocument();
  });

  it("opens the weight entry form for today when the card is tapped", () => {
    renderHomeTab();
    expect(screen.queryByText('Add weight')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Log weight'));

    expect(screen.getByText('Add weight')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.0')).toBeInTheDocument();
  });
});

describe('HomeTab layout', () => {
  it('no longer shows the AI tip card or the "Total today" banner', () => {
    renderHomeTab();
    expect(screen.queryByLabelText('Refresh insight')).not.toBeInTheDocument();
    expect(screen.queryByText('Total today')).not.toBeInTheDocument();
  });
});

describe('HomeTab pinning a logged meal', () => {
  const meal: MealEntry = {
    id: 'm1', date: toKey(new Date()), mealType: 'Breakfast',
    items: [{ name: 'Oat bowl', calories: 350, protein: 12, carbs: 55, fat: 7, fiber: 8 }],
    calories: 350, protein: 12, carbs: 55, fat: 7, fiber: 8, reasoning: '', createdAt: 1,
  };

  beforeEach(() => {
    getDay.mockImplementation((key: string) => ({ ...emptyDay(key), meals: [meal], totalCalories: 350 }));
  });

  it('pins a meal from its row, with undo', () => {
    renderHomeTab();
    fireEvent.click(screen.getByLabelText('Pin meal'));

    expect(pinMeal).toHaveBeenCalledWith(expect.objectContaining({ name: 'Oat bowl', calories: 350 }));
    fireEvent.click(screen.getByText('Undo'));
    expect(unpinMeal).toHaveBeenCalledWith('p1');
  });

  it('shows an already-pinned meal as pinned and unpins it on tap', () => {
    pinned = [{ id: 'p9', name: 'Oat bowl', mealType: 'Breakfast', items: meal.items, calories: 350, protein: 12, carbs: 55, fat: 7, fiber: 8, createdAt: 1 }];
    renderHomeTab();

    fireEvent.click(screen.getByLabelText('Unpin meal'));
    expect(unpinMeal).toHaveBeenCalledWith('p9');
  });
});
