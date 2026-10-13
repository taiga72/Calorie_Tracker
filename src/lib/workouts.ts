import type { StrengthSet, Workout, WorkoutKind } from '@/types';
import { generateJson, resolveApiKey } from '@/lib/gemini';
import { addDays, fromKey, startOfWeek, toKey } from '@/lib/dateUtils';

export const WORKOUT_KINDS: { key: WorkoutKind; label: string; emoji: string }[] = [
  { key: 'cardio', label: 'Cardio', emoji: '🏃' },
  { key: 'strength', label: 'Strength', emoji: '🏋️' },
  { key: 'sport', label: 'Sport', emoji: '⚽' },
  { key: 'other', label: 'Other', emoji: '🧘' },
];

export function kindEmoji(kind: WorkoutKind): string {
  return WORKOUT_KINDS.find((k) => k.key === kind)?.emoji ?? '💪';
}

export type EstimatedWorkout = Omit<Workout, 'id' | 'createdAt' | 'date'>;

const WORKOUT_PROMPT = `You are an exercise physiologist. The user describes a workout in their own words.
Respond with ONLY a JSON object (no markdown) with this exact shape:
{
  "kind": "cardio" | "strength" | "sport" | "other",
  "name": string,
  "minutes": number,
  "calories": number,
  "sets": [{ "exercise": string, "reps": number, "weight": number }]
}
Rules:
- name: a short title, e.g. "Morning run", "Upper body", "Football".
- minutes: the duration; if not stated, the typical duration for what they described.
- calories: kcal burned during the workout (MET × body weight in kg × hours), rounded. Be realistic, not generous.
- sets: only for strength work, one entry per set — "3x8 bench 60kg" is three entries. weight in kg (convert pounds: lb × 0.4536), 0 for bodyweight. Use common exercise names in Title case ("Bench press", "Back squat", "Pull-up"). Empty array for other kinds.
- Output ONLY the JSON object.`;

function normalizeWorkout(raw: unknown): EstimatedWorkout {
  const r = raw as Partial<EstimatedWorkout> & { sets?: Partial<StrengthSet>[] };
  const kind: WorkoutKind = WORKOUT_KINDS.some((k) => k.key === r.kind) ? (r.kind as WorkoutKind) : 'other';
  const sets = Array.isArray(r.sets)
    ? r.sets
      .map((s) => ({ exercise: String(s.exercise ?? '').trim(), reps: Math.round(Number(s.reps) || 0), weight: Math.max(0, +(Number(s.weight) || 0).toFixed(1)) }))
      .filter((s) => s.exercise && s.reps > 0)
    : [];
  const minutes = Math.max(0, Math.round(Number(r.minutes) || 0));
  const calories = Math.max(0, Math.round(Number(r.calories) || 0));
  if (!minutes && !calories && sets.length === 0) throw new Error('Gemini response missing workout details.');
  return {
    kind: sets.length > 0 && kind === 'other' ? 'strength' : kind,
    name: String(r.name ?? '').trim() || WORKOUT_KINDS.find((k) => k.key === kind)!.label,
    minutes,
    calories,
    ...(sets.length ? { sets } : {}),
  };
}

/** Turns "45 min easy run" or "bench 3x8 60kg, squat 5x5 100kg" into a workout. */
export async function estimateWorkout(apiKey: string, text: string, bodyWeightKg: number | null): Promise<EstimatedWorkout> {
  const key = resolveApiKey(apiKey);
  const weight = bodyWeightKg ? `The person weighs about ${Math.round(bodyWeightKg)} kg.` : 'Assume a body weight of 75 kg.';
  const body = {
    contents: [{ role: 'user', parts: [{ text: WORKOUT_PROMPT }, { text: `${weight}\nWorkout: ${text.trim()}` }] }],
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 },
  };
  return generateJson(key, body, normalizeWorkout);
}

// Rough MET values, for estimating a manual entry without the AI.
const MET: Record<WorkoutKind, number> = { cardio: 7, strength: 5, sport: 7, other: 3.5 };

export function estimateBurn(kind: WorkoutKind, minutes: number, bodyWeightKg: number | null): number {
  return Math.round(MET[kind] * (bodyWeightKg || 75) * (Math.max(0, minutes) / 60));
}

// ---- Strength progress

/** Same lift however it was typed ("bench press", "Bench Press "). */
export function liftKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Estimated one-rep max (Epley). Bodyweight sets have none. */
export function estimated1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export interface LiftRecord {
  key: string;
  name: string;
  /** Heaviest weight lifted (kg) and for how many reps. */
  best: { weight: number; reps: number; date: string };
  /** Best estimated one-rep max (kg). */
  best1RM: number;
  /** Most reps in one set (for bodyweight work). */
  mostReps: number;
  sessions: number;
  lastDate: string;
}

export function liftRecords(workouts: Workout[]): LiftRecord[] {
  const byLift = new Map<string, LiftRecord>();
  const seen = new Map<string, Set<string>>();
  const chronological = [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  for (const w of chronological) {
    for (const s of w.sets ?? []) {
      const key = liftKey(s.exercise);
      const rec = byLift.get(key) ?? {
        key, name: s.exercise.trim(), best: { weight: 0, reps: 0, date: w.date }, best1RM: 0, mostReps: 0, sessions: 0, lastDate: w.date,
      };
      if (s.weight > rec.best.weight || (s.weight === rec.best.weight && s.reps > rec.best.reps)) rec.best = { weight: s.weight, reps: s.reps, date: w.date };
      rec.best1RM = Math.max(rec.best1RM, estimated1RM(s.weight, s.reps));
      rec.mostReps = Math.max(rec.mostReps, s.reps);
      rec.lastDate = w.date;
      const ids = seen.get(key) ?? new Set<string>();
      ids.add(w.id);
      seen.set(key, ids);
      rec.sessions = ids.size;
      byLift.set(key, rec);
    }
  }
  return [...byLift.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.sessions - a.sessions);
}

/** The best set of a lift per session, oldest first — for its progress chart. */
export function liftHistory(workouts: Workout[], key: string): { date: string; weight: number; reps: number; e1rm: number }[] {
  const byDate = new Map<string, { date: string; weight: number; reps: number; e1rm: number }>();
  for (const w of workouts) {
    for (const s of w.sets ?? []) {
      if (liftKey(s.exercise) !== key) continue;
      const e1rm = estimated1RM(s.weight, s.reps);
      const prev = byDate.get(w.date);
      if (!prev || e1rm > prev.e1rm || (e1rm === prev.e1rm && s.reps > prev.reps)) byDate.set(w.date, { date: w.date, weight: s.weight, reps: s.reps, e1rm });
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Lifts where this workout beat everything logged before it. */
export function newRecords(workouts: Workout[], workout: Workout): string[] {
  const before = workouts.filter((w) => w.id !== workout.id && (w.date < workout.date || (w.date === workout.date && w.createdAt < workout.createdAt)));
  const prior = new Map(liftRecords(before).map((r) => [r.key, r]));
  const out = new Set<string>();
  for (const s of workout.sets ?? []) {
    const rec = prior.get(liftKey(s.exercise));
    if (!rec) continue; // a first time isn't a record yet
    if (s.weight > 0 ? s.weight > rec.best.weight || estimated1RM(s.weight, s.reps) > rec.best1RM + 0.01 : s.reps > rec.mostReps) out.add(s.exercise.trim());
  }
  return [...out];
}

/** Sets grouped by exercise, in the order done — "Bench press 3 × 8 @ 60 kg". */
export function groupSets(sets: StrengthSet[]): { exercise: string; sets: StrengthSet[] }[] {
  const groups: { exercise: string; sets: StrengthSet[] }[] = [];
  for (const s of sets) {
    const g = groups.find((x) => liftKey(x.exercise) === liftKey(s.exercise));
    if (g) g.sets.push(s); else groups.push({ exercise: s.exercise.trim(), sets: [s] });
  }
  return groups;
}

// ---- Weekly totals

export interface WeekTotals {
  start: string;
  workouts: number;
  minutes: number;
  calories: number;
}

/** The last `count` weeks (Sunday–Saturday, like the calendar), oldest first. */
export function weeklyTotals(workouts: Workout[], today: Date, count: number): WeekTotals[] {
  const thisWeek = startOfWeek(today);
  const weeks: WeekTotals[] = Array.from({ length: count }, (_, i) => ({
    start: toKey(addDays(thisWeek, -7 * (count - 1 - i))), workouts: 0, minutes: 0, calories: 0,
  }));
  for (const w of workouts) {
    const start = toKey(startOfWeek(fromKey(w.date)));
    const week = weeks.find((x) => x.start === start);
    if (!week) continue;
    week.workouts += 1;
    week.minutes += w.minutes;
    week.calories += w.calories;
  }
  return weeks;
}

export function workoutsOn(workouts: Workout[], dateKey: string): Workout[] {
  return workouts.filter((w) => w.date === dateKey).sort((a, b) => a.createdAt - b.createdAt);
}
