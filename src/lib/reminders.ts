import type { MealType } from '@/types';
import { isNative } from '@/lib/native';

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

/** Fired when the reminder settings change (the iPhone app reschedules). */
export const REMINDERS_CHANGED_EVENT = 'calorie-tracker:reminders-changed';

export function saveReminderConfig(config: ReminderConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REMINDERS_CHANGED_EVENT));
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

// The iPhone app asks iOS (asynchronously); the answer is kept here.
let nativePermission: NotificationSupport = 'default';

async function localNotifications() {
  return (await import('@capacitor/local-notifications')).LocalNotifications;
}

function fromNative(state: string): NotificationSupport {
  return state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'default';
}

/** In the iPhone app: what iOS currently allows (call before reading notificationSupport). */
export async function refreshNotificationPermission(): Promise<NotificationSupport> {
  if (!isNative()) return notificationSupport();
  try {
    nativePermission = fromNative((await (await localNotifications()).checkPermissions()).display);
  } catch {
    // keep the last known answer
  }
  return nativePermission;
}

export function notificationSupport(): NotificationSupport {
  if (isNative()) return nativePermission;
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (isNative()) {
    try {
      nativePermission = fromNative((await (await localNotifications()).requestPermissions()).display);
    } catch {
      // keep the last known answer
    }
    return nativePermission;
  }
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
  if (isNative()) {
    try {
      await (await localNotifications()).schedule({ notifications: [{ id: 999, title, body, schedule: { at: new Date(Date.now() + 1000) } }] });
      return true;
    } catch {
      return false;
    }
  }
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

// ---- The iPhone app: reminders scheduled with iOS, so they arrive even when
// the app is closed. The next week is scheduled; it's redone whenever the app
// opens, something is logged or the settings change, which drops today's
// reminders for things already logged.

const NATIVE_ID_BASE = 1000;
const SCHEDULE_DAYS = 7;

/** The reminders to schedule: [id, ReminderId, when], skipping ones already done or past. */
export function plannedReminders(config: ReminderConfig, now: Date, today: DayStatus): { id: number; reminder: ReminderId; at: Date }[] {
  if (!config.enabled) return [];
  const out: { id: number; reminder: ReminderId; at: Date }[] = [];
  for (let d = 0; d < SCHEDULE_DAYS; d++) {
    REMINDER_IDS.forEach((rid, i) => {
      const slot = config.slots[rid];
      if (!slot.on) return;
      const [h, m] = slot.time.split(':').map(Number);
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h || 0, m || 0);
      if (at <= now) return;
      if (d === 0 && (rid === 'weighIn' ? today.weighedIn : today.loggedMealTypes.has(rid))) return;
      out.push({ id: NATIVE_ID_BASE + d * REMINDER_IDS.length + i, reminder: rid, at });
    });
  }
  return out;
}

export async function scheduleNativeReminders(config: ReminderConfig, today: DayStatus, now = new Date()): Promise<void> {
  if (!isNative()) return;
  const ln = await localNotifications();
  const pending = await ln.getPending();
  const ours = pending.notifications.filter((n) => n.id >= NATIVE_ID_BASE && n.id < NATIVE_ID_BASE + SCHEDULE_DAYS * REMINDER_IDS.length);
  if (ours.length) await ln.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  if ((await refreshNotificationPermission()) !== 'granted') return;
  const plan = plannedReminders(config, now, today);
  if (plan.length === 0) return;
  await ln.schedule({
    notifications: plan.map((p) => ({ id: p.id, ...reminderMessage(p.reminder), schedule: { at: p.at, allowWhileIdle: true } })),
  });
}
