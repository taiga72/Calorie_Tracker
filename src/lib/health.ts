import type { HealthDataType, Workout as HKWorkout, WorkoutType } from '@capgo/capacitor-health';
import type { MealEntry, Workout, WorkoutKind } from '@/types';
import { isNative } from '@/lib/native';
import { toKey } from '@/lib/dateUtils';
import { adjustWatchCalories } from '@/lib/workouts';

/**
 * Apple Health, in the iPhone app: workouts from any watch that writes to
 * Health (the CMF app does), weigh-ins from a smart scale, and the calories
 * of meals logged here written back. Choices are kept on this phone.
 */

export interface HealthPrefs {
  /** Permission was asked for (iOS never says whether reading was allowed). */
  connected: boolean;
  workouts: boolean;
  weights: boolean;
  writeMeals: boolean;
  /** When syncing last ran (ISO); the next sync looks back from a day before. */
  lastSync?: string;
  /** Meals created after this (ms) are written to Health. */
  writeSince?: number;
}

const PREFS_KEY = 'calorie_tracker_health';
const IMPORTED_KEY = 'calorie_tracker_health_imported';
const WRITTEN_KEY = 'calorie_tracker_health_written';

export const DEFAULT_HEALTH_PREFS: HealthPrefs = { connected: false, workouts: true, weights: true, writeMeals: true };

export function loadHealthPrefs(): HealthPrefs {
  try {
    return { ...DEFAULT_HEALTH_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Partial<HealthPrefs>) };
  } catch {
    return DEFAULT_HEALTH_PREFS;
  }
}

export function saveHealthPrefs(p: HealthPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

/** Ids already imported or written, so each happens once (a deleted import stays deleted). */
function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]);
  } catch {
    return new Set();
  }
}
function saveSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set].slice(-2000)));
  } catch {
    // ignore
  }
}

const READ: HealthDataType[] = ['workouts', 'weight', 'heartRate'];
const WRITE: HealthDataType[] = ['dietaryEnergyConsumed'];

// Loads the module, not the plugin: awaiting a Capacitor plugin object makes
// it call a native "then" method that never answers, so the await hangs.
const healthModule = () => import('@capgo/capacitor-health');

export async function healthAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await (await healthModule()).Health.isAvailable()).available;
  } catch {
    return false;
  }
}

/** Shows iOS's Health permission sheet. */
export async function connectHealth(): Promise<boolean> {
  try {
    await (await healthModule()).Health.requestAuthorization({ read: READ, write: WRITE });
    return true;
  } catch {
    return false;
  }
}

// ---- Workouts

const STRENGTH = new Set<WorkoutType>([
  'traditionalStrengthTraining', 'functionalStrengthTraining', 'strengthTraining', 'weightlifting', 'coreTraining',
  'calisthenics', 'benchPress', 'deadlift', 'barbellShoulderPress', 'latPullDown', 'lunge', 'plank', 'crossTraining',
]);
const CARDIO = new Set<WorkoutType>([
  'running', 'runningTreadmill', 'walking', 'hiking', 'cycling', 'bikingStationary', 'handCycling', 'elliptical', 'rowing',
  'rowingMachine', 'swimming', 'swimmingPool', 'swimmingOpenWater', 'stairClimbing', 'stairClimbingMachine', 'stairs',
  'stepTraining', 'jumpRope', 'highIntensityIntervalTraining', 'mixedCardio', 'cardioDance', 'dance', 'dancing',
  'kickboxing', 'boxing', 'bootCamp', 'crossCountrySkiing', 'wheelchairRunPace', 'wheelchairWalkPace',
]);
const SPORT = new Set<WorkoutType>([
  'soccer', 'basketball', 'tennis', 'badminton', 'volleyball', 'baseball', 'softball', 'americanFootball',
  'australianFootball', 'rugby', 'hockey', 'iceHockey', 'squash', 'racquetball', 'tableTennis', 'pickleball', 'golf',
  'cricket', 'handball', 'lacrosse', 'martialArts', 'climbing', 'rockClimbing', 'skiing', 'downhillSkiing',
  'snowboarding', 'surfing', 'paddleSports', 'waterPolo',
]);

export function kindOf(type: WorkoutType): WorkoutKind {
  if (STRENGTH.has(type)) return 'strength';
  if (CARDIO.has(type)) return 'cardio';
  if (SPORT.has(type)) return 'sport';
  return 'other';
}

const NAMES: Partial<Record<WorkoutType, string>> = {
  traditionalStrengthTraining: 'Strength training',
  functionalStrengthTraining: 'Functional training',
  highIntensityIntervalTraining: 'HIIT',
  runningTreadmill: 'Treadmill run',
  bikingStationary: 'Indoor cycling',
  swimmingPool: 'Pool swim',
  swimmingOpenWater: 'Open water swim',
  americanFootball: 'Football',
  other: 'Workout',
};

/** "traditionalStrengthTraining" → "Strength training", "running" → "Running". */
export function workoutName(type: WorkoutType): string {
  const named = NAMES[type];
  if (named) return named;
  const words = type.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One Health workout as a workout here (calories corrected like watch screenshots). */
export function fromHealthWorkout(w: HKWorkout, avgHeartRate?: number): Workout {
  const kind = kindOf(w.workoutType);
  const raw = Math.round(w.totalEnergyBurned ?? 0);
  const start = new Date(w.startDate);
  const source = w.sourceName ? `Apple Health (${w.sourceName})` : 'Apple Health';
  const details = [raw ? `${raw} kcal` : null, avgHeartRate ? `HR avg ${avgHeartRate} bpm` : null].filter(Boolean).join(' · ');
  return {
    id: `hk-${w.platformId ?? w.startDate}`,
    date: toKey(start),
    kind,
    name: workoutName(w.workoutType),
    minutes: Math.max(1, Math.round(w.duration / 60)),
    calories: adjustWatchCalories(kind, raw),
    notes: details ? `${source}: ${details}` : source,
    createdAt: start.getTime(),
  };
}

async function averageHeartRate(start: string, end: string): Promise<number | undefined> {
  try {
    const { samples } = await (await healthModule()).Health.readSamples({ dataType: 'heartRate', startDate: start, endDate: end, limit: 1000 });
    if (!samples.length) return undefined;
    return Math.round(samples.reduce((a, s) => a + s.value, 0) / samples.length);
  } catch {
    return undefined;
  }
}

/** Workouts recorded since `since` that haven't been imported before. */
export async function newHealthWorkouts(since: Date): Promise<Workout[]> {
  const imported = loadSet(IMPORTED_KEY);
  const { workouts } = await (await healthModule()).Health.queryWorkouts({ startDate: since.toISOString(), endDate: new Date().toISOString(), limit: 100, ascending: true });
  const out: Workout[] = [];
  for (const w of workouts) {
    const id = `hk-${w.platformId ?? w.startDate}`;
    if (imported.has(id) || w.duration < 60) continue;
    out.push(fromHealthWorkout(w, await averageHeartRate(w.startDate, w.endDate)));
  }
  return out;
}

export function markImported(ids: string[]): void {
  const set = loadSet(IMPORTED_KEY);
  ids.forEach((id) => set.add(id));
  saveSet(IMPORTED_KEY, set);
}

// ---- Weigh-ins

/** The last weigh-in of each day since `since`, in kg, for days not imported before. */
export async function newHealthWeights(since: Date): Promise<{ date: string; kg: number }[]> {
  const imported = loadSet(IMPORTED_KEY);
  const { samples } = await (await healthModule()).Health.readSamples({ dataType: 'weight', startDate: since.toISOString(), endDate: new Date().toISOString(), limit: 500, ascending: true });
  const byDay = new Map<string, number>();
  for (const s of samples) if (s.value > 20 && s.value < 400) byDay.set(toKey(new Date(s.startDate)), s.value);
  return [...byDay.entries()].filter(([date]) => !imported.has(`hk-weight-${date}`)).map(([date, kg]) => ({ date, kg: +kg.toFixed(1) }));
}

// ---- Meals → Health (calories only: the plugin can't write macros)

export async function writeMealsToHealth(meals: MealEntry[]): Promise<number> {
  const written = loadSet(WRITTEN_KEY);
  const todo = meals.filter((m) => !written.has(m.id) && m.calories > 0);
  if (todo.length === 0) return 0;
  const { Health: health } = await healthModule();
  let n = 0;
  for (const m of todo) {
    try {
      // Logged for another day (e.g. from the calendar): put it on that day.
      const created = new Date(m.createdAt);
      const at = (toKey(created) === m.date ? created : new Date(`${m.date}T12:00:00`)).toISOString();
      await health.saveSample({ dataType: 'dietaryEnergyConsumed', value: Math.round(m.calories), startDate: at, endDate: at });
      written.add(m.id);
      n++;
    } catch {
      break; // not allowed (or offline): try again next time
    }
  }
  saveSet(WRITTEN_KEY, written);
  return n;
}
