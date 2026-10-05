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
let settings: Settings;
let meals: MealEntry[];
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
    settings,
    meals,
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
  settings = DEFAULT_SETTINGS;
  meals = [];
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

const CALC = {
  bmr: 1600, tdee: 2400, dailyDeficit: -200, estimatedGoalDate: null,
  recommendedMacros: { protein: 140, carbs: 220, fat: 70 },
  suggestedMealSplit: { breakfast: 500, lunch: 700, dinner: 700, snack: 300 },
};
const lunchOn = (date: string, calories: number): MealEntry => ({
  id: `l-${date}`, date, mealType: 'Lunch', items: [{ name: 'Rice bowl', calories, protein: 30, carbs: 80, fat: 15, fiber: 6 }],
  calories, protein: 30, carbs: 80, fat: 15, fiber: 6, reasoning: '', createdAt: 1,
});

describe('HomeTab calorie card', () => {
  it('counts up to 5% over the goal as on target', () => {
    const today = toKey(new Date());
    getDay.mockImplementation((key: string) => (key === today ? { ...emptyDay(key), meals: [lunchOn(today, 2300)], totalCalories: 2300 } : emptyDay(key)));
    renderHomeTab();
    expect(screen.getByText('On target')).toBeInTheDocument();
    expect(screen.queryByText('OVER TARGET')).not.toBeInTheDocument();
  });

  it('shows the 7-day average of fully logged days instead of a progress %', () => {
    const d1 = toKey(addDays(new Date(), -1));
    const d2 = toKey(addDays(new Date(), -2));
    const d3 = toKey(addDays(new Date(), -3));
    const totals: Record<string, number> = { [d1]: 1900, [d2]: 2300, [d3]: 300 };
    getDay.mockImplementation((key: string) => ({ ...emptyDay(key), totalCalories: totals[key] ?? 0 }));
    renderHomeTab();
    expect(screen.getByText('7-day avg').nextSibling).toHaveTextContent('2,100 kcal');
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
  });
});

describe('HomeTab macros and streak', () => {
  it("doesn't invent macro targets before they're set", () => {
    renderHomeTab();
    expect(screen.queryByText('/128')).not.toBeInTheDocument();
    expect(screen.getByText('Set macro targets in Settings')).toBeInTheDocument();
    // Fiber's guideline comes from the calorie goal: 14 g per 1,000 kcal.
    expect(screen.getByText('/31')).toBeInTheDocument();
  });

  it('uses the targets from setup once there are some', () => {
    settings = { ...DEFAULT_SETTINGS, calc: CALC };
    renderHomeTab();
    expect(screen.getByText('/140')).toBeInTheDocument();
    expect(screen.queryByText('Set macro targets in Settings')).not.toBeInTheDocument();
  });

  it('shows the logging streak', () => {
    meals = [0, 1, 2].map((i) => lunchOn(toKey(addDays(new Date(), -i)), 600));
    renderHomeTab();
    expect(screen.getByLabelText('3 day logging streak')).toHaveTextContent('3');
  });

  it("shows each meal type's calories against its budget", () => {
    settings = { ...DEFAULT_SETTINGS, calc: CALC };
    const today = toKey(new Date());
    getDay.mockImplementation((key: string) => ({ ...emptyDay(key), meals: [lunchOn(today, 520)], totalCalories: 520 }));
    renderHomeTab();
    expect(screen.getByText(/\/ 700 kcal/)).toBeInTheDocument();
  });
});

describe('HomeTab layout choices', () => {
  it('follows the chosen cards and order', () => {
    settings = { ...DEFAULT_SETTINGS, prefs: { homeCards: { order: ['meals', 'quickPins', 'summary', 'brief', 'forecast', 'milestones'], hidden: ['brief', 'forecast', 'milestones'] }, homeSummary: { weight: false, macros: true }, showStreak: false } };
    meals = [0, 1, 2].map((i) => lunchOn(toKey(addDays(new Date(), -i)), 600));
    pinned = [{ id: 'p1', name: 'Oat bowl', mealType: 'Breakfast', items: [], calories: 350, protein: 12, carbs: 55, fat: 7, fiber: 8, createdAt: 1 }];
    renderHomeTab();
    const order = ['Meals today', 'Quick add', "TODAY'S CALORIES"].map((t) => screen.getByText(t));
    expect(order[0].compareDocumentPosition(order[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(order[1].compareDocumentPosition(order[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByLabelText('Log weight')).not.toBeInTheDocument(); // weight tile hidden
    expect(screen.getByText("TODAY'S MACROS")).toBeInTheDocument();
    expect(screen.queryByLabelText(/day logging streak/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Log Oat bowl')).toBeInTheDocument();
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
