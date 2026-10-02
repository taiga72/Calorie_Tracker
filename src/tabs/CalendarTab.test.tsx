import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import { toKey } from '@/lib/dateUtils';
import type { DaySummary, MealEntry, Profile, Settings, WeightEntry } from '@/types';

const DEFAULT_SETTINGS: Settings = {
  calorieGoal: 2000,
  goalWeight: 75,
  weeklyWeightTarget: -0.3,
  weightUnit: 'kg',
  geminiApiKey: '',
};
const DEFAULT_PROFILE: Profile = { name: '' };

const emptyDay = (date: string): DaySummary => ({
  date, meals: [], weight: undefined, totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0,
});

function meal(calories: number): MealEntry {
  return { id: 'm1', date: '', mealType: 'Lunch', items: [], calories, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '', createdAt: 1 };
}

const today = toKey(new Date());

let days: Record<string, DaySummary>;

vi.mock('@/store', () => ({
  useStore: () => ({
    getDay: (key: string) => days[key] ?? emptyDay(key),
    settings: DEFAULT_SETTINGS,
    profile: DEFAULT_PROFILE,
    addMeal: vi.fn(),
    updateMeal: vi.fn(),
    deleteMeal: vi.fn(),
    logWeight: vi.fn(),
    logWeightForDate: vi.fn(),
    deleteWeight: vi.fn(),
    weights: [] as WeightEntry[],
    refresh: vi.fn(),
    refreshing: false,
  }),
}));

const { CalendarTab } = await import('@/tabs/CalendarTab');

function renderCalendar() {
  return render(<UndoToastProvider><CalendarTab /></UndoToastProvider>);
}

function cellFor(dayNumber: string): HTMLElement {
  return screen.getByText(dayNumber).closest('button')!;
}

describe('CalendarTab heatmap', () => {
  it('tints a day under its calorie goal green', () => {
    const d = fromTodayDayNumber();
    days = { [today]: { ...emptyDay(today), meals: [meal(1500)], totalCalories: 1500 } };
    renderCalendar();
    expect(cellFor(d).className).toMatch(/bg-emerald-50/);
  });

  it('tints a day over its calorie goal rose', () => {
    const d = fromTodayDayNumber();
    days = { [today]: { ...emptyDay(today), meals: [meal(2500)], totalCalories: 2500 } };
    renderCalendar();
    expect(cellFor(d).className).toMatch(/bg-rose-50/);
  });

  it('tints a weight-only day blue', () => {
    const d = fromTodayDayNumber();
    days = { [today]: { ...emptyDay(today), weight: { date: today, weight: 70, createdAt: 1 } } };
    renderCalendar();
    expect(cellFor(d).className).toMatch(/bg-blue-50/);
  });

  it('leaves a day with nothing logged untinted', () => {
    const d = fromTodayDayNumber();
    days = {};
    renderCalendar();
    expect(cellFor(d).className).not.toMatch(/bg-(emerald|rose|blue)-50/);
  });

  it('renders the legend explaining the colors', () => {
    days = {};
    renderCalendar();
    expect(screen.getByText('Within goal')).toBeInTheDocument();
    expect(screen.getByText('Over goal')).toBeInTheDocument();
    expect(screen.getByText('Weight only')).toBeInTheDocument();
  });
});

function fromTodayDayNumber(): string {
  return String(new Date().getDate());
}
