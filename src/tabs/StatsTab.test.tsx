import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DaySummary, Settings } from '@/types';

const settings: Settings = { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: -0.4, weightUnit: 'kg', geminiApiKey: '' };
const emptyDay = (date: string): DaySummary => ({ date, meals: [], weight: undefined, totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0 });

vi.mock('@/store', () => ({ useStore: () => ({ getDay: emptyDay, weights: [], meals: [], settings }) }));
vi.mock('@/components/WeeklyRecapCard', () => ({ WeeklyRecapCard: () => <p>Weekly recap card</p> }));
vi.mock('@/components/GoalInsights', () => ({
  GoalForecastCard: () => <p>Goal forecast card</p>,
  AdaptiveTargetCard: () => <p>Calorie target card</p>,
}));

const { StatsTab } = await import('@/tabs/StatsTab');

function swipe(el: Element, dx: number) {
  fireEvent.pointerDown(el, { clientX: 200, clientY: 300 });
  fireEvent.pointerMove(el, { clientX: 200 + dx, clientY: 300 });
  fireEvent.pointerUp(el, { clientX: 200 + dx, clientY: 300 });
}

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
