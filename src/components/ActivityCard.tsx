import { useState } from 'react';
import { Dumbbell, Plus, ChevronRight } from 'lucide-react';
import { useStore } from '@/store';
import { Modal } from '@/components/Modal';
import { WorkoutForm } from '@/components/WorkoutForm';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { useUndoToast } from '@/components/UndoToastProvider';
import { groupSets, kindEmoji, workoutsOn } from '@/lib/workouts';
import { exerciseCreditOn } from '@/lib/goalPlan';
import { kgToUnit } from '@/lib/units';
import { formatShortDate, relativeDayLabel } from '@/lib/dateUtils';
import type { Workout } from '@/types';

/** "Today", "3 days ago", then a date ("Oct 2") past a week. */
function dayLabel(key: string): string {
  const rel = relativeDayLabel(key);
  return /^\d+ days ago$/.test(rel) && parseInt(rel, 10) > 6 ? formatShortDate(key) : rel;
}

/** Adds or edits one workout, on `date`. */
export function WorkoutSheet({ open, onClose, date, workout }: { open: boolean; onClose: () => void; date: string; workout?: Workout | null }) {
  return (
    <Modal open={open} onClose={onClose} title={workout ? 'Edit workout' : 'Log exercise'}>
      {open && <WorkoutForm key={workout?.id ?? 'new'} date={date} editWorkout={workout} onDone={onClose} />}
    </Modal>
  );
}

/**
 * One line per workout: "🏋️ Upper body · 45 min · 280 kcal", with its lifts.
 * Rows swipe to delete (with undo), like meals; tap to edit.
 */
export function WorkoutList({ workouts, onEdit, showDate = false }: { workouts: Workout[]; onEdit: (w: Workout) => void; showDate?: boolean }) {
  const { settings, deleteWorkout, restoreWorkout } = useStore();
  const { requestUndo } = useUndoToast();
  const unit = settings.weightUnit;
  const onDelete = (w: Workout) => {
    deleteWorkout(w.id);
    requestUndo('Workout deleted', () => restoreWorkout(w));
  };
  return (
    <ul className="divide-y divide-gray-50 dark:divide-gray-800">
      {workouts.map((w) => (
        <li key={w.id}>
          <SwipeToDelete onDelete={() => onDelete(w)}>
          <button type="button" onClick={() => onEdit(w)} className="w-full flex items-center gap-3 py-2.5 text-left">
            <span aria-hidden className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950 flex items-center justify-center text-lg flex-shrink-0">{kindEmoji(w.kind)}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">{w.name}</span>
              <span className="block text-11 text-gray-400">
                {[showDate ? dayLabel(w.date) : null, w.minutes ? `${w.minutes} min` : null, w.calories ? `${w.calories} kcal` : null, w.sets?.length ? `${w.sets.length} sets` : null].filter(Boolean).join(' · ')}
              </span>
              {w.sets?.length ? (
                <span className="block text-11 text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {groupSets(w.sets).map((g) => {
                    const top = g.sets.reduce((a, b) => (b.weight > a.weight ? b : a));
                    return `${g.exercise} ${g.sets.length}×${top.reps}${top.weight ? ` @ ${+kgToUnit(top.weight, unit).toFixed(1)}` : ''}`;
                  }).join(' · ')}
                </span>
              ) : null}
              {w.notes ? <span className="block text-11 text-gray-400 italic truncate mt-0.5">{w.notes}</span> : null}
            </span>
            <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />
          </button>
          </SwipeToDelete>
        </li>
      ))}
    </ul>
  );
}

/** Home: today's exercise, and a quick way to log some. */
export function ActivityCard({ date }: { date: string }) {
  const { workouts, settings } = useStore();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Workout | null>(null);
  const today = workoutsOn(workouts, date);
  const burned = today.reduce((a, w) => a + w.calories, 0);
  const minutes = today.reduce((a, w) => a + w.minutes, 0);
  const credit = exerciseCreditOn(date);
  const share = settings.prefs?.exerciseCredit ?? 0;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell size={16} className="text-sky-600" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Exercise today</h2>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs font-semibold text-accent-600 py-1.5 px-2 -mr-2 rounded-full"
        >
          <Plus size={14} /> Log
        </button>
      </div>
      {today.length === 0 ? (
        <p className="text-xs text-gray-400 mt-2">
          Nothing yet. Log a walk, a run or a gym session — say it or type it, the AI does the rest.
        </p>
      ) : (
        <>
          <p className="text-11 text-gray-500 dark:text-gray-400 mt-1">
            <span className="font-semibold text-sky-600">{minutes} min</span>
            {burned > 0 && <> · <span className="font-semibold text-sky-600">{burned} kcal</span> burned</>}
            {credit > 0 ? <> · <span className="font-semibold text-emerald-600">+{credit} kcal</span> added to today's goal</> : null}
          </p>
          <div className="mt-1">
            <WorkoutList workouts={today} onEdit={setEditing} />
          </div>
        </>
      )}
      {today.length > 0 && share === 0 && (
        <p className="text-10 text-gray-400 mt-1">Exercise isn't added to your calorie goal — change that in Settings → Goals.</p>
      )}
      <WorkoutSheet open={adding} onClose={() => setAdding(false)} date={date} />
      <WorkoutSheet open={editing !== null} onClose={() => setEditing(null)} date={date} workout={editing} />
    </div>
  );
}
