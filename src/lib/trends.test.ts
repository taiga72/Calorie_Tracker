import { describe, it, expect } from 'vitest';
import { rolling7, rolling28Weekly, valueAt, trendLine, smoothingFor, niceTicks, fitDomain, dateTicks } from '@/lib/trends';

const p = (date: string, value: number) => ({ date, value });

describe('smoothingFor', () => {
  it('joins daily values for a week, averages 7 days up to 3 months, weekly beyond', () => {
    expect(smoothingFor(7)).toBe('none');
    expect(smoothingFor(30)).toBe('rolling7');
    expect(smoothingFor(90)).toBe('rolling7');
    expect(smoothingFor(365)).toBe('rolling28');
  });
});

describe('rolling7', () => {
  it('averages the recorded days in the trailing week, skipping gaps instead of counting zeros', () => {
    const out = rolling7([p('2026-09-01', 2000), p('2026-09-02', 1800), p('2026-09-05', 2200), p('2026-09-10', 1600)]);
    expect(out).toEqual([
      p('2026-09-02', 1900),
      p('2026-09-05', 2000),
      // 09-10 window is 09-04..09-10: only 09-05 and 09-10 count.
      p('2026-09-10', 1900),
    ]);
  });

  it('needs two values before drawing a trend', () => {
    expect(rolling7([p('2026-09-01', 2000)])).toEqual([]);
  });
});

describe('rolling28Weekly', () => {
  it('averages the trailing 4 weeks, one point per week', () => {
    // Daily 2000 for 6 weeks, except a single 4000 day: a 4-week average barely moves.
    const days = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(2026, 7, 3 + i); // Mon 3 Aug 2026
      return p(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, i === 30 ? 4000 : 2000);
    });
    const out = rolling28Weekly(days);
    expect(out).toHaveLength(6);
    expect(out.every((q, i) => i === 0 || q.date > out[i - 1].date)).toBe(true);
    expect(Math.max(...out.map((q) => q.value))).toBeLessThan(2100);
  });
});

describe('valueAt', () => {
  it('reads the trend between its points', () => {
    const line = [p('2026-09-01', 80), p('2026-09-11', 79)];
    expect(valueAt(line, '2026-09-06')).toBeCloseTo(79.5);
    expect(valueAt(line, '2026-08-30')).toBeUndefined();
  });
});

describe('trendLine', () => {
  it('returns the daily values in date order when not smoothing', () => {
    expect(trendLine([p('2026-09-02', 2), p('2026-09-01', 1)], 'none')).toEqual([p('2026-09-01', 1), p('2026-09-02', 2)]);
  });
});

describe('axes', () => {
  it('picks round tick values', () => {
    expect(niceTicks(1500, 2600, 4)).toEqual([1500, 2000, 2500]);
    expect(niceTicks(1600, 2400, 4)).toEqual([1600, 1800, 2000, 2200, 2400]);
    expect(niceTicks(78.2, 81.9, 4)).toEqual([79, 80, 81]);
  });

  it('fits the y-range to the data (not from zero), padded, with a minimum span', () => {
    const [lo, hi] = fitDomain([80, 80.2, 79.9], { minSpan: 2 });
    expect(lo).toBeGreaterThan(78);
    expect(hi).toBeLessThan(82);
    expect(hi - lo).toBeGreaterThanOrEqual(2);
  });

  it('stretches to include a reference value like the goal', () => {
    const [lo] = fitDomain([1900, 2100], { minSpan: 100, include: [1600] });
    expect(lo).toBeLessThan(1600);
  });

  it('labels weekdays for a week, dates for a month, months for longer', () => {
    expect(dateTicks('2026-09-27', '2026-10-03').map((t) => t.date)).toHaveLength(7);
    const month = dateTicks('2026-09-04', '2026-10-03');
    expect(month[month.length - 1].date).toBe('2026-10-03');
    expect(month.length).toBeLessThanOrEqual(6);
    const year = dateTicks('2025-10-04', '2026-10-03', 6);
    expect(year.length).toBeLessThanOrEqual(6);
    expect(year.every((t) => t.date.endsWith('-01'))).toBe(true);
  });
});
