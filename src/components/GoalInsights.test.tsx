import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import { addDays, toKey } from '@/lib/dateUtils';
import type { MealEntry, Settings, WeightEntry } from '@/types';

let meals: MealEntry[];
let weights: WeightEntry[];
let settings: Settings;
const updateSettings = vi.fn();

vi.mock('@/store', () => ({
  useStore: () => ({ meals, weights, settings, updateSettings }),
}));

const { AdaptiveTargetCard, GoalForecastCard } = await import('@/components/GoalInsights');

const daysAgo = (n: number) => toKey(addDays(new Date(), -n));

beforeEach(() => {
  updateSettings.mockClear();
  settings = { calorieGoal: 2500, goalWeight: 70, weeklyWeightTarget: 0, weightUnit: 'kg', geminiApiKey: '' };
  // 3 weeks at 2000 kcal/day with flat weight → maintenance 2000.
  meals = Array.from({ length: 21 }, (_, i) => ({
    id: `m${i}`, date: daysAgo(i + 1), mealType: 'Lunch', items: [], calories: 2000,
    protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '', createdAt: i,
  }));
  weights = Array.from({ length: 21 }, (_, i) => ({ date: daysAgo(21 - i), weight: 80, createdAt: i }));
});

describe('AdaptiveTargetCard', () => {
  it('suggests a goal from real intake vs. weight and applies it with undo', () => {
    render(<UndoToastProvider><AdaptiveTargetCard /></UndoToastProvider>);

    expect(screen.getByText('2,000 kcal', { selector: 'p.text-accent-600' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Use 2,000 kcal'));
    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ calorieGoal: 2000 }));

    fireEvent.click(screen.getByText('Undo'));
    expect(updateSettings).toHaveBeenLastCalledWith(expect.objectContaining({ calorieGoal: 2500 }));
  });

  it('confirms when the current goal already matches', () => {
    settings = { ...settings, calorieGoal: 2020 };
    render(<UndoToastProvider><AdaptiveTargetCard /></UndoToastProvider>);
    expect(screen.getByText(/right on target/)).toBeInTheDocument();
  });

  it('shows progress toward having enough data', () => {
    meals = meals.slice(0, 4);
    render(<UndoToastProvider><AdaptiveTargetCard /></UndoToastProvider>);
    expect(screen.getByText('4/10')).toBeInTheDocument();
  });
});

describe('GoalForecastCard', () => {
  it('shows the projected date when heading toward the goal', () => {
    weights = Array.from({ length: 15 }, (_, i) => ({ date: daysAgo(14 - i), weight: 80 - 0.1 * i, createdAt: i }));
    render(<UndoToastProvider><GoalForecastCard /></UndoToastProvider>);
    expect(screen.getByText(/you'll reach your goal around/)).toBeInTheDocument();
  });

  it('asks for more weigh-ins when there is no trend yet', () => {
    weights = [];
    render(<UndoToastProvider><GoalForecastCard /></UndoToastProvider>);
    expect(screen.getByText(/Log your weight a few times/)).toBeInTheDocument();
  });
});
