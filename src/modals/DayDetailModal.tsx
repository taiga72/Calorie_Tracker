import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import { addDays, fromKey, formatHeaderDate, isToday, relativeDayLabel, toKey } from '@/lib/dateUtils';
import { useHorizontalSwipe } from '@/lib/useHorizontalSwipe';
import { fmtWeight } from '@/lib/units';
import { Modal } from '@/components/Modal';
import { LogModal } from '@/modals/LogModal';
import { MealList } from '@/components/MealList';
import { WorkoutList, WorkoutSheet } from '@/components/ActivityCard';
import { workoutsOn } from '@/lib/workouts';
import { fmtGrams } from '@/lib/macros';
import { calorieGoalOn } from '@/lib/goalPlan';
import { Flame, Beef, Wheat, Droplet, Sparkles, Scale, Plus, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MealEntry, Workout } from '@/types';

const TURN_OUT_MS = 170;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** "Wed 7" — compact label for the previous/next day buttons. */
function formatDayShort(key: string): string {
  return fromKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}
interface DayDetailModalProps {
  dateKey: string | null;
  onClose: () => void;
  /** Move to the previous (-1) or next (+1) day; enables swiping between days. */
  onNavigate?: (delta: 1 | -1) => void;
}

export function DayDetailModal({ dateKey, onClose, onNavigate }: DayDetailModalProps) {
  const { getDay, settings, loadPhotos, workouts } = useStore();
  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const open = dateKey !== null;
  // Turning to another day, like a page: the day follows the finger, slides
  // fully off on release, and the next one slides in from the other edge.
  const [turn, setTurn] = useState<{ phase: 'out' | 'in'; dir: 1 | -1 } | null>(null);
  const turnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (turnTimer.current) clearTimeout(turnTimer.current); }, []);
  const go = (delta: 1 | -1) => {
    if (!onNavigate || turn?.phase === 'out') return;
    if (prefersReducedMotion()) { onNavigate(delta); return; }
    setTurn({ phase: 'out', dir: delta });
    turnTimer.current = setTimeout(() => {
      onNavigate(delta);
      setTurn({ phase: 'in', dir: delta });
    }, TURN_OUT_MS);
  };
  // Swipe left for the next day, right for the previous one. Meal rows keep
  // their own swipe-to-delete.
  const { dragX, handlers: swipeHandlers } = useHorizontalSwipe({
    onSwipeLeft: () => go(1),
    onSwipeRight: () => go(-1),
    ignoreSelector: '[data-swipe-row]',
  });
  useEffect(() => { if (!open) setTurn(null); }, [open]);
  const pageStyle = turn?.phase === 'out'
    ? { transform: `translateX(${turn.dir > 0 ? '-110%' : '110%'})`, opacity: 0.4, transition: `transform ${TURN_OUT_MS}ms ease-in, opacity ${TURN_OUT_MS}ms ease-in` }
    : turn?.phase === 'in'
      ? { transition: 'none' }
      : dragX
        ? { transform: `translateX(${dragX}px)`, opacity: 1 - Math.min(Math.abs(dragX) / 500, 0.4), transition: 'none' }
        : { transition: 'transform .25s cubic-bezier(.2,.8,.2,1), opacity .25s' };
  const day = dateKey ? getDay(dateKey) : null;
  const dayWorkouts = dateKey ? workoutsOn(workouts, dateKey) : [];
  const dayGoal = dateKey ? calorieGoalOn(settings, dateKey) : settings.calorieGoal;
  // Only recent photos are loaded up front; older days fetch theirs here.
  const mealIdsKey = day ? day.meals.map((m) => m.id).join(',') : '';
  useEffect(() => {
    if (mealIdsKey) void loadPhotos(mealIdsKey.split(','));
  }, [mealIdsKey, loadPhotos]);

  return (
    <>
      <Modal open={open} onClose={onClose} title={dateKey ? formatHeaderDate(fromKey(dateKey)) : ''}>
        {day && dateKey && (
          <div
            {...(onNavigate ? swipeHandlers : {})}
            className="touch-pan-y"
            style={pageStyle}
          >
          <div
            key={dateKey}
            onAnimationEnd={() => setTurn((t) => (t?.phase === 'in' ? null : t))}
            className={`motion-reduce:animate-none ${turn?.phase === 'in' ? (turn.dir > 0 ? 'animate-[dayTurnFromRight_.26s_cubic-bezier(.2,.8,.2,1)]' : 'animate-[dayTurnFromLeft_.26s_cubic-bezier(.2,.8,.2,1)]') : ''}`}
          >
            {onNavigate ? (
              <div className="flex items-center justify-between -mt-1 mb-3">
                <button
                  onClick={() => go(-1)}
                  aria-label="Previous day"
                  className="flex items-center gap-0.5 text-xs font-semibold text-gray-400 hover:text-accent-600 py-1 pr-2 transition-colors"
                >
                  <ChevronLeft size={15} /> {formatDayShort(toKey(addDays(fromKey(dateKey), -1)))}
                </button>
                <span className="text-11 font-semibold text-gray-400">{isToday(dateKey) ? 'Today' : relativeDayLabel(dateKey)}</span>
                <button
                  onClick={() => go(1)}
                  aria-label="Next day"
                  className="flex items-center gap-0.5 text-xs font-semibold text-gray-400 hover:text-accent-600 py-1 pl-2 transition-colors"
                >
                  {formatDayShort(toKey(addDays(fromKey(dateKey), 1)))} <ChevronRight size={15} />
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mb-3">{isToday(dateKey) ? 'Today' : ''}</p>
            )}

            {/* Weight stat - interactive */}
            {day.weight ? (
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950 rounded-2xl p-3 mb-4">
                <Scale size={18} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Weight</span>
                <span className="ml-auto text-lg font-bold text-blue-700 dark:text-blue-300">
                  {fmtWeight(day.weight.weight, settings.weightUnit, 1)}
                </span>
                <button
                  onClick={() => setWeightOpen(true)}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                  aria-label="Edit weight"
                >
                  <Pencil size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setWeightOpen(true)}
                className="w-full flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 mb-4 active:scale-[.99] transition-transform"
              >
                <Scale size={18} className="text-gray-400" />
                <span className="text-sm text-gray-400">No weight logged this day</span>
                <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600">
                  <Plus size={14} /> Add weight
                </span>
              </button>
            )}

            {/* Stat pills: calories (against that day's goal) across two columns, then the macros */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="col-span-2 rounded-2xl p-3 flex items-center gap-3 text-orange-500 bg-orange-50 dark:bg-orange-950/40">
                <Flame size={20} className="flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xl font-bold leading-tight">{Math.round(day.totalCalories).toLocaleString()}</p>
                  <p className="text-10 font-medium opacity-80">of {dayGoal.toLocaleString()} kcal</p>
                </div>
              </div>
              {[
                { label: 'Protein', val: fmtGrams(day.totalProtein), Icon: Beef, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' },
                { label: 'Carbs', val: fmtGrams(day.totalCarbs), Icon: Wheat, color: 'text-orange-400 bg-orange-50 dark:bg-orange-950/40' },
                { label: 'Fat', val: fmtGrams(day.totalFat), Icon: Droplet, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40' },
                { label: 'Fiber', val: fmtGrams(day.totalFiber), Icon: Sparkles, color: 'text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40' },
              ].map(({ label, val, Icon, color }) => (
                <div key={label} className={`rounded-2xl p-3 flex flex-col items-center ${color}`}>
                  <Icon size={16} />
                  <span className="text-base font-bold mt-1">{val}g</span>
                  <span className="text-10 font-medium opacity-80">{label}</span>
                </div>
              ))}
            </div>

            {/* Meal cards */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Meals ({day.meals.length})
              </h3>
              <button
                onClick={() => setLogOpen(true)}
                className="flex items-center gap-1 bg-accent-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full active:scale-95 transition-transform"
              >
                <Plus size={14} /> Log meal
              </button>
            </div>
            {day.meals.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No meals logged this day.</p>
            ) : (
              <MealList meals={day.meals} onEdit={setEditing} />
            )}

            {/* Exercise */}
            <div className="flex items-center justify-between mt-5 mb-1">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Exercise ({dayWorkouts.length})
              </h3>
              <button
                onClick={() => setWorkoutOpen(true)}
                className="flex items-center gap-1 text-accent-600 text-xs font-semibold px-2 py-1.5 -mr-2 rounded-full"
              >
                <Plus size={14} /> Log exercise
              </button>
            </div>
            {dayWorkouts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">No exercise logged this day.</p>
            ) : (
              <div className="card card-sm px-4">
                <WorkoutList workouts={dayWorkouts} onEdit={setEditingWorkout} />
              </div>
            )}
          </div>
          </div>
        )}
      </Modal>

      {dateKey && (
        <LogModal open={logOpen} onClose={() => setLogOpen(false)} targetDate={dateKey} />
      )}
      <LogModal open={editing !== null} onClose={() => setEditing(null)} editMeal={editing} />
      {dateKey && (
        <WorkoutSheet open={workoutOpen || editingWorkout !== null} onClose={() => { setWorkoutOpen(false); setEditingWorkout(null); }} date={dateKey} workout={editingWorkout} />
      )}
      {dateKey && (
        <LogModal open={weightOpen} onClose={() => setWeightOpen(false)} weightDate={dateKey} initialMode="weight" />
      )}
    </>
  );
}
