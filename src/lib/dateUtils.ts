export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, delta: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + delta);
  return toKey(d);
}

export function isToday(key: string): boolean {
  return key === toKey(new Date());
}

export function isFuture(key: string): boolean {
  return fromKey(key).getTime() > new Date().setHours(0, 0, 0, 0);
}

export function formatHeaderDate(key: string): string {
  const d = fromKey(key);
  const today = toKey(new Date());
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  if (key === tomorrow) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatLongDate(key: string): string {
  return fromKey(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function lastNKeys(n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) keys.push(addDays(toKey(new Date()), -i));
  return keys;
}
