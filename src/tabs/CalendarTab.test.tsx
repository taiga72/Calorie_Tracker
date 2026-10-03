import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import { toKey, addMonths, formatMonthYear, formatHeaderDate } from '@/lib/dateUtils';
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
    meals: [],
    profile: DEFAULT_PROFILE,
    addMeal: vi.fn(),
    updateMeal: vi.fn(),
    deleteMeal: vi.fn(),
    logWeight: vi.fn(),
    logWeightForDate: vi.fn(),
    deleteWeight: vi.fn(),
    weights: [] as WeightEntry[],
    pinned: [],
    pinMeal: vi.fn(),
    unpinMeal: vi.fn(),
    restorePin: vi.fn(),
    loadPhotos: vi.fn(async () => true),
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

describe('CalendarTab month swiping', () => {
  function grid(container: HTMLElement): Element {
    return container.querySelector('.touch-pan-y')!;
  }

  function swipe(el: Element, dx: number, dy = 0) {
    fireEvent.pointerDown(el, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(el, { clientX: 200 + dx, clientY: 200 + dy });
    fireEvent.pointerUp(el, { clientX: 200 + dx, clientY: 200 + dy });
  }

  const thisMonth = formatMonthYear(new Date());
  const nextMonth = formatMonthYear(addMonths(new Date(), 1));
  const prevMonth = formatMonthYear(addMonths(new Date(), -1));

  it('goes to the next month on a left swipe and the previous month on a right swipe', () => {
    days = {};
    const { container } = renderCalendar();
    expect(screen.getByText(thisMonth)).toBeInTheDocument();

    swipe(grid(container), -120);
    expect(screen.getByText(nextMonth)).toBeInTheDocument();

    swipe(grid(container), 120);
    swipe(grid(container), 120);
    expect(screen.getByText(prevMonth)).toBeInTheDocument();
  });

  it('ignores short horizontal drags and vertical drags', () => {
    days = {};
    const { container } = renderCalendar();

    swipe(grid(container), -20);
    swipe(grid(container), -30, 200);

    expect(screen.getByText(thisMonth)).toBeInTheDocument();
  });

  it('does not open a day when a horizontal drag ends on a day cell', () => {
    days = {};
    renderCalendar();
    const cell = cellFor(fromTodayDayNumber());

    // Below the month-change threshold, so the same cell stays mounted and
    // this exercises the click suppression rather than an unmount.
    fireEvent.pointerDown(cell, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(cell, { clientX: 170, clientY: 200 });
    fireEvent.pointerUp(cell, { clientX: 170, clientY: 200 });
    fireEvent.click(cell);

    expect(screen.getByText(thisMonth)).toBeInTheDocument();

    expect(screen.queryByText('Add weight')).not.toBeInTheDocument();
    expect(screen.queryByText('No weight logged this day')).not.toBeInTheDocument();
  });

  it('still opens a day on a plain tap', () => {
    days = {};
    renderCalendar();
    const cell = cellFor(fromTodayDayNumber());

    fireEvent.pointerDown(cell, { clientX: 200, clientY: 200 });
    fireEvent.pointerUp(cell, { clientX: 200, clientY: 200 });
    fireEvent.click(cell);

    expect(screen.getByText('No weight logged this day')).toBeInTheDocument();
  });

  it('always renders 6 week rows so cells keep the same size across months', () => {
    days = {};
    const { container } = renderCalendar();
    const dayGrid = () => grid(container).children[1];

    for (let i = 0; i < 14; i++) {
      expect(dayGrid().children).toHaveLength(42);
      swipe(grid(container), -120);
    }
  });

  it('slides the new month in from the side the swipe came from', () => {
    days = {};
    const { container } = renderCalendar();
    const dayGrid = () => grid(container).children[1];

    swipe(grid(container), -120);
    expect(dayGrid().className).toMatch(/calSlideFromRight/);

    swipe(grid(container), 120);
    expect(dayGrid().className).toMatch(/calSlideFromLeft/);
  });
});


describe('CalendarTab day sheet: moving between days', () => {
  const todayDate = new Date();
  const keyOffset = (n: number) => toKey(new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + n));
  const title = (n: number) => formatHeaderDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + n));

  function openToday() {
    renderCalendar();
    fireEvent.click(cellFor(fromTodayDayNumber()));
  }

  function swipe(el: Element, dx: number) {
    fireEvent.pointerDown(el, { clientX: 200, clientY: 300 });
    fireEvent.pointerMove(el, { clientX: 200 + dx, clientY: 300 });
    fireEvent.pointerUp(el, { clientX: 200 + dx, clientY: 300 });
  }

  it('goes to the next and previous day with the arrows', () => {
    days = {};
    openToday();
    expect(screen.getByText(title(0))).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next day'));
    expect(screen.getByText(title(1))).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Previous day'));
    fireEvent.click(screen.getByLabelText('Previous day'));
    expect(screen.getByText(title(-1))).toBeInTheDocument();
  });

  it('swipes left for the next day and right for the previous one', () => {
    days = {};
    openToday();
    swipe(screen.getByText('No weight logged this day'), -120);
    expect(screen.getByText(title(1))).toBeInTheDocument();
    swipe(screen.getByText('No weight logged this day'), 120);
    expect(screen.getByText(title(0))).toBeInTheDocument();
  });

  it('shows the new day’s data', () => {
    days = { [keyOffset(-1)]: { ...emptyDay(keyOffset(-1)), meals: [{ ...meal(777), date: keyOffset(-1) }], totalCalories: 777 } };
    openToday();
    fireEvent.click(screen.getByLabelText('Previous day'));
    expect(screen.getByText('777')).toBeInTheDocument();
  });

  it('a swipe on a meal row deletes-swipes the meal instead of changing day', () => {
    days = { [keyOffset(0)]: { ...emptyDay(keyOffset(0)), meals: [{ ...meal(500), date: keyOffset(0) }], totalCalories: 500 } };
    openToday();
    const row = document.querySelector('[data-swipe-row]')!;
    swipe(row, -60);
    expect(screen.getByText(title(0))).toBeInTheDocument();
  });
});
