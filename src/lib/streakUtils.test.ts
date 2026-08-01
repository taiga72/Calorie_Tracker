import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateStreak, shouldShowStreakPopup, getEncouragingMessage } from '@/lib/streakUtils';
import { toKey, addDays } from '@/lib/dateUtils';
import type { MealEntry } from '@/types';

function mealOn(dateKey: string): MealEntry {
  return {
    id: dateKey,
    date: dateKey,
    mealType: 'Snack',
    items: [],
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    reasoning: '',
    createdAt: 0,
  };
}

const NOW = new Date(2026, 5, 15); // Monday, June 15 2026

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('calculateStreak', () => {
  it('returns zero for no meals', () => {
    expect(calculateStreak([])).toEqual({ count: 0, todayLogged: false });
  });

  it('counts consecutive days ending today when today is logged', () => {
    const meals = [mealOn(toKey(NOW)), mealOn(toKey(addDays(NOW, -1))), mealOn(toKey(addDays(NOW, -2)))];
    const result = calculateStreak(meals);
    expect(result).toEqual({ count: 3, todayLogged: true });
  });

  it('counts the streak up to yesterday when today has no entry yet', () => {
    const meals = [mealOn(toKey(addDays(NOW, -1))), mealOn(toKey(addDays(NOW, -2)))];
    const result = calculateStreak(meals);
    expect(result).toEqual({ count: 2, todayLogged: false });
  });

  it('stops counting at the first gap', () => {
    const meals = [mealOn(toKey(NOW)), mealOn(toKey(addDays(NOW, -1))), mealOn(toKey(addDays(NOW, -3)))];
    const result = calculateStreak(meals);
    expect(result).toEqual({ count: 2, todayLogged: true });
  });

  it('returns zero streak with todayLogged false when the most recent entry is not yesterday or today', () => {
    const meals = [mealOn(toKey(addDays(NOW, -5)))];
    const result = calculateStreak(meals);
    expect(result).toEqual({ count: 0, todayLogged: false });
  });

  it('is unaffected by duplicate entries on the same day', () => {
    const meals = [mealOn(toKey(NOW)), mealOn(toKey(NOW)), mealOn(toKey(addDays(NOW, -1)))];
    const result = calculateStreak(meals);
    expect(result).toEqual({ count: 2, todayLogged: true });
  });

  it('counts correctly across a month boundary', () => {
    const monthEnd = new Date(2026, 5, 1); // June 1 2026
    vi.setSystemTime(monthEnd);
    const meals = [mealOn(toKey(monthEnd)), mealOn(toKey(addDays(monthEnd, -1))), mealOn(toKey(addDays(monthEnd, -2)))];
    const result = calculateStreak(meals);
    expect(result).toEqual({ count: 3, todayLogged: true });
  });
});

describe('shouldShowStreakPopup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false for a non-positive streak', () => {
    expect(shouldShowStreakPopup(0)).toBe(false);
    expect(shouldShowStreakPopup(-1)).toBe(false);
  });

  it('returns true the first time it is checked today and records the date', () => {
    expect(shouldShowStreakPopup(3)).toBe(true);
    expect(localStorage.getItem('cc_streak_seen')).toBe(toKey(NOW));
  });

  it('returns false on a second call the same day', () => {
    expect(shouldShowStreakPopup(3)).toBe(true);
    expect(shouldShowStreakPopup(3)).toBe(false);
  });

  it('returns true again once the day changes', () => {
    expect(shouldShowStreakPopup(3)).toBe(true);
    vi.setSystemTime(addDays(NOW, 1));
    expect(shouldShowStreakPopup(3)).toBe(true);
  });

  it('still returns true when localStorage throws', () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('boom');
    });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(shouldShowStreakPopup(1)).toBe(true);
    getSpy.mockRestore();
    setSpy.mockRestore();
  });
});

describe('getEncouragingMessage', () => {
  it('has special messages for milestone streaks', () => {
    expect(getEncouragingMessage(1)).toMatch(/started your journey/i);
    expect(getEncouragingMessage(3)).toMatch(/three days/i);
    expect(getEncouragingMessage(7)).toMatch(/full week/i);
    expect(getEncouragingMessage(14)).toMatch(/two weeks/i);
    expect(getEncouragingMessage(30)).toMatch(/whole month/i);
  });

  it('uses the "unstoppable" message for anything beyond 30', () => {
    expect(getEncouragingMessage(45)).toMatch(/unstoppable/i);
  });

  it('falls back to a generic count message for non-milestone streaks', () => {
    expect(getEncouragingMessage(5)).toBe('5 days of consistent logging. Keep showing up!');
  });
});
