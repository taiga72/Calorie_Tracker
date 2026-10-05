import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DaySummary, MealEntry, Settings } from '@/types';
import { addDays, toKey } from '@/lib/dateUtils';

const settings: Settings = { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: -0.4, weightUnit: 'kg', geminiApiKey: '' };
const emptyDay = (date: string): DaySummary => ({ date, meals: [], weight: undefined, totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0 });

let days: Record<string, DaySummary> = {};
vi.mock('@/store', () => ({
  useStore: () => ({ getDay: (k: string) => days[k] ?? emptyDay(k), weights: [], meals: [], settings, refresh: vi.fn(), refreshing: false }),
}));

function loggedDay(daysAgo: number, calories: number, fiber = 0): DaySummary {
  const date = toKey(addDays(new Date(), -daysAgo));
  const meal = { id: date, date, mealType: 'Lunch', items: [], calories, protein: 0, carbs: 0, fat: 0, fiber, reasoning: '', createdAt: 1 } as MealEntry;
  return { ...emptyDay(date), meals: [meal], totalCalories: calories, totalFiber: fiber };
}
vi.mock('@/components/WeeklyRecapCard', () => ({ WeeklyRecapCard: () => <p>Weekly recap card</p> }));
vi.mock('@/components/GoalInsights', () => ({
  GoalForecastCard: () => <p>Goal forecast card</p>,
  AdaptiveTargetCard: () => <p>Calorie target card</p>,
  GoalPlanCard: () => <p>Goal plan card</p>,
}));
vi.mock('@/components/Milestones', () => ({ MilestonesCard: () => <p>Milestones card</p> }));

const { StatsTab } = await import('@/tabs/StatsTab');

function swipe(el: Element, dx: number) {
  fireEvent.pointerDown(el, { clientX: 200, clientY: 300 });
  fireEvent.pointerMove(el, { clientX: 200 + dx, clientY: 300 });
  fireEvent.pointerUp(el, { clientX: 200 + dx, clientY: 300 });
}

describe('StatsTab numbers', () => {
  it('leaves partly logged days out of the averages and counts 5% over as within goal', () => {
    days = Object.fromEntries([loggedDay(1, 1800, 20), loggedDay(2, 2080, 30), loggedDay(3, 400)].map((d) => [d.date, d]));
    render(<StatsTab />);
    expect(screen.getByText('3 of 6 days logged')).toBeInTheDocument();
    expect(screen.getByText('1,940')).toBeInTheDocument(); // (1800 + 2080) / 2
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByText(/1 partly logged day \(under half your goal\)/)).toBeInTheDocument();
    expect(screen.getByText('25 g/day')).toBeInTheDocument();
    days = {};
  });
});

describe('StatsTab layout', () => {
  it('shows the chosen cards in the chosen order, with the range picker above the first chart', () => {
    settings.prefs = { statsCards: { order: ['weight', 'recap', 'calories', 'macros'], hidden: ['macros'] } };
    render(<StatsTab />);
    const titles = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(titles.indexOf('Weight trend')).toBeLessThan(titles.indexOf('Calories trend'));
    expect(screen.queryByText('Macros breakdown')).not.toBeInTheDocument();
    // The range picker comes before the weight chart (the first chart now).
    const picker = screen.getByText('30 Days');
    expect(picker.compareDocumentPosition(screen.getByText('Weight trend')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(picker.compareDocumentPosition(screen.getByText('Weekly recap card')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    delete settings.prefs;
  });
});

describe('StatsTab pages', () => {
  it('opens on Trends: weekly recap, range picker and the charts', () => {
    render(<StatsTab />);
    expect(screen.getByRole('tab', { name: 'Trends' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Weekly recap card')).toBeInTheDocument();
    expect(screen.getByText('30 Days')).toBeInTheDocument();
    expect(screen.getByText('Calories trend')).toBeInTheDocument();
    expect(screen.getByText('Macros breakdown')).toBeInTheDocument();
    expect(screen.getByText('Weight trend')).toBeInTheDocument();
    expect(screen.queryByText('Goal forecast card')).not.toBeInTheDocument();
  });

  it('Goals has the forecast and calorie target check, without the range picker', () => {
    render(<StatsTab />);
    fireEvent.click(screen.getByRole('tab', { name: 'Goals' }));
    expect(screen.getByText('Goal forecast card')).toBeInTheDocument();
    expect(screen.getByText('Calorie target card')).toBeInTheDocument();
    expect(screen.getByText('Milestones card')).toBeInTheDocument();
    expect(screen.getByText('Goal plan card')).toBeInTheDocument();
    expect(screen.queryByText('30 Days')).not.toBeInTheDocument();
    expect(screen.queryByText('Calories trend')).not.toBeInTheDocument();
  });

  it('swipes between the pages', () => {
    render(<StatsTab />);
    swipe(screen.getByText('Calories trend'), -120);
    expect(screen.getByText('Goal forecast card')).toBeInTheDocument();
    swipe(screen.getByText('Goal forecast card'), 120);
    expect(screen.getByText('Calories trend')).toBeInTheDocument();
  });
});
