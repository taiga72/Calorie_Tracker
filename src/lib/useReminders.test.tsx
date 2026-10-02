import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { saveReminderConfig, DEFAULT_REMINDERS, loadFired } from '@/lib/reminders';
import { toKey } from '@/lib/dateUtils';
import type { DaySummary } from '@/types';

let day: DaySummary;
vi.mock('@/store', () => ({ useStore: () => ({ getDay: () => day }) }));

const { useReminders } = await import('@/lib/useReminders');

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 2, 14, 10));
  day = { date: '2026-10-02', meals: [], weight: { date: '2026-10-02', weight: 80, createdAt: 1 }, totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0 };
  saveReminderConfig({ ...DEFAULT_REMINDERS, enabled: true });
});

afterEach(() => vi.useRealTimers());

describe('useReminders', () => {
  it('shows a due reminder in the app and remembers it fired today', () => {
    const { result } = renderHook(() => useReminders(true));
    expect(result.current.active).toBe('Lunch');
    expect(loadFired(toKey(new Date())).has('Lunch')).toBe(true);

    act(() => result.current.dismiss());
    expect(result.current.active).toBeNull();
  });

  it('stays quiet until the app has loaded', () => {
    const { result } = renderHook(() => useReminders(false));
    expect(result.current.active).toBeNull();
  });

  it('checks again every minute', () => {
    vi.setSystemTime(new Date(2026, 9, 2, 13, 59, 30));
    day = { ...day, meals: [{ id: 'b', date: '2026-10-02', mealType: 'Breakfast', items: [], calories: 300, protein: 0, carbs: 0, fat: 0, fiber: 0, reasoning: '', createdAt: 1 }] };
    const { result } = renderHook(() => useReminders(true));
    expect(result.current.active).toBeNull();

    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.active).toBe('Lunch');
  });
});
