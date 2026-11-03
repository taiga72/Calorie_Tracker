import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Calendar, Check, Loader2, Mic, Plus, Sparkles, Trash2, Watch, X } from 'lucide-react';
import { useStore } from '@/store';
import { useUndoToast } from '@/components/UndoToastProvider';
import { useSheetAction } from '@/components/Modal';
import { useSpeechInput } from '@/lib/useSpeechInput';
import { friendlyAiError } from '@/lib/aiErrors';
import { compressImage, RateLimitError } from '@/lib/gemini';
import { estimateBurn, estimateWorkout, groupSets, liftKey, liftRecords, newRecords, readWatchScreenshots, WORKOUT_KINDS, type EstimatedWorkout, type WatchWorkout } from '@/lib/workouts';
import { kgToUnit, unitToKg } from '@/lib/units';
import { formatHeaderDate, fromKey, todayKey } from '@/lib/dateUtils';
import type { WeightUnit, Workout, WorkoutKind } from '@/types';

interface SetRow {
  reps: string;
  weight: string; // in the unit the sets are entered in
}

/** One exercise and its sets, as the form shows them. */
interface ExerciseBlock {
  key: number;
  name: string;
  /** What this exercise's weights are entered in (saved in kg either way). */
  unit: WeightUnit;
  /** Picked by hand: typing the name no longer switches it. */
  unitChosen?: boolean;
  sets: SetRow[];
}

// The unit last used for each exercise (dumbbells in lb, the bar in kg…),
// so it comes up the same way next time. Kept on this device.
const LIFT_UNITS_KEY = 'calorie_tracker_lift_units';
function liftUnits(): Record<string, WeightUnit> {
  try {
    return JSON.parse(localStorage.getItem(LIFT_UNITS_KEY) || '{}') as Record<string, WeightUnit>;
  } catch {
    return {};
  }
}
function rememberLiftUnits(blocks: ExerciseBlock[]): void {
  try {
    const all = liftUnits();
    for (const b of blocks) if (b.name.trim()) all[liftKey(b.name)] = b.unit;
    localStorage.setItem(LIFT_UNITS_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}
const unitFor = (name: string, fallback: WeightUnit): WeightUnit => liftUnits()[liftKey(name)] ?? fallback;

let nextBlockKey = 1;
const emptySet = (): SetRow => ({ reps: '', weight: '' });

/** Saved sets (one list, each naming its exercise) → a block per exercise. */
function toBlocks(sets: { exercise: string; reps: number; weight: number }[] | undefined, fallback: WeightUnit): ExerciseBlock[] {
  return groupSets(sets ?? []).map((g) => {
    const unit = unitFor(g.exercise, fallback);
    return {
      key: nextBlockKey++,
      name: g.exercise,
      unit,
      sets: g.sets.map((x) => ({ reps: String(x.reps), weight: x.weight ? trimNum(kgToUnit(x.weight, unit)) : '' })),
    };
  });
}

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};
const trimNum = (n: number) => String(+n.toFixed(1));
/**
 * What a decimal box accepts while typing: digits and one "." or "," (a text
 * box, not type="number", which drops "62,5" on phones set to a comma).
 */
const decimalInput = (s: string) => s.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1');

/**
 * Log or edit a workout: describe it (typed or spoken) and let the AI fill in
 * the duration, calories and sets — or fill them in by hand. Strength work
 * keeps every set, for personal records and progress charts.
 */
export function WorkoutForm({ date, editWorkout, onDone }: { date: string; editWorkout?: Workout | null; onDone: () => void }) {
  const { settings, weights, workouts, addWorkout, updateWorkout, deleteWorkout, restoreWorkout } = useStore();
  const { requestUndo, notify } = useUndoToast();
  const unit = settings.weightUnit;
  const bodyWeight = weights.length ? weights[weights.length - 1].weight : null;

  const [text, setText] = useState('');
  const [kind, setKind] = useState<WorkoutKind>('cardio');
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [calories, setCalories] = useState('');
  const [heartRate, setHeartRate] = useState('');
  // Calories follow the duration until they're typed in (or come from the AI).
  const [caloriesSet, setCaloriesSet] = useState(false);
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([]);
  const [notes, setNotes] = useState('');
  // Editing: move the workout if it was logged on the wrong day.
  const [editDate, setEditDate] = useState(editWorkout?.date ?? date);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  // Imported from watch screenshots: what the watch said, shown under Calories.
  const [watch, setWatch] = useState<WatchWorkout | null>(null);
  const [reading, setReading] = useState(false);
  const watchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editWorkout) return;
    setKind(editWorkout.kind);
    setName(editWorkout.name);
    setMinutes(editWorkout.minutes ? String(editWorkout.minutes) : '');
    setCalories(editWorkout.calories ? String(editWorkout.calories) : '');
    setCaloriesSet(true);
    setHeartRate(editWorkout.avgHeartRate ? String(editWorkout.avgHeartRate) : '');
    setBlocks(toBlocks(editWorkout.sets, unit));
    setNotes(editWorkout.notes ?? '');
    setEditDate(editWorkout.date);
  }, [editWorkout, unit]);

  const textBefore = useRef('');
  const speech = useSpeechInput((transcript) => {
    const base = textBefore.current;
    setText(base && transcript ? `${base}, ${transcript}` : base || transcript);
  });
  const onMic = () => {
    if (speech.listening) { speech.stop(); return; }
    textBefore.current = text.trim();
    speech.start();
  };

  // Recent workouts to repeat with one tap (their sets included).
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Workout[] = [];
    for (const w of workouts) {
      const key = w.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(w);
      if (out.length === 6) break;
    }
    return out;
  }, [workouts]);
  const knownLifts = useMemo(() => liftRecords(workouts).map((r) => r.name), [workouts]);

  const fill = (w: EstimatedWorkout) => {
    setKind(w.kind);
    setName(w.name);
    setMinutes(w.minutes ? String(w.minutes) : '');
    setCalories(w.calories ? String(w.calories) : '');
    setCaloriesSet(w.calories > 0);
    setBlocks(toBlocks(w.sets, unit));
  };

  const onEstimate = async () => {
    if (!text.trim() || loading) return;
    if (speech.listening) speech.stop();
    setLoading(true);
    setError(null);
    setRetry(null);
    try {
      fill(await estimateWorkout(settings.geminiApiKey, text, bodyWeight));
    } catch (e) {
      setError(e instanceof RateLimitError ? `The AI is busy — try again in ${e.retryAfterSec}s.` : friendlyAiError(e));
      setRetry(() => () => void onEstimate());
    } finally {
      setLoading(false);
    }
  };

  // Watch screenshots: the type, duration, calories and heart rate come from
  // the watch; exercises already typed in here are kept.
  const onWatchScreens = async (files: File[]) => {
    if (files.length === 0 || reading) return;
    setReading(true);
    setError(null);
    setRetry(null);
    try {
      const images = await Promise.all(files.slice(0, 4).map((f) => compressImage(f, 1600, 0.8)));
      const w = await readWatchScreenshots(settings.geminiApiKey, images.map((i) => i.base64));
      setKind(w.kind);
      setName((prev) => prev.trim() || w.name);
      setMinutes(w.minutes ? String(w.minutes) : '');
      setCalories(w.calories ? String(w.calories) : '');
      setCaloriesSet(true);
      if (w.avgHeartRate) setHeartRate(String(w.avgHeartRate));
      const note = `From watch screenshots${w.maxHeartRate ? ` · HR max ${w.maxHeartRate} bpm` : ''}`;
      setNotes((prev) => (prev.trim() ? `${prev.trim()} · ${note}` : note));
      setWatch(w);
    } catch (e) {
      setError(e instanceof RateLimitError ? `The AI is busy — try again in ${e.retryAfterSec}s.` : friendlyAiError(e));
      setRetry(() => () => void onWatchScreens(files));
    } finally {
      setReading(false);
    }
  };

  const autoCalories = (k: WorkoutKind, m: string) => {
    if (!caloriesSet) setCalories(num(m) > 0 ? String(estimateBurn(k, num(m), bodyWeight)) : '');
  };

  const updateBlock = (key: number, f: (b: ExerciseBlock) => ExerciseBlock) => setBlocks((prev) => prev.map((b) => (b.key === key ? f(b) : b)));
  const updateSet = (key: number, i: number, patch: Partial<SetRow>) =>
    updateBlock(key, (b) => ({ ...b, sets: b.sets.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  // A new set copies the one before: usually the same weight, maybe a rep less.
  const addSet = (key: number) => updateBlock(key, (b) => ({ ...b, sets: [...b.sets, b.sets.length ? { ...b.sets[b.sets.length - 1] } : emptySet()] }));
  const removeSet = (key: number, i: number) => updateBlock(key, (b) => ({ ...b, sets: b.sets.filter((_, j) => j !== i) }));
  // A new exercise starts in the unit of the one before (or the app's).
  const addExercise = () => setBlocks((prev) => [...prev, { key: nextBlockKey++, name: '', unit: prev[prev.length - 1]?.unit ?? unit, sets: [emptySet()] }]);
  // Naming an exercise brings back the unit it was last logged in.
  const renameExercise = (key: number, name: string) =>
    updateBlock(key, (b) => ({ ...b, name, unit: b.unitChosen ? b.unit : unitFor(name, b.unit) }));
  const removeExercise = (key: number) => setBlocks((prev) => prev.filter((b) => b.key !== key));

  // Saved as one list of sets, each naming its exercise, in the order shown.
  const cleanSets = blocks.flatMap((b) => b.sets
    .map((x) => ({ exercise: b.name.trim(), reps: Math.round(num(x.reps)), weight: +unitToKg(num(x.weight), b.unit).toFixed(2) }))
    .filter((x) => x.exercise && x.reps > 0));
  const canSave = name.trim().length > 0 && (num(minutes) > 0 || num(calories) > 0 || cleanSets.length > 0);

  const onSave = () => {
    if (!canSave) return;
    rememberLiftUnits(blocks);
    const data = {
      date: editWorkout && /^\d{4}-\d{2}-\d{2}$/.test(editDate) ? editDate : editWorkout?.date ?? date,
      kind,
      name: name.trim(),
      minutes: Math.round(num(minutes)),
      calories: Math.round(num(calories)),
      avgHeartRate: num(heartRate) > 0 ? Math.round(num(heartRate)) : undefined,
      ...(cleanSets.length ? { sets: cleanSets } : { sets: undefined }),
      notes: notes.trim() || undefined,
    };
    if (editWorkout) {
      updateWorkout(editWorkout.id, data);
      notify('Workout updated');
      onDone();
      return;
    }
    const id = addWorkout(data);
    if (!id) return;
    const records = newRecords([...workouts], { ...data, id, createdAt: Date.now() });
    const burned = data.calories ? ` · ${data.calories} kcal` : '';
    requestUndo(
      records.length ? `🏆 New record: ${records.join(', ')}` : `Logged ${data.name}${burned}`,
      () => deleteWorkout(id),
    );
    onDone();
  };

  const onDelete = () => {
    if (!editWorkout) return;
    deleteWorkout(editWorkout.id);
    requestUndo('Workout deleted', () => restoreWorkout(editWorkout));
    onDone();
  };

  const inSheet = useSheetAction({ label: 'Save', onClick: onSave, disabled: !canSave });

  return (
    <div>
      {!editWorkout && (
        <>
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="e.g. 40 min brisk walk — or bench 3×8 at 60 kg, squats 5×5 at 100 kg"
              className="w-full bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 pr-14 text-sm text-gray-900 dark:text-white outline-none resize-none focus:ring-2 focus:ring-accent-500/30"
            />
            {speech.supported && (
              <button
                type="button"
                onClick={onMic}
                aria-label={speech.listening ? 'Stop voice input' : 'Speak your workout'}
                aria-pressed={speech.listening}
                className={`absolute right-2.5 bottom-3.5 w-10 h-10 rounded-full flex items-center justify-center ${speech.listening ? 'bg-red-500 text-white' : 'bg-white dark:bg-gray-900 text-accent-600 shadow-sm border border-gray-100 dark:border-gray-700'}`}
              >
                <Mic size={18} />
              </button>
            )}
          </div>
          {speech.error && !speech.listening && <p className="text-11 text-amber-600 mt-1">{speech.error}</p>}
          <button
            type="button"
            onClick={() => void onEstimate()}
            disabled={!text.trim() || loading}
            className="w-full mt-2 bg-accent-600 disabled:opacity-40 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? 'Working it out…' : 'Fill in with AI'}
          </button>
          <input
            ref={watchInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            aria-label="Watch screenshots"
            onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void onWatchScreens(files); }}
          />
          <button
            type="button"
            onClick={() => watchInput.current?.click()}
            disabled={reading}
            className="w-full mt-2 bg-gray-100 dark:bg-gray-800 disabled:opacity-60 text-gray-700 dark:text-gray-200 font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
          >
            {reading ? <Loader2 size={16} className="animate-spin" /> : <Watch size={16} />}
            {reading ? 'Reading your watch…' : 'Import from watch screenshot'}
          </button>
          {error && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-xs rounded-xl p-3 mt-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              {retry && !loading && <button onClick={() => retry()} className="font-semibold underline flex-shrink-0">Try again</button>}
            </div>
          )}
          {recent.length > 0 && (
            <div className="mt-4">
              <p className="text-11 font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Repeat a recent workout</p>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                {recent.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => { fill(w); setNotes(''); }}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200"
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 my-4">
            <span className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
            <span className="text-11 font-medium text-gray-400">or enter it yourself</span>
            <span className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
          </div>
        </>
      )}

      <div className="grid grid-cols-4 gap-1.5">
        {WORKOUT_KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => { setKind(k.key); autoCalories(k.key, minutes); }}
            aria-pressed={kind === k.key}
            className={`py-2 rounded-xl text-11 font-semibold flex flex-col items-center gap-0.5 ${kind === k.key ? 'bg-accent-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
          >
            <span aria-hidden className="text-base leading-none">{k.emoji}</span>{k.label}
          </button>
        ))}
      </div>

      <label className="block mt-3">
        <span className="text-11 font-semibold text-gray-500 dark:text-gray-400">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === 'strength' ? 'e.g. Upper body' : 'e.g. Morning run'}
          className="mt-1 w-full bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500/30"
        />
      </label>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <label className="block">
          <span className="text-11 font-semibold text-gray-500 dark:text-gray-400">Minutes</span>
          <input
            type="number"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => { setMinutes(e.target.value); autoCalories(kind, e.target.value); }}
            placeholder="0"
            className="mt-1 w-full bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500/30"
          />
        </label>
        <label className="block">
          <span className="text-11 font-semibold text-gray-500 dark:text-gray-400">Calories burned</span>
          <input
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={(e) => { setCalories(e.target.value); setCaloriesSet(true); }}
            placeholder="0"
            className="mt-1 w-full bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500/30"
          />
        </label>
        <label className="block">
          <span className="text-11 font-semibold text-gray-500 dark:text-gray-400">Avg heart rate</span>
          <input
            type="number"
            inputMode="numeric"
            value={heartRate}
            onChange={(e) => setHeartRate(e.target.value)}
            placeholder="bpm"
            className="mt-1 w-full bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500/30"
          />
        </label>
      </div>
      {!caloriesSet && num(calories) > 0 && <p className="text-10 text-gray-400 mt-1">Calories estimated from the type and duration — change them if your watch says otherwise.</p>}
      {watch && (
        <p className="text-10 text-gray-500 dark:text-gray-400 mt-1">
          From your watch.
        </p>
      )}

      {(kind === 'strength' || blocks.length > 0) && (
        <div className="mt-4">
          <p className="text-11 font-semibold text-gray-500 dark:text-gray-400">Exercises</p>
          <datalist id="known-lifts">
            {knownLifts.map((n) => <option key={n} value={n} />)}
          </datalist>
          <div className="space-y-2.5 mt-2">
            {blocks.map((b, bi) => (
              <div key={b.key} className="bg-white dark:bg-gray-800/70 border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-none rounded-2xl p-3">
                <div className="flex items-center gap-1.5">
                  <input
                    value={b.name}
                    onChange={(e) => renameExercise(b.key, e.target.value)}
                    list="known-lifts"
                    placeholder="Exercise, e.g. Bench press"
                    aria-label={`Exercise ${bi + 1} name`}
                    autoFocus={!b.name && b.sets.length === 1 && !b.sets[0].reps}
                    className="min-w-0 flex-1 bg-gray-50 dark:bg-gray-900 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500/30"
                  />
                  <button type="button" onClick={() => removeExercise(b.key)} aria-label={`Remove exercise ${bi + 1}`} className="w-9 h-9 -mr-1 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-full">
                    <Trash2 size={15} />
                  </button>
                </div>
                {b.sets.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 mb-1 text-10 font-semibold text-gray-400">
                    <span className="w-8 text-center">Set</span>
                    <span className="flex-1 text-center">Reps</span>
                    <span className="flex-1 flex justify-center">
                      {/* Both units in view, one tap to switch (like iOS's segmented controls). */}
                      <span role="group" aria-label={`Exercise ${bi + 1} weight unit`} className="seg w-24">
                        {(['kg', 'lb'] as WeightUnit[]).map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => updateBlock(b.key, (x) => ({ ...x, unit: u, unitChosen: true }))}
                            aria-pressed={b.unit === u}
                            className="seg-item !py-1 !text-11"
                          >
                            {u}
                          </button>
                        ))}
                      </span>
                    </span>
                    <span className="w-9 -mr-1" />
                  </div>
                )}
                <div className="space-y-1.5">
                  {b.sets.map((x, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-8 text-center text-xs font-bold text-gray-400">{i + 1}</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={x.reps}
                        onChange={(e) => updateSet(b.key, i, { reps: e.target.value.replace(/\D/g, '') })}
                        placeholder="0"
                        aria-label={`Exercise ${bi + 1} set ${i + 1} reps`}
                        className="min-w-0 flex-1 bg-gray-50 dark:bg-gray-900 rounded-xl px-2 py-2 text-sm text-center text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500/30"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={x.weight}
                        onChange={(e) => updateSet(b.key, i, { weight: decimalInput(e.target.value) })}
                        placeholder="—"
                        aria-label={`Exercise ${bi + 1} set ${i + 1} weight`}
                        className="min-w-0 flex-1 bg-gray-50 dark:bg-gray-900 rounded-xl px-2 py-2 text-sm text-center text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500/30"
                      />
                      <button type="button" onClick={() => removeSet(b.key, i)} aria-label={`Remove exercise ${bi + 1} set ${i + 1}`} className="w-9 h-9 -mr-1 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-full">
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addSet(b.key)} aria-label={`Add set to exercise ${bi + 1}`} className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-accent-600 py-1.5">
                  <Plus size={14} /> Add set
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addExercise}
            className="w-full mt-2.5 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl py-2.5 text-sm font-semibold text-accent-600 flex items-center justify-center gap-1.5 active:scale-[.99] transition-transform"
          >
            <Plus size={16} /> Add exercise
          </button>
          <p className="text-10 text-gray-400 mt-1.5">Leave the weight empty for bodyweight moves.</p>
        </div>
      )}

      {editWorkout && (
        <>
          <label className="field-box flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 mt-3 text-xs">
            <Calendar size={14} className="flex-shrink-0 text-gray-400" />
            <span className="font-medium text-gray-500 dark:text-gray-400">Day</span>
            <input
              type="date"
              aria-label="Workout date"
              value={editDate}
              max={todayKey()}
              onChange={(e) => setEditDate(e.target.value)}
              className="ml-auto bg-transparent font-semibold text-gray-900 dark:text-white outline-none text-right"
            />
          </label>
          {editDate && editDate !== editWorkout.date && (
            <p className="text-11 text-blue-600 dark:text-blue-400 mt-1 px-1">Will move to {formatHeaderDate(fromKey(editDate))}</p>
          )}
        </>
      )}

      <label className="block mt-3">
        <span className="text-11 font-semibold text-gray-500 dark:text-gray-400">Notes (optional)</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it feel?"
          className="mt-1 w-full bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500/30"
        />
      </label>

      {!inSheet && (
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="w-full mt-5 bg-accent-600 disabled:opacity-40 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
        >
          <Check size={18} /> {editWorkout ? 'Save changes' : 'Save workout'}
        </button>
      )}
      {editWorkout && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 font-semibold py-3 rounded-2xl text-sm mt-5 flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
        >
          <Trash2 size={16} /> Delete workout
        </button>
      )}
    </div>
  );
}
