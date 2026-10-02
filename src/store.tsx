import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MealEntry, WeightEntry, Settings, Profile, DaySummary, PinnedMeal } from '@/types';
import { storage, DEFAULT_SETTINGS, DEFAULT_PROFILE, type BackupPayload, type MealPhotos } from '@/lib/storage';
import { addDays, toKey } from '@/lib/dateUtils';
import { unitToKg } from '@/lib/units';
import { findDuplicatePin } from '@/lib/pinnedMeals';
import {
  applyPending, describeOp, isOnline, loadOutbox, loadSnapshot, saveOutbox, saveSnapshot,
  type OutboxOp, type QueuedOp, type Snapshot,
} from '@/lib/offline';
import { useAuth } from '@/auth';

interface StoreValue {
  meals: MealEntry[];
  weights: WeightEntry[];
  settings: Settings;
  profile: Profile;
  pinned: PinnedMeal[];
  /** False until the pinned_meals table exists; pins then stay on this device. */
  pinsSyncEnabled: boolean;
  loading: boolean;
  addMeal: (m: Omit<MealEntry, 'id' | 'createdAt'>) => void;
  updateMeal: (id: string, patch: Partial<Omit<MealEntry, 'id' | 'createdAt'>>) => void;
  deleteMeal: (id: string) => void;
  logWeight: (value: number) => void; // value in display unit
  logWeightForDate: (value: number, dateKey: string) => void; // value in display unit
  deleteWeight: (dateKey: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  /** Pins a meal; returns the existing pin instead when the same meal is already pinned. */
  pinMeal: (m: Omit<PinnedMeal, 'id' | 'createdAt'>) => { pin: PinnedMeal; alreadyPinned: boolean };
  unpinMeal: (id: string) => void;
  /** Puts a previously removed pin back exactly as it was (for undo). */
  restorePin: (pin: PinnedMeal) => void;
  clearAll: () => void;
  importBackup: (payload: BackupPayload) => void;
  exportBackup: () => BackupPayload;
  /**
   * The full backup, photos included: fetches any photos not loaded yet.
   * `missingPhotos` is true when some couldn't be fetched (e.g. offline).
   */
  prepareExport: () => Promise<{ payload: BackupPayload; missingPhotos: boolean }>;
  /** Loads photos for these meals if they haven't been yet (e.g. opening an older day). */
  loadPhotos: (mealIds: string[]) => Promise<boolean>;
  getDay: (dateKey: string) => DaySummary;
  syncError: string | null;
  dismissSyncError: () => void;
  /** A user-initiated refresh (pull-to-refresh, Retry) is in progress. */
  refreshing: boolean;
  /** A background sync (app reopened, back online) is in progress. */
  syncing: boolean;
  online: boolean;
  /** Changes saved on this device that haven't reached the server yet. */
  pendingCount: number;
  lastSyncedAt: number | null;
  /** Re-syncs with the server; resolves true when everything loaded. */
  refresh: () => Promise<boolean>;
}

const StoreContext = createContext<StoreValue | null>(null);

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// A write rejected this many times while online is given up on, so one bad
// row can't block every change queued behind it forever.
const MAX_ATTEMPTS = 5;
const RETRY_INTERVAL_MS = 15_000;
// Returning to the app re-syncs, but not on every quick app switch.
const FOREGROUND_SYNC_MIN_GAP_MS = 30_000;
const SNAPSHOT_DEBOUNCE_MS = 800;
// Photos for meals this recent are fetched in the background after each
// sync; older ones only when a day is opened (or for a backup export).
const RECENT_PHOTO_DAYS = 30;

function runOp(userId: string, op: OutboxOp): Promise<boolean> {
  switch (op.kind) {
    case 'insertMeal': return storage.insertMeal(userId, op.meal);
    case 'updateMeal': return storage.updateMeal(userId, op.id, op.patch);
    case 'deleteMeal': return storage.deleteMeal(userId, op.id);
    case 'upsertWeight': return storage.upsertWeight(userId, op.entry);
    case 'deleteWeight': return storage.deleteWeight(userId, op.date);
    case 'setSettings': return storage.setSettings(userId, op.settings);
    case 'setProfile': return storage.setProfile(userId, op.profile);
    case 'upsertPinned': return storage.upsertPinnedMeal(userId, op.pin);
    case 'deletePinned': return storage.deletePinnedMeal(userId, op.id);
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, status: authStatus } = useAuth();
  const userId = user?.id;
  // Until the session is confirmed, show the cache but don't talk to the
  // server: an unconfirmed (possibly signed-out) session would load an empty
  // account over the cache, and queued writes would be rejected.
  const canSync = authStatus === 'verified';
  const canSyncRef = useRef(canSync);
  canSyncRef.current = canSync;

  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [pinned, setPinned] = useState<PinnedMeal[]>([]);
  const [pinsSyncEnabled, setPinsSyncEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [online, setOnline] = useState(isOnline);
  const [pendingCount, setPendingCount] = useState(0);

  const queue = useRef<QueuedOp[]>([]);
  const flushing = useRef<Promise<void> | null>(null);
  const syncInFlight = useRef<Promise<boolean> | null>(null);
  const lastSyncAttempt = useRef(0);
  // Latest state, for merging a partial load (one table failed) and for undo.
  const current = useRef<Snapshot>({ meals, weights, settings, profile, pinned });
  current.current = { meals, weights, settings, profile, pinned };

  // Photos by meal id, kept apart from the meal list so a sync (which loads
  // meals without photos) never re-downloads them. A null entry means the
  // meal was checked and has none.
  const photos = useRef(new Map<string, MealPhotos | null>());
  const photosInFlight = useRef(new Set<string>());

  const rememberPhotos = useCallback((m: Pick<MealEntry, 'id' | 'imageData' | 'imageDatas'>) => {
    if (m.imageData || m.imageDatas?.length) photos.current.set(m.id, { id: m.id, imageData: m.imageData, imageDatas: m.imageDatas });
  }, []);

  const withPhotos = useCallback((list: MealEntry[]): MealEntry[] => list.map((m) => {
    const p = photos.current.get(m.id);
    return p ? { ...m, imageData: p.imageData, imageDatas: p.imageDatas } : m;
  }), []);

  const fetchPhotos = useCallback(async (uid: string, ids: string[]): Promise<boolean> => {
    const missing = ids.filter((id) => !photos.current.has(id) && !photosInFlight.current.has(id));
    if (missing.length === 0) return true;
    missing.forEach((id) => photosInFlight.current.add(id));
    try {
      const found = await storage.getMealPhotos(uid, missing);
      missing.forEach((id) => { if (!photos.current.has(id)) photos.current.set(id, null); });
      found.forEach((p) => photos.current.set(p.id, p));
      if (found.length > 0) {
        current.current = { ...current.current, meals: withPhotos(current.current.meals) };
        setMeals((prev) => withPhotos(prev));
      }
      return true;
    } catch {
      return false;
    } finally {
      missing.forEach((id) => photosInFlight.current.delete(id));
    }
  }, [withPhotos]);

  const persistQueue = useCallback((uid: string, next: QueuedOp[]) => {
    queue.current = next;
    setPendingCount(next.length);
    if (!saveOutbox(uid, next)) {
      setSyncError("Couldn't store your change on this device — it'll only be kept while the app stays open.");
    }
  }, []);

  // Sends queued writes in order. A failure while offline just waits for the
  // connection; a failure while online is reported (and retried) so data never
  // quietly stops persisting while the UI still looks like it saved.
  const flush = useCallback((uid: string): Promise<void> => {
    if (flushing.current) return flushing.current;
    let finished = false;
    const sendAll = async () => {
      // The lock is released the moment sending ends — synchronously when
      // there was nothing to send (e.g. offline), not a microtask later — so a
      // write queued right after always starts a new flush instead of waiting
      // for the retry timer.
      try {
        let hadFailure = false;
        while (queue.current.length > 0 && isOnline() && canSyncRef.current) {
          const item = queue.current[0];
          const ok = await runOp(uid, item.op);
          if (ok) {
            persistQueue(uid, queue.current.filter((q) => q.qid !== item.qid));
            continue;
          }
          if (!isOnline()) break;
          hadFailure = true;
          const attempts = item.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            persistQueue(uid, queue.current.filter((q) => q.qid !== item.qid));
            setSyncError(`Couldn't save ${describeOp(item.op)} after several tries — please re-enter it.`);
            continue;
          }
          persistQueue(uid, queue.current.map((q) => (q.qid === item.qid ? { ...q, attempts } : q)));
          setSyncError(`Couldn't save ${describeOp(item.op)} — check your connection. It'll retry automatically.`);
          break;
        }
        if (!hadFailure && queue.current.length === 0) {
          setSyncError((prev) => (prev?.includes("It'll retry automatically") ? null : prev));
        }
      } finally {
        finished = true;
        flushing.current = null;
      }
    };
    const run = sendAll();
    if (!finished) flushing.current = run;
    return run;
  }, [persistQueue]);

  const commit = useCallback((op: OutboxOp) => {
    if (!userId) return;
    persistQueue(userId, [...queue.current, { qid: makeId(), op, attempts: 0 }]);
    void flush(userId);
  }, [userId, flush, persistQueue]);

  const applySnapshot = useCallback((snap: Snapshot) => {
    current.current = snap;
    setMeals(snap.meals);
    setWeights(snap.weights);
    setSettings(snap.settings);
    setProfile(snap.profile);
    setPinned(snap.pinned);
  }, []);

  // Shared by the initial load, background syncs and pull-to-refresh: push
  // queued writes first, then pull, then lay any still-unsent writes on top.
  const loadAll = useCallback((uid: string): Promise<boolean> => {
    if (syncInFlight.current) return syncInFlight.current;
    const run = (async () => {
      lastSyncAttempt.current = Date.now();
      await flush(uid);
      const [m, w, s, p, pins] = await Promise.allSettled([
        storage.getMeals(uid),
        storage.getWeights(uid),
        storage.getSettings(uid),
        storage.getProfile(uid),
        storage.getPinnedMeals(uid),
      ]);
      const base = current.current;
      base.meals.forEach(rememberPhotos);
      const failed: string[] = [];
      const next: Snapshot = { ...base };
      if (m.status === 'fulfilled') next.meals = withPhotos(m.value); else failed.push('meals');
      if (w.status === 'fulfilled') next.weights = w.value; else failed.push('weight history');
      if (s.status === 'fulfilled') next.settings = s.value; else failed.push('settings');
      if (p.status === 'fulfilled') next.profile = p.value; else failed.push('profile');
      if (pins.status === 'fulfilled') {
        setPinsSyncEnabled(pins.value !== null);
        if (pins.value !== null) next.pinned = pins.value;
      } else {
        failed.push('pinned meals');
      }
      applySnapshot(applyPending(next, queue.current));
      // Thumbnails for recent meals arrive shortly after, without holding up
      // the data itself.
      const recentFrom = toKey(addDays(new Date(), -RECENT_PHOTO_DAYS));
      void fetchPhotos(uid, next.meals.filter((meal) => meal.date >= recentFrom).map((meal) => meal.id));
      if (failed.length === 0) {
        setSyncError((prev) => (prev?.startsWith("Couldn't load") ? null : prev));
        setLastSyncedAt(Date.now());
        return true;
      }
      // Offline is expected, not an error: the offline pill already says so.
      if (isOnline()) setSyncError(`Couldn't load your ${failed.join(', ')} — check your connection and reload.`);
      return false;
    })();
    syncInFlight.current = run;
    return run.finally(() => { syncInFlight.current = null; });
  }, [flush, applySnapshot, rememberPhotos, withPhotos, fetchPhotos]);

  // StoreProvider is only mounted once a user is signed in (see App.tsx), but
  // guard against a transient render before that so hooks stay unconditional.
  useEffect(() => {
    if (!userId) return;
    queue.current = loadOutbox(userId);
    setPendingCount(queue.current.length);
    // The last known state opens the app instantly (and offline); the server
    // copy replaces it as soon as it arrives.
    const cached = loadSnapshot(userId);
    if (cached) applySnapshot(applyPending(cached, queue.current));
    setLoading(!cached);
  }, [userId, applySnapshot]);

  useEffect(() => {
    if (!userId || !canSync) return;
    let active = true;
    setSyncing(true);
    loadAll(userId).then(() => {
      if (!active) return;
      setLoading(false);
      setSyncing(false);
    });
    return () => { active = false; };
  }, [userId, canSync, loadAll]);

  // No connection to confirm the session: carry on with what's cached.
  useEffect(() => {
    if (authStatus === 'offline') setLoading(false);
  }, [authStatus]);

  // Cache what's on screen for the next (possibly offline) launch.
  useEffect(() => {
    if (!userId || loading) return;
    const t = setTimeout(() => saveSnapshot(userId, { meals, weights, settings, profile, pinned }), SNAPSHOT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [userId, loading, meals, weights, settings, profile, pinned]);

  // Auto-sync: when the app comes back to the foreground or the connection
  // returns, push queued changes and pull anything changed on other devices.
  useEffect(() => {
    if (!userId || !canSync) return;
    const backgroundSync = () => {
      setSyncing(true);
      void loadAll(userId).finally(() => setSyncing(false));
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastSyncAttempt.current < FOREGROUND_SYNC_MIN_GAP_MS) return;
      backgroundSync();
    };
    const onOnline = () => { setOnline(true); backgroundSync(); };
    const onOffline = () => setOnline(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [userId, canSync, loadAll]);

  // While changes are waiting and we seem to be online, keep retrying.
  useEffect(() => {
    if (!userId || !canSync || pendingCount === 0 || !online) return;
    const id = setInterval(() => { void flush(userId); }, RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [userId, canSync, pendingCount, online, flush]);

  const loadPhotos = useCallback<StoreValue['loadPhotos']>(
    (mealIds) => (userId ? fetchPhotos(userId, mealIds) : Promise.resolve(false)),
    [userId, fetchPhotos],
  );

  const value = useMemo<StoreValue>(() => {
    const addMeal: StoreValue['addMeal'] = (m) => {
      if (!userId) return;
      const entry: MealEntry = { ...m, id: makeId(), createdAt: Date.now() };
      rememberPhotos(entry);
      setMeals((prev) => [entry, ...prev]);
      commit({ kind: 'insertMeal', meal: entry });
    };

    const deleteMeal: StoreValue['deleteMeal'] = (id) => {
      if (!userId) return;
      setMeals((prev) => prev.filter((m) => m.id !== id));
      commit({ kind: 'deleteMeal', id });
    };

    const updateMeal: StoreValue['updateMeal'] = (id, patch) => {
      if (!userId) return;
      if (patch.imageData !== undefined || patch.imageDatas !== undefined) {
        rememberPhotos({ id, imageData: patch.imageData, imageDatas: patch.imageDatas });
      }
      setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
      commit({ kind: 'updateMeal', id, patch });
    };

    // Bulk replace/wipe operations go straight to the server (they're not
    // something to replay later) and supersede anything still queued.
    const clearAll: StoreValue['clearAll'] = () => {
      if (!userId) return;
      persistQueue(userId, []);
      photos.current.clear();
      setMeals([]);
      setWeights([]);
      setSettings(DEFAULT_SETTINGS);
      setProfile(DEFAULT_PROFILE);
      setPinned([]);
      void storage.clearAll(userId).then((ok) => {
        if (!ok) setSyncError("Couldn't save the reset — check your connection and try again.");
      });
    };

    const importBackup: StoreValue['importBackup'] = (payload) => {
      if (!userId) return;
      persistQueue(userId, queue.current.filter((q) => q.op.kind === 'upsertPinned' || q.op.kind === 'deletePinned'));
      const nextSettings = { ...DEFAULT_SETTINGS, ...payload.settings };
      const nextProfile = { ...DEFAULT_PROFILE, ...payload.profile };
      photos.current.clear();
      (payload.meals ?? []).forEach(rememberPhotos);
      setMeals(payload.meals ?? []);
      setWeights(payload.weights ?? []);
      setSettings(nextSettings);
      setProfile(nextProfile);
      void storage.importBackup(userId, payload).then((ok) => {
        if (!ok) setSyncError("Couldn't save the imported backup — check your connection and try again.");
      });
    };

    const exportBackup: StoreValue['exportBackup'] = () => ({
      version: 1,
      exportedAt: new Date().toISOString(),
      meals,
      weights,
      settings,
      profile,
    });

    const prepareExport: StoreValue['prepareExport'] = async () => {
      const ok = await loadPhotos(current.current.meals.map((m) => m.id));
      return {
        payload: { ...exportBackup(), meals: current.current.meals },
        missingPhotos: !ok,
      };
    };

    const putWeight = (displayValue: number, dateKey: string) => {
      if (!userId) return;
      const kg = unitToKg(displayValue, settings.weightUnit);
      const entry: WeightEntry = { date: dateKey, weight: kg, createdAt: Date.now() };
      setWeights((prev) => {
        const filtered = prev.filter((w) => w.date !== dateKey);
        return [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date));
      });
      commit({ kind: 'upsertWeight', entry });
    };

    const logWeight: StoreValue['logWeight'] = (displayValue) => putWeight(displayValue, toKey(new Date()));
    const logWeightForDate: StoreValue['logWeightForDate'] = (displayValue, dateKey) => putWeight(displayValue, dateKey);

    const deleteWeight: StoreValue['deleteWeight'] = (dateKey) => {
      if (!userId) return;
      setWeights((prev) => prev.filter((w) => w.date !== dateKey));
      commit({ kind: 'deleteWeight', date: dateKey });
    };

    const updateSettings: StoreValue['updateSettings'] = (patch) => {
      if (!userId) return;
      const next = { ...current.current.settings, ...patch };
      current.current = { ...current.current, settings: next };
      setSettings(next);
      commit({ kind: 'setSettings', settings: next });
    };

    const updateProfile: StoreValue['updateProfile'] = (patch) => {
      if (!userId) return;
      const next = { ...current.current.profile, ...patch };
      current.current = { ...current.current, profile: next };
      setProfile(next);
      commit({ kind: 'setProfile', profile: next });
    };

    const pinMeal: StoreValue['pinMeal'] = (m) => {
      const existing = findDuplicatePin(current.current.pinned, m);
      if (existing) return { pin: existing, alreadyPinned: true };
      const pin: PinnedMeal = { ...m, id: makeId(), createdAt: Date.now() };
      current.current = { ...current.current, pinned: [pin, ...current.current.pinned] };
      setPinned((prev) => [pin, ...prev]);
      commit({ kind: 'upsertPinned', pin });
      return { pin, alreadyPinned: false };
    };

    const unpinMeal: StoreValue['unpinMeal'] = (id) => {
      current.current = { ...current.current, pinned: current.current.pinned.filter((p) => p.id !== id) };
      setPinned((prev) => prev.filter((p) => p.id !== id));
      commit({ kind: 'deletePinned', id });
    };

    const restorePin: StoreValue['restorePin'] = (pin) => {
      setPinned((prev) => [...prev.filter((p) => p.id !== pin.id), pin].sort((a, b) => b.createdAt - a.createdAt));
      commit({ kind: 'upsertPinned', pin });
    };

    const getDay: StoreValue['getDay'] = (dateKey) => {
      const dayMeals = meals.filter((m) => m.date === dateKey);
      const weight = weights.find((w) => w.date === dateKey);
      const sum = (sel: (m: MealEntry) => number) => dayMeals.reduce((a, b) => a + sel(b), 0);
      return {
        date: dateKey,
        meals: dayMeals,
        weight,
        totalCalories: sum((m) => m.calories),
        totalProtein: sum((m) => m.protein),
        totalCarbs: sum((m) => m.carbs),
        totalFat: sum((m) => m.fat),
        totalFiber: sum((m) => m.fiber),
      };
    };

    const dismissSyncError: StoreValue['dismissSyncError'] = () => setSyncError(null);

    const refresh: StoreValue['refresh'] = async () => {
      if (!userId) return false;
      setRefreshing(true);
      const ok = await loadAll(userId);
      setRefreshing(false);
      return ok;
    };

    return {
      meals, weights, settings, profile, pinned, pinsSyncEnabled, loading,
      addMeal, updateMeal, deleteMeal,
      logWeight, logWeightForDate, deleteWeight,
      updateSettings, updateProfile,
      pinMeal, unpinMeal, restorePin,
      clearAll, importBackup, exportBackup, prepareExport, loadPhotos, getDay,
      syncError, dismissSyncError,
      refreshing, syncing, online, pendingCount, lastSyncedAt, refresh,
    };
  }, [meals, weights, settings, profile, pinned, pinsSyncEnabled, loading, userId, syncError, refreshing, syncing, online, pendingCount, lastSyncedAt, loadAll, commit, persistQueue, rememberPhotos, loadPhotos]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
