import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toKey, addDays } from '@/lib/dateUtils';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import type { DaySummary, Profile, Settings, WeightEntry } from '@/types';

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
const getDay = vi.fn((key: string) => emptyDay(key));

vi.mock('@/store', () => ({
  useStore: () => ({
    getDay,
    settings: DEFAULT_SETTINGS,
    meals: [],
    addMeal: vi.fn(),
    deleteMeal: vi.fn(),
    profile: DEFAULT_PROFILE,
    weights,
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
