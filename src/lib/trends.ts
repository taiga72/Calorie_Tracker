import { addDays, fromKey, toKey } from '@/lib/dateUtils';

/** One day's value; null when nothing was recorded (a gap, not a zero). */
export interface DayValue {
  date: string;
  value: number | null;
}

export interface TrendPoint {
  date: string;
  value: number;
}

/**
 * How the bold trend line is built for a given range length: the daily
 * values themselves for a week, a 7-day average up to 3 months, and a
 * 4-week average (one point a week) for a year — a weekly average was still
 * too jumpy there, since one big weekend moves a whole week.
 */
export type Smoothing = 'none' | 'rolling7' | 'rolling28';

export function smoothingFor(days: number): Smoothing {
  if (days <= 10) return 'none';
  if (days <= 120) return 'rolling7';
  return 'rolling28';
}

export const SMOOTHING_LABEL: Record<Smoothing, string> = {
  none: 'Daily',
  rolling7: '7-day average',
  rolling28: '4-week average',
};

const DAY_MS = 86_400_000;
const dayIndex = (key: string) => Math.round(fromKey(key).getTime() / DAY_MS);

/**
 * Trailing average at every day that has a value — averaging only the days
 * that were recorded, so a skipped day doesn't drag the line to zero. Needs
 * a few values in the window so one stray day isn't a "trend".
 */
export function rollingMean(points: TrendPoint[], windowDays: number, minCount: number): TrendPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const out: TrendPoint[] = [];
  let from = 0;
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i].value;
    const end = dayIndex(sorted[i].date);
    while (end - dayIndex(sorted[from].date) >= windowDays) sum -= sorted[from++].value;
    const count = i - from + 1;
    if (count >= minCount) out.push({ date: sorted[i].date, value: sum / count });
  }
  return out;
}

export function rolling7(points: TrendPoint[]): TrendPoint[] {
  return rollingMean(points, 7, 2);
}

/** 4-week average, kept to one point per week (the week's last recorded day). */
export function rolling28Weekly(points: TrendPoint[]): TrendPoint[] {
  const all = rollingMean(points, 28, 4);
  const lastOfWeek = new Map<string, TrendPoint>();
  for (const p of all) lastOfWeek.set(weekStartOf(p.date), p);
  return [...lastOfWeek.values()];
}

/** The trend's value on any day, read off the line between its points. */
export function valueAt(line: TrendPoint[], date: string): number | undefined {
  if (line.length === 0) return undefined;
  const t = dayIndex(date);
  const first = dayIndex(line[0].date);
  const last = dayIndex(line[line.length - 1].date);
  if (t < first || t > last) return undefined;
  for (let i = 1; i < line.length; i++) {
    const a = dayIndex(line[i - 1].date);
    const b = dayIndex(line[i].date);
    if (t <= b) return line[i - 1].value + ((t - a) / (b - a || 1)) * (line[i].value - line[i - 1].value);
  }
  return line[line.length - 1].value;
}

/** Monday of the week containing `key`. */
function weekStartOf(key: string): string {
  const d = fromKey(key);
  return toKey(addDays(d, -((d.getDay() + 6) % 7)));
}

export function trendLine(points: TrendPoint[], smoothing: Smoothing): TrendPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (smoothing === 'none') return sorted;
  if (smoothing === 'rolling28') return rolling28Weekly(sorted);
  return rolling7(sorted);
}

/** Round, evenly spaced axis values covering [min, max] — about `count` of them. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [Math.round(min)];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => raw <= s) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

/**
 * The y-range for a chart: the data (plus any reference line, like a goal,
 * when it's near), padded a little and widened to a minimum span so a flat
 * week doesn't magnify 0.1 kg into a cliff.
 */
export function fitDomain(values: number[], { minSpan, include = [], zero = false }: { minSpan: number; include?: number[]; zero?: boolean }): [number, number] {
  const all = [...values, ...include];
  if (all.length === 0) return [0, 1];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const pad = (hi - lo) * 0.12;
  lo = zero ? 0 : lo - pad;
  hi += pad;
  return [lo, hi];
}

/** Date ticks that suit the span: days, weeks, months or every other month. */
export function dateTicks(start: string, end: string, maxTicks = 6): { date: string; label: string }[] {
  const s = fromKey(start);
  const span = dayIndex(end) - dayIndex(start);
  const ticks: { date: string; label: string }[] = [];
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, o);
  if (span <= 10) {
    // Weekday names are short enough to show every day.
    for (let d = s; toKey(d) <= end; d = addDays(d, 1)) ticks.push({ date: toKey(d), label: fmt(d, { weekday: 'short' }) });
    return ticks;
  } else if (span <= 45) {
    for (let d = addDays(fromKey(end), 0); toKey(d) >= start; d = addDays(d, -7)) ticks.unshift({ date: toKey(d), label: fmt(d, { month: 'short', day: 'numeric' }) });
  } else {
    const firstMonth = new Date(s.getFullYear(), s.getMonth() + (s.getDate() === 1 ? 0 : 1), 1);
    const months: Date[] = [];
    for (let d = firstMonth; toKey(d) <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
    const every = Math.max(1, Math.ceil(months.length / maxTicks));
    months.forEach((d, i) => {
      if (i % every === 0) ticks.push({ date: toKey(d), label: fmt(d, { month: 'short' }) });
    });
  }
  if (ticks.length <= maxTicks) return ticks;
  const every = Math.ceil(ticks.length / maxTicks);
  return ticks.filter((_, i) => (ticks.length - 1 - i) % every === 0);
}

export { dayIndex };
