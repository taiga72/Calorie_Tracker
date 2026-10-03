import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { MealEntry, Settings } from '@/types';

const getWeeklySummary = vi.fn();
vi.mock('@/lib/geminiCoach', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/geminiCoach')>()),
  getWeeklySummary: (...a: unknown[]) => getWeeklySummary(...a),
}));

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
  getWeeklySummary.mockReset().mockResolvedValue('**Solid week** — 1 of 2 days within `goal`. Focus on protein.');
});
afterEach(() => vi.useRealTimers());

const FRIDAY = new Date(2026, 9, 9, 18);
const WEDNESDAY = new Date(2026, 9, 7, 12);

describe('WeeklyRecapCard on Friday (end-of-week brief)', () => {
  beforeEach(() => {
    vi.setSystemTime(FRIDAY);
    meals = [meal('2026-10-05', 1800), meal('2026-10-06', 2100)];
  });

  it("shows this week's numbers and writes the brief once, without markdown", async () => {
    const { unmount } = render(<WeeklyRecapCard />);
    expect(screen.getByText('End-of-week brief')).toBeInTheDocument();
    expect(screen.getByText('1,950 kcal')).toBeInTheDocument();
    expect(screen.getByText('2/5 days logged')).toBeInTheDocument();
    expect(await screen.findByText('Solid week — 1 of 2 days within goal. Focus on protein.')).toBeInTheDocument();
    unmount();

    render(<WeeklyRecapCard />);
    expect(screen.getByText(/Solid week/)).toBeInTheDocument();
    expect(getWeeklySummary).toHaveBeenCalledTimes(1);
  });

  it('still shows the numbers if the brief fails', async () => {
    getWeeklySummary.mockRejectedValueOnce(new Error('no key'));
    render(<WeeklyRecapCard />);
    await waitFor(() => expect(screen.queryByLabelText('Writing your coach note')).not.toBeInTheDocument());
    expect(screen.getByText('1,950 kcal')).toBeInTheDocument();
  });

  it('can be dismissed for the week', () => {
    const onDismiss = vi.fn();
    render(<WeeklyRecapCard onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Dismiss weekly recap'));
    expect(onDismiss).toHaveBeenCalled();
    expect(localStorage.getItem('calorie_tracker_recap_dismissed')).toBe('2026-10-05');
  });
});

describe('WeeklyRecapCard Monday to Thursday', () => {
  beforeEach(() => {
    vi.setSystemTime(WEDNESDAY);
    meals = [meal('2026-09-28', 1800), meal('2026-09-29', 2100)];
  });

  it("shows last week with that Friday's brief, without writing a new one", () => {
    localStorage.setItem('calorie_tracker_recap_summary', JSON.stringify({ weekStart: '2026-09-28', text: 'Friday said hi.' }));
    render(<WeeklyRecapCard />);
    expect(screen.getByText('Last week')).toBeInTheDocument();
    expect(screen.getByText('Friday said hi.')).toBeInTheDocument();
    expect(getWeeklySummary).not.toHaveBeenCalled();
  });

  it('shows just the numbers when there was no brief', () => {
    render(<WeeklyRecapCard />);
    expect(screen.getByText('1,950 kcal')).toBeInTheDocument();
    expect(screen.queryByText('FRIDAY BRIEF')).not.toBeInTheDocument();
    expect(getWeeklySummary).not.toHaveBeenCalled();
  });

  it('renders nothing when the week had no logs', () => {
    meals = [];
    const { container } = render(<WeeklyRecapCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
