import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Calendar, Check, Loader2, Mic, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useStore } from '@/store';
import { useUndoToast } from '@/components/UndoToastProvider';
import { useSpeechInput } from '@/lib/useSpeechInput';
import { friendlyAiError } from '@/lib/aiErrors';
import { RateLimitError } from '@/lib/gemini';
import { estimateBurn, estimateWorkout, liftRecords, newRecords, WORKOUT_KINDS, type EstimatedWorkout } from '@/lib/workouts';
import { kgToUnit, unitToKg } from '@/lib/units';
import { formatHeaderDate, fromKey, todayKey } from '@/lib/dateUtils';
import type { Workout, WorkoutKind } from '@/types';

interface SetRow {
  exercise: string;
  reps: string;
  weight: string; // in the display unit
}

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};
const trimNum = (n: number) => String(+n.toFixed(1));

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
  // Calories follow the duration until they're typed in (or come from the AI).
  const [caloriesSet, setCaloriesSet] = useState(false);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [notes, setNotes] = useState('');
  // Editing: move the workout if it was logged on the wrong day.
  const [editDate, setEditDate] = useState(editWorkout?.date ?? date);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!editWorkout) return;
    setKind(editWorkout.kind);
    setName(editWorkout.name);
    setMinutes(editWorkout.minutes ? String(editWorkout.minutes) : '');
    setCalories(editWorkout.calories ? String(editWorkout.calories) : '');
    setCaloriesSet(true);
    setSets((editWorkout.sets ?? []).map((s) => ({ exercise: s.exercise, reps: String(s.reps), weight: s.weight ? trimNum(kgToUnit(s.weight, unit)) : '' })));
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
    setSets((w.sets ?? []).map((s) => ({ exercise: s.exercise, reps: String(s.reps), weight: s.weight ? trimNum(kgToUnit(s.weight, unit)) : '' })));
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

  const autoCalories = (k: WorkoutKind, m: string) => {
    if (!caloriesSet) setCalories(num(m) > 0 ? String(estimateBurn(k, num(m), bodyWeight)) : '');
  };

  const updateSet = (i: number, patch: Partial<SetRow>) => setSets((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  // A new row copies the last one: the next set is usually the same lift.
  const addSet = () => setSets((prev) => [...prev, prev.length ? { ...prev[prev.length - 1] } : { exercise: '', reps: '', weight: '' }]);

  const cleanSets = sets
    .map((s) => ({ exercise: s.exercise.trim(), reps: Math.round(num(s.reps)), weight: +unitToKg(num(s.weight), unit).toFixed(2) }))
    .filter((s) => s.exercise && s.reps > 0);
  const canSave = name.trim().length > 0 && (num(minutes) > 0 || num(calories) > 0 || cleanSets.length > 0);

  const onSave = () => {
    if (!canSave) return;
    const data = {
      date: editWorkout && /^\d{4}-\d{2}-\d{2}$/.test(editDate) ? editDate : editWorkout?.date ?? date,
      kind,
      name: name.trim(),
      minutes: Math.round(num(minutes)),
      calories: Math.round(num(calories)),
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
            <span className="text-10 font-semibold text-gray-400">OR ENTER IT YOURSELF</span>
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
            className={`py-2 rounded-xl text-11 font-semibold flex flex-col items-center gap-0.5 ${kind === k.key ? 'bg-gray-900 dark:bg-accent-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
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
      <div className="grid grid-cols-2 gap-2 mt-2">
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
      </div>
      {!caloriesSet && num(calories) > 0 && <p className="text-10 text-gray-400 mt-1">Calories estimated from the type and duration — change them if your watch says otherwise.</p>}

      {(kind === 'strength' || sets.length > 0) && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-11 font-semibold text-gray-500 dark:text-gray-400">Sets</p>
            <p className="text-10 text-gray-400">reps × {unit} · leave weight empty for bodyweight</p>
          </div>
          <datalist id="known-lifts">
            {knownLifts.map((n) => <option key={n} value={n} />)}
          </datalist>
          <div className="space-y-1.5">
            {sets.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  value={s.exercise}
                  onChange={(e) => updateSet(i, { exercise: e.target.value })}
                  list="known-lifts"
                  placeholder="Exercise"
                  aria-label={`Set ${i + 1} exercise`}
                  className="min-w-0 flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500/30"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={s.reps}
                  onChange={(e) => updateSet(i, { reps: e.target.value })}
                  placeholder="reps"
                  aria-label={`Set ${i + 1} reps`}
                  className="w-14 bg-gray-50 dark:bg-gray-800 rounded-xl px-2 py-2 text-sm text-center text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500/30"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={s.weight}
                  onChange={(e) => updateSet(i, { weight: e.target.value })}
                  placeholder={unit}
                  aria-label={`Set ${i + 1} weight`}
                  className="w-16 bg-gray-50 dark:bg-gray-800 rounded-xl px-2 py-2 text-sm text-center text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-accent-500/30"
                />
                <button type="button" onClick={() => setSets((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove set ${i + 1}`} className="w-9 h-9 -mr-1 flex items-center justify-center text-gray-400 hover:text-red-500 rounded-full">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addSet} className="mt-2 flex items-center gap-1 text-xs font-semibold text-accent-600 py-1.5">
            <Plus size={14} /> Add set
          </button>
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

      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="w-full mt-5 bg-accent-600 disabled:opacity-40 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
      >
        <Check size={18} /> {editWorkout ? 'Save changes' : 'Save workout'}
      </button>
      {editWorkout && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 font-semibold py-3 rounded-2xl text-sm mt-2 flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
        >
          <Trash2 size={16} /> Delete workout
        </button>
      )}
    </div>
  );
}
