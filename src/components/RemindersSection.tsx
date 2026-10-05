import { useState } from 'react';
import {
  REMINDER_IDS, REMINDER_LABELS, loadReminderConfig, saveReminderConfig, notificationSupport,
  requestNotificationPermission, showSystemNotification, type ReminderConfig, type ReminderId, type NotificationSupport,
} from '@/lib/reminders';
import { Bell, BellOff } from 'lucide-react';

export function RemindersSection() {
  const [config, setConfig] = useState<ReminderConfig>(loadReminderConfig);
  const [permission, setPermission] = useState<NotificationSupport>(notificationSupport);
  const [testSent, setTestSent] = useState(false);

  const update = (next: ReminderConfig) => {
    setConfig(next);
    saveReminderConfig(next);
  };

  const onToggleEnabled = async () => {
    if (config.enabled) {
      update({ ...config, enabled: false });
      return;
    }
    // On right away: in-app reminders work regardless of the answer, and the
    // permission prompt may not resolve until the user responds to it.
    update({ ...config, enabled: true });
    if (permission === 'default') setPermission(await requestNotificationPermission());
  };

  const setSlot = (id: ReminderId, patch: Partial<ReminderConfig['slots'][ReminderId]>) => {
    update({ ...config, slots: { ...config.slots, [id]: { ...config.slots[id], ...patch } } });
  };

  const onTest = async () => {
    const ok = await showSystemNotification('Reminders are on', "This is how a reminder will look.", 'reminder-test');
    setTestSent(ok);
  };

  return (
    <div className="card p-5 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <Bell size={18} className="text-accent-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white flex-1">Reminders</h2>
        <button
          role="switch"
          aria-checked={config.enabled}
          aria-label="Reminders"
          onClick={onToggleEnabled}
          className={`relative w-11 h-6 rounded-full transition-colors ${config.enabled ? 'bg-accent-600' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${config.enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        A nudge when you haven't logged a meal or weighed in by a set time. Skipped if you already have.
      </p>

      {config.enabled && (
        <>
          <div className="space-y-2">
            {REMINDER_IDS.map((id) => (
              <div key={id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
                <input
                  type="checkbox"
                  checked={config.slots[id].on}
                  onChange={(e) => setSlot(id, { on: e.target.checked })}
                  aria-label={`${REMINDER_LABELS[id]} reminder`}
                  className="w-4 h-4 accent-accent-600"
                />
                <span className={`flex-1 text-sm font-medium ${config.slots[id].on ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                  {REMINDER_LABELS[id]}
                </span>
                <input
                  type="time"
                  value={config.slots[id].time}
                  onChange={(e) => e.target.value && setSlot(id, { time: e.target.value })}
                  disabled={!config.slots[id].on}
                  aria-label={`${REMINDER_LABELS[id]} time`}
                  className="bg-white dark:bg-gray-900 rounded-lg px-2 py-1 text-sm font-semibold text-gray-900 dark:text-white disabled:opacity-40 outline-none"
                />
              </div>
            ))}
          </div>

          {permission === 'granted' ? (
            <button onClick={onTest} className="mt-3 text-xs font-semibold text-accent-600">
              {testSent ? 'Test notification sent ✓' : 'Send a test notification'}
            </button>
          ) : (
            <div className="mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs rounded-xl p-3">
              <BellOff size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                {permission === 'unsupported'
                  ? "This browser can't show notifications — on iPhone, add the app to your Home Screen (Share → Add to Home Screen) and open it from there. You'll still get reminders inside the app."
                  : permission === 'denied'
                    ? "Notifications are blocked for this app in your browser/phone settings. You'll still get reminders inside the app."
                    : "Allow notifications to get reminders when the app isn't on screen."}
              </span>
            </div>
          )}
          <p className="text-11 text-gray-400 mt-2">
            Reminders are per device, and are delivered while the app is open or recently backgrounded.
          </p>
        </>
      )}
    </div>
  );
}
