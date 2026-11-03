import { useState } from 'react';
import { HeartPulse, Loader2, RefreshCw } from 'lucide-react';
import { Toggle } from '@/components/AppearanceSection';
import { isNative } from '@/lib/native';
import { formatRelativeTime } from '@/lib/dateUtils';
import { connectHealth, healthAvailable, loadHealthPrefs, saveHealthPrefs, type HealthPrefs } from '@/lib/health';
import { HEALTH_SYNC_EVENT } from '@/lib/useHealthSync';

/** Settings → Goals, in the iPhone app only: Apple Health in and out. */
export function HealthSection() {
  const [prefs, setPrefs] = useState<HealthPrefs>(loadHealthPrefs);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!isNative()) return null;

  const update = (patch: Partial<HealthPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveHealthPrefs(next);
  };

  const syncNow = () => {
    window.dispatchEvent(new Event(HEALTH_SYNC_EVENT));
    setMessage('Syncing — new workouts and weigh-ins appear in a moment.');
    setTimeout(() => setPrefs(loadHealthPrefs()), 4000);
  };

  const onConnect = async () => {
    setBusy(true);
    setMessage(null);
    if (!(await healthAvailable())) {
      setMessage('Apple Health isn’t available on this device.');
      setBusy(false);
      return;
    }
    const ok = await connectHealth();
    setBusy(false);
    if (!ok) {
      setMessage('Couldn’t open the Health permissions — try again.');
      return;
    }
    update({ connected: true, writeSince: prefs.writeSince ?? Date.now() });
    syncNow();
  };

  return (
    <div className="card p-5 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <HeartPulse size={18} className="text-rose-500" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white flex-1">Apple Health</h2>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Workouts from your watch (any watch app that saves to Health, like CMF) and weigh-ins from a smart scale come in on their own; meals you log here go to Health as calories.
      </p>

      {!prefs.connected ? (
        <button
          type="button"
          onClick={() => void onConnect()}
          disabled={busy}
          className="w-full bg-accent-600 disabled:opacity-60 text-white font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <HeartPulse size={16} />} Connect Apple Health
        </button>
      ) : (
        <>
          <Toggle label="Import workouts" sub="Calories from heart rate are cut to about two thirds for strength sessions" on={prefs.workouts} onChange={(v) => update({ workouts: v })} />
          <Toggle label="Import weigh-ins" sub="Only for days you haven't logged a weight here" on={prefs.weights} onChange={(v) => update({ weights: v })} />
          <Toggle label="Send meals to Health" sub="Calories of meals you log from now on" on={prefs.writeMeals} onChange={(v) => update({ writeMeals: v, writeSince: v ? Date.now() : prefs.writeSince })} />
          <div className="flex items-center justify-between mt-2">
            <span className="text-11 text-gray-400">{prefs.lastSync ? `Last synced ${formatRelativeTime(Date.parse(prefs.lastSync)).toLowerCase()}` : 'Not synced yet'}</span>
            <button type="button" onClick={syncNow} className="flex items-center gap-1 text-xs font-semibold text-accent-600 py-1.5">
              <RefreshCw size={13} /> Sync now
            </button>
          </div>
          <p className="text-10 text-gray-400 mt-1">To change what the app may read or write: iPhone Settings → Health → Data Access & Devices → Tally.</p>
        </>
      )}
      {message && <p className="text-11 text-gray-500 dark:text-gray-400 mt-2">{message}</p>}
    </div>
  );
}
