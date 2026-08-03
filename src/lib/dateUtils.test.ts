import { describe, it, expect } from 'vitest';
import {
  toKey,
  fromKey,
  isSameDay,
  isToday,
  formatHeaderDate,
  formatMonthYear,
  formatShortDate,
  weekdayShort,
  daysInMonth,
  firstWeekdayOfMonth,
  addDays,
  addMonths,
  startOfWeek,
  rangeKeys,
} from '@/lib/dateUtils';

describe('toKey / fromKey', () => {
  it('formats as YYYY-MM-DD with zero-padding', () => {
    expect(toKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toKey(new Date(2026, 10, 30))).toBe('2026-11-30');
  });

  it('round-trips through fromKey', () => {
    const original = new Date(2026, 2, 15);
    const key = toKey(original);
    const parsed = fromKey(key);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(2);
    expect(parsed.getDate()).toBe(15);
  });
});

describe('isSameDay', () => {
  it('is true for the same calendar day regardless of time', () => {
    expect(isSameDay(new Date(2026, 5, 1, 1, 0), new Date(2026, 5, 1, 23, 59))).toBe(true);
  });

  it('is false for different days', () => {
    expect(isSameDay(new Date(2026, 5, 1), new Date(2026, 5, 2))).toBe(false);
  });
});

describe('isToday', () => {
  it('matches the current date key', () => {
    expect(isToday(toKey(new Date()))).toBe(true);
  });

  it('does not match a different date key', () => {
    expect(isToday('1999-01-01')).toBe(false);
  });
});

describe('formatHeaderDate', () => {
  it('formats as "Weekday, Month Day"', () => {
    // 2026-01-05 is a Monday
    expect(formatHeaderDate(new Date(2026, 0, 5))).toBe('Monday, January 5');
  });
});

describe('formatMonthYear', () => {
  it('formats as "Month Year"', () => {
    expect(formatMonthYear(new Date(2026, 7, 1))).toBe('August 2026');
  });
});

describe('formatShortDate', () => {
  it('formats a date key as "Mon Day"', () => {
    expect(formatShortDate('2026-03-09')).toBe('Mar 9');
  });
});

describe('weekdayShort', () => {
  it('returns abbreviated weekday names by index', () => {
    expect(weekdayShort(0)).toBe('Sun');
    expect(weekdayShort(6)).toBe('Sat');
  });
});

describe('daysInMonth', () => {
  it('returns 31 for January', () => {
    expect(daysInMonth(2026, 0)).toBe(31);
  });

  it('returns 30 for April', () => {
    expect(daysInMonth(2026, 3)).toBe(30);
  });

  it('returns 28 for February in a non-leap year', () => {
    expect(daysInMonth(2026, 1)).toBe(28);
  });

  it('returns 29 for February in a leap year', () => {
    expect(daysInMonth(2024, 1)).toBe(29);
  });

  it('returns 28 for a century year not divisible by 400', () => {
    expect(daysInMonth(1900, 1)).toBe(28);
  });

  it('returns 29 for a century year divisible by 400', () => {
    expect(daysInMonth(2000, 1)).toBe(29);
  });
});

describe('firstWeekdayOfMonth', () => {
  it('returns the day-of-week index for the 1st of the month', () => {
    // 2026-02-01 is a Sunday
    expect(firstWeekdayOfMonth(2026, 1)).toBe(0);
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    const result = addDays(new Date(2026, 0, 30), 3);
    expect(toKey(result)).toBe('2026-02-02');
  });

  it('subtracts with negative days', () => {
    const result = addDays(new Date(2026, 0, 1), -1);
    expect(toKey(result)).toBe('2025-12-31');
  });

  it('does not mutate the input date', () => {
    const original = new Date(2026, 0, 1);
    addDays(original, 5);
    expect(toKey(original)).toBe('2026-01-01');
  });
});

describe('addMonths', () => {
  it('adds months and rolls over the year', () => {
    const result = addMonths(new Date(2026, 10, 15), 3);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(1);
  });
});

describe('startOfWeek', () => {
  it('rewinds to the preceding Sunday', () => {
    // 2026-01-07 is a Wednesday
    const result = startOfWeek(new Date(2026, 0, 7));
    expect(toKey(result)).toBe('2026-01-04');
  });

  it('stays put when already Sunday', () => {
    const result = startOfWeek(new Date(2026, 0, 4));
    expect(toKey(result)).toBe('2026-01-04');
  });
});

describe('rangeKeys', () => {
  it('returns `count` keys ending at `end`, in ascending order', () => {
    const keys = rangeKeys(new Date(2026, 0, 10), 5);
    expect(keys).toEqual(['2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10']);
  });

  it('returns a single-element array when count is 1', () => {
    expect(rangeKeys(new Date(2026, 0, 10), 1)).toEqual(['2026-01-10']);
  });
});
