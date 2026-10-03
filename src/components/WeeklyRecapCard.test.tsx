import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { MealEntry, Settings } from '@/types';

const getWeeklySummary = vi.fn();
vi.mock('@/lib/geminiCoach', () => ({ getWeeklySummary: (...a: unknown[]) => getWeeklySummary(...a) }));

const settings: Settings = { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: -0.4, weightUnit: 'kg', geminiApiKey: '' };
let meals: MealEntry[];
vi.mock('@/store', () => ({ useStore: () => ({ meals, weights: [], settings }) }));

const { WeeklyRecapCard } = await import('@/components/WeeklyRecapCard');

const meal = (date: string, calories: number): MealEntry => ({
  id: date, date, mealType: 'Lunch', items: [{ name: 'Oats', calories, protein: 50, carbs: 0, fat: 0, fiber: 0 }],
  calories, protein: 50, carbs: 0, fat: 0, fiber: 0, reasoning: '', createdAt: 1,
});

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 7, 12)); // Wed
  meals = [meal('2026-09-28', 1800), meal('2026-09-29', 2100)];
  getWeeklySummary.mockReset().mockResolvedValue('Solid week — 1 of 2 days within goal. Focus on protein.');
});
afterEach(() => vi.useRealTimers());

describe('WeeklyRecapCard', () => {
  it("shows last week's numbers and a coach note, fetched once per week", async () => {
    const { unmount } = render(<WeeklyRecapCard />);
    expect(screen.getByText('1,950 kcal')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 days')).toBeInTheDocument();
    expect(await screen.findByText(/Solid week/)).toBeInTheDocument();
    unmount();

    render(<WeeklyRecapCard />);
    expect(screen.getByText(/Solid week/)).toBeInTheDocument();
    expect(getWeeklySummary).toHaveBeenCalledTimes(1);
  });

  it('still shows the numbers if the coach note fails', async () => {
    getWeeklySummary.mockRejectedValueOnce(new Error('no key'));
    render(<WeeklyRecapCard />);
    await waitFor(() => expect(screen.queryByLabelText('Writing your coach note')).not.toBeInTheDocument());
    expect(screen.getByText('1,950 kcal')).toBeInTheDocument();
  });

  it('renders nothing when last week had no logs', () => {
    meals = [];
    const { container } = render(<WeeklyRecapCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('can be dismissed for the week', () => {
    const onDismiss = vi.fn();
    render(<WeeklyRecapCard onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Dismiss weekly recap'));
    expect(onDismiss).toHaveBeenCalled();
    expect(localStorage.getItem('calorie_tracker_recap_dismissed')).toBe('2026-09-28');
  });
});
