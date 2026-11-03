import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { isNative } from '@/lib/native';
import { kgToUnit } from '@/lib/units';
import { loadHealthPrefs, markImported, newHealthWeights, newHealthWorkouts, saveHealthPrefs, writeMealsToHealth } from '@/lib/health';

const FIRST_LOOKBACK_DAYS = 30;
const DAY_MS = 86_400_000;

export interface HealthSyncResult {
  workouts: number;
  weights: number;
}

/**
 * Apple Health ↔ this app, in the iPhone app once connected (Settings →
 * Account): new workouts and weigh-ins come in when the app opens or comes
 * back to the front; new meals' calories go out as they're logged.
 */
export function useHealthSync(enabled: boolean) {
  const { meals, workouts, weights, settings, restoreWorkout, logWeightForDate } = useStore();
  const latest = useRef({ workouts, weights, settings, restoreWorkout, logWeightForDate });
  latest.current = { workouts, weights, settings, restoreWorkout, logWeightForDate };
  const running = useRef(false);

  const syncNow = useCallback(async (): Promise<HealthSyncResult | null> => {
    const prefs = loadHealthPrefs();
    if (!isNative() || !prefs.connected || running.current) return null;
    running.current = true;
    try {
      const since = prefs.lastSync ? new Date(Date.parse(prefs.lastSync) - DAY_MS) : new Date(Date.now() - FIRST_LOOKBACK_DAYS * DAY_MS);
      const { workouts: have, weights: haveWeights, settings: s, restoreWorkout: addWorkout, logWeightForDate: addWeight } = latest.current;
      let nWorkouts = 0;
      let nWeights = 0;
      if (prefs.workouts) {
        const found = await newHealthWorkouts(since);
        const ids = new Set(have.map((w) => w.id));
        for (const w of found) if (!ids.has(w.id)) { addWorkout(w); nWorkouts++; }
        markImported(found.map((w) => w.id));
      }
      if (prefs.weights) {
        const found = await newHealthWeights(since);
        const days = new Set(haveWeights.map((w) => w.date));
        // A weigh-in typed in here wins over the scale's for the same day.
        for (const w of found) if (!days.has(w.date)) { addWeight(kgToUnit(w.kg, s.weightUnit), w.date); nWeights++; }
        markImported(found.map((w) => `hk-weight-${w.date}`));
      }
      saveHealthPrefs({ ...loadHealthPrefs(), lastSync: new Date().toISOString() });
      return { workouts: nWorkouts, weights: nWeights };
    } catch {
      return null;
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !isNative()) return;
    void syncNow();
    const onVisible = () => { if (document.visibilityState === 'visible') void syncNow(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(HEALTH_SYNC_EVENT, onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(HEALTH_SYNC_EVENT, onVisible);
    };
  }, [enabled, syncNow]);

  // Meals logged on this phone since connecting go to Health (calories).
  useEffect(() => {
    if (!enabled || !isNative()) return;
    const prefs = loadHealthPrefs();
    if (!prefs.connected || !prefs.writeMeals || !prefs.writeSince) return;
    const fresh = meals.filter((m) => m.createdAt >= prefs.writeSince!);
    if (fresh.length === 0) return;
    const t = setTimeout(() => void writeMealsToHealth(fresh).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [enabled, meals]);

  return syncNow;
}

/** Fired by Settings after connecting, to sync right away. */
export const HEALTH_SYNC_EVENT = 'calorie-tracker:health-sync';
