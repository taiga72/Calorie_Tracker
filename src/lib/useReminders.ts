import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import { todayKey } from '@/lib/dateUtils';
import {
  dueReminders, loadFired, loadReminderConfig, reminderMessage, saveFired, showSystemNotification,
  type ReminderId,
} from '@/lib/reminders';

const CHECK_INTERVAL_MS = 60_000;

/**
 * Checks once a minute (and whenever the app comes back) for reminders whose
 * time has come. While the app is on screen they show as an in-app banner;
 * in the background they go out as a system notification.
 */
export function useReminders(enabled: boolean) {
  const { getDay } = useStore();
  const getDayRef = useRef(getDay);
  getDayRef.current = getDay;
  const [active, setActive] = useState<ReminderId | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      const now = new Date();
      const key = todayKey();
      const fired = loadFired(key);
      const day = getDayRef.current(key);
      const due = dueReminders(
        loadReminderConfig(),
        now,
        { loggedMealTypes: new Set(day.meals.map((m) => m.mealType)), weighedIn: !!day.weight },
        fired,
      );
      if (due.length === 0) return;
      due.forEach((id) => fired.add(id));
      saveFired(key, fired);
      // Only the most recent one is worth surfacing if several piled up.
      const id = due[due.length - 1];
      if (document.visibilityState === 'visible') {
        setActive(id);
      } else {
        const { title, body } = reminderMessage(id);
        void showSystemNotification(title, body, `reminder-${id}`);
      }
    };
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, [enabled]);

  const dismiss = useCallback(() => setActive(null), []);
  return { active, dismiss };
}
