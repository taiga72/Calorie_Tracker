const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isSameDay(a: Date, b: Date): boolean {
  return toKey(a) === toKey(b);
}

// ---- Which day is "today"

/**
 * Hour (0–5) when a new day starts (Settings → Goal plan). With 3, a snack
 * at 1 am still counts toward the day before — for night owls and shifts.
 */
let dayStartHour = 0;

export function setDayStartHour(hour: number): void {
  dayStartHour = Math.min(5, Math.max(0, Math.round(hour || 0)));
}

/** Now, shifted so that the hours before the day-start hour fall on the previous day. */
export function logicalNow(): Date {
  return new Date(Date.now() - dayStartHour * 3_600_000);
}

export function todayKey(): string {
  return toKey(logicalNow());
}

export function isToday(key: string): boolean {
  return key === todayKey();
}

export function formatHeaderDate(date: Date): string {
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
  return `${weekday}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatShortDate(key: string): string {
  const d = fromKey(key);
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function weekdayShort(idx: number): string {
  return WEEKDAYS_SHORT[idx];
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function rangeKeys(end: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(toKey(addDays(end, -i)));
  }
  return keys;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A short, human label for a date key relative to today: "Today", "Yesterday", "N days ago". */
export function relativeDayLabel(key: string): string {
  const diffDays = Math.round((fromKey(todayKey()).getTime() - fromKey(key).getTime()) / MS_PER_DAY);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1) return `${diffDays} days ago`;
  if (diffDays === -1) return 'Tomorrow';
  return formatShortDate(key);
}

/** A short, human label for a timestamp relative to now: "Just now", "5m ago", "3h ago", or a short date. */
export function formatRelativeTime(ms: number): string {
  const diffMs = Date.now() - ms;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return formatShortDate(toKey(new Date(ms)));
}
