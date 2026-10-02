import type { MealType } from '@/types';

export type ReminderId = 'Breakfast' | 'Lunch' | 'Dinner' | 'weighIn';

export interface ReminderSlot {
  on: boolean;
  /** "HH:MM", local time. */
  time: string;
}

export interface ReminderConfig {
  enabled: boolean;
  slots: Record<ReminderId, ReminderSlot>;
}

export const REMINDER_IDS: ReminderId[] = ['weighIn', 'Breakfast', 'Lunch', 'Dinner'];

export const REMINDER_LABELS: Record<ReminderId, string> = {
  weighIn: 'Weigh-in',
  Breakfast: 'Breakfast',
  Lunch: 'Lunch',
  Dinner: 'Dinner',
};

export const DEFAULT_REMINDERS: ReminderConfig = {
  enabled: false,
  slots: {
    weighIn: { on: true, time: '08:00' },
    Breakfast: { on: true, time: '10:00' },
    Lunch: { on: true, time: '14:00' },
    Dinner: { on: true, time: '20:30' },
  },
};

// Per device: notification permission and habits are per phone, not account.
const CONFIG_KEY = 'calorie_tracker_reminders';
const FIRED_KEY = 'calorie_tracker_reminders_fired';

export function loadReminderConfig(): ReminderConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_REMINDERS;
    const parsed = JSON.parse(raw) as Partial<ReminderConfig>;
    return { enabled: !!parsed.enabled, slots: { ...DEFAULT_REMINDERS.slots, ...parsed.slots } };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export function saveReminderConfig(config: ReminderConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

/** Reminder ids already shown on `dateKey`, so each fires at most once a day. */
export function loadFired(dateKey: string): Set<ReminderId> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    const parsed = raw ? (JSON.parse(raw) as { date: string; ids: ReminderId[] }) : null;
    return new Set(parsed?.date === dateKey ? parsed.ids : []);
  } catch {
    return new Set();
  }
}

export function saveFired(dateKey: string, ids: Set<ReminderId>): void {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify({ date: dateKey, ids: [...ids] }));
  } catch {
    // ignore
  }
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// A reminder that was missed by more than this (the app wasn't open) is
// skipped rather than nagging about breakfast at 9pm.
const STALE_AFTER_MIN = 180;

export interface DayStatus {
  loggedMealTypes: Set<MealType>;
  weighedIn: boolean;
}

/** Reminders whose time has come today and whose thing hasn't been logged yet. */
export function dueReminders(config: ReminderConfig, now: Date, status: DayStatus, fired: Set<ReminderId>): ReminderId[] {
  if (!config.enabled) return [];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return REMINDER_IDS.filter((id) => {
    const slot = config.slots[id];
    if (!slot.on || fired.has(id)) return false;
    const at = minutesOf(slot.time);
    if (nowMin < at || nowMin - at > STALE_AFTER_MIN) return false;
    return id === 'weighIn' ? !status.weighedIn : !status.loggedMealTypes.has(id);
  });
}

export function reminderMessage(id: ReminderId): { title: string; body: string } {
  if (id === 'weighIn') return { title: 'Morning weigh-in', body: "Step on the scale — it keeps your goal forecast accurate." };
  return { title: `Log your ${id.toLowerCase()}?`, body: `You haven't logged ${id.toLowerCase()} yet today. It only takes a tap.` };
}

export type NotificationSupport = 'granted' | 'denied' | 'default' | 'unsupported';

export function notificationSupport(): NotificationSupport {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (notificationSupport() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationSupport();
  }
}

/** Shows a system notification (via the service worker when there is one — required on iOS). */
export async function showSystemNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (notificationSupport() !== 'granted') return false;
  const options = { body, tag, icon: '/apple-touch-icon.png', badge: '/apple-touch-icon.png' };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    return true;
  } catch {
    return false;
  }
}
