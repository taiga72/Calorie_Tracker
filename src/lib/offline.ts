import type { MealEntry, WeightEntry, Settings, Profile, PinnedMeal } from '@/types';

/**
 * A write that hasn't reached Supabase yet. Every op is idempotent (upserts,
 * patches, deletes by key), so replaying one that actually landed before the
 * connection dropped is harmless.
 */
export type OutboxOp =
  | { kind: 'insertMeal'; meal: MealEntry }
  | { kind: 'updateMeal'; id: string; patch: Partial<Omit<MealEntry, 'id' | 'createdAt'>> }
  | { kind: 'deleteMeal'; id: string }
  | { kind: 'upsertWeight'; entry: WeightEntry }
  | { kind: 'deleteWeight'; date: string }
  | { kind: 'setSettings'; settings: Settings }
  | { kind: 'setProfile'; profile: Profile }
  | { kind: 'upsertPinned'; pin: PinnedMeal }
  | { kind: 'deletePinned'; id: string };

export interface QueuedOp {
  qid: string;
  op: OutboxOp;
  /** Failed attempts made while the device reported being online. */
  attempts: number;
}

export interface Snapshot {
  meals: MealEntry[];
  weights: WeightEntry[];
  settings: Settings;
  profile: Profile;
  pinned: PinnedMeal[];
}

const outboxKey = (userId: string) => `calorie_tracker_outbox_${userId}`;
const snapshotKey = (userId: string) => `calorie_tracker_cache_${userId}`;

export function loadOutbox(userId: string): QueuedOp[] {
  try {
    const raw = localStorage.getItem(outboxKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

/** Returns false when the queue couldn't be persisted (e.g. storage quota). */
export function saveOutbox(userId: string, queue: QueuedOp[]): boolean {
  try {
    if (queue.length === 0) localStorage.removeItem(outboxKey(userId));
    else localStorage.setItem(outboxKey(userId), JSON.stringify(queue));
    return true;
  } catch {
    return false;
  }
}

export function loadSnapshot(userId: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(snapshotKey(userId));
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Snapshot>;
    if (!Array.isArray(s.meals) || !Array.isArray(s.weights) || !s.settings || !s.profile) return null;
    return { meals: s.meals, weights: s.weights, settings: s.settings, profile: s.profile, pinned: s.pinned ?? [] };
  } catch {
    return null;
  }
}

/**
 * Caches the last known state so the app opens instantly — and works with no
 * connection. Meal photos are left out: they're most of the data (writing
 * them on every change was slow and overflowed storage) and are loaded
 * separately. Edits never send absent photos, so this can't erase them.
 */
export function saveSnapshot(userId: string, snap: Snapshot): void {
  try {
    const meals = snap.meals.map(({ imageData: _a, imageDatas: _b, ...rest }) => rest);
    localStorage.setItem(snapshotKey(userId), JSON.stringify({ ...snap, meals }));
  } catch {
    // Best-effort only.
  }
}

export function clearOfflineData(userId: string): void {
  try {
    localStorage.removeItem(outboxKey(userId));
    localStorage.removeItem(snapshotKey(userId));
  } catch {
    // ignore
  }
}

const sortWeights = (ws: WeightEntry[]) => [...ws].sort((a, b) => a.date.localeCompare(b.date));

/**
 * Re-applies writes that haven't reached the server yet on top of freshly
 * loaded server data, so a refresh never makes an offline change "disappear".
 */
export function applyPending(snap: Snapshot, queue: QueuedOp[]): Snapshot {
  let { meals, weights, settings, profile, pinned } = snap;
  for (const { op } of queue) {
    switch (op.kind) {
      case 'insertMeal':
        meals = meals.some((m) => m.id === op.meal.id)
          ? meals.map((m) => (m.id === op.meal.id ? op.meal : m))
          : [op.meal, ...meals];
        break;
      case 'updateMeal':
        meals = meals.map((m) => (m.id === op.id ? { ...m, ...op.patch } : m));
        break;
      case 'deleteMeal':
        meals = meals.filter((m) => m.id !== op.id);
        break;
      case 'upsertWeight':
        weights = sortWeights([...weights.filter((w) => w.date !== op.entry.date), op.entry]);
        break;
      case 'deleteWeight':
        weights = weights.filter((w) => w.date !== op.date);
        break;
      case 'setSettings':
        settings = op.settings;
        break;
      case 'setProfile':
        profile = op.profile;
        break;
      case 'upsertPinned':
        pinned = [op.pin, ...pinned.filter((p) => p.id !== op.pin.id)];
        break;
      case 'deletePinned':
        pinned = pinned.filter((p) => p.id !== op.id);
        break;
    }
  }
  return { meals, weights, settings, profile, pinned };
}

export function describeOp(op: OutboxOp): string {
  switch (op.kind) {
    case 'insertMeal': return 'your meal';
    case 'updateMeal': return 'your changes';
    case 'deleteMeal':
    case 'deleteWeight': return 'that deletion';
    case 'upsertWeight': return 'your weight';
    case 'setSettings': return 'your settings';
    case 'setProfile': return 'your profile';
    case 'upsertPinned':
    case 'deletePinned': return 'your pinned meals';
  }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}
