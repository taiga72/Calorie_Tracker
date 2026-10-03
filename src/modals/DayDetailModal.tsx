import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { addDays, fromKey, formatHeaderDate, isToday, relativeDayLabel, toKey } from '@/lib/dateUtils';
import { useHorizontalSwipe } from '@/lib/useHorizontalSwipe';
import { fmtWeight } from '@/lib/units';
import { Modal } from '@/components/Modal';
import { LogModal } from '@/modals/LogModal';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { MealPhoto } from '@/components/MealPhoto';
import { PinMealButton } from '@/components/PinMealButton';
import { useUndoToast } from '@/components/UndoToastProvider';
import { Flame, Beef, Wheat, Droplet, Sparkles, Scale, Plus, Pencil, Coffee, Sun, Moon, Cookie, Utensils, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MealEntry } from '@/types';

const MEAL_ORDER = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

/** "Wed 7" — compact label for the previous/next day buttons. */
function formatDayShort(key: string): string {
  return fromKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}
const MEAL_ICON: Record<string, typeof Coffee> = {
  Breakfast: Coffee, Lunch: Sun, Dinner: Moon, Snack: Cookie,
};

interface DayDetailModalProps {
  dateKey: string | null;
  onClose: () => void;
  /** Move to the previous (-1) or next (+1) day; enables swiping between days. */
  onNavigate?: (delta: 1 | -1) => void;
}

export function DayDetailModal({ dateKey, onClose, onNavigate }: DayDetailModalProps) {
  const { getDay, settings, addMeal, deleteMeal, loadPhotos } = useStore();
  const { requestUndo } = useUndoToast();
  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const open = dateKey !== null;
  const [slideFrom, setSlideFrom] = useState<'left' | 'right' | null>(null);
  const go = (delta: 1 | -1) => {
    if (!onNavigate) return;
    setSlideFrom(delta > 0 ? 'right' : 'left');
    onNavigate(delta);
  };
  // Swipe left for the next day, right for the previous one. Meal rows keep
  // their own swipe-to-delete.
  const { dragX, handlers: swipeHandlers } = useHorizontalSwipe({
    onSwipeLeft: () => go(1),
    onSwipeRight: () => go(-1),
    ignoreSelector: '[data-swipe-row]',
  });
  useEffect(() => { if (!open) setSlideFrom(null); }, [open]);
  const day = dateKey ? getDay(dateKey) : null;
  // Only recent photos are loaded up front; older days fetch theirs here.
  const mealIdsKey = day ? day.meals.map((m) => m.id).join(',') : '';
  useEffect(() => {
    if (mealIdsKey) void loadPhotos(mealIdsKey.split(','));
  }, [mealIdsKey, loadPhotos]);

  const mealsByType = day ? MEAL_ORDER.map((type) => ({
    type, meals: day.meals.filter((m) => m.mealType === type),
  })).filter((g) => g.meals.length > 0) : [];

  const onDeleteMeal = (meal: MealEntry) => {
    deleteMeal(meal.id);
    const { id, createdAt, ...rest } = meal;
    requestUndo('Meal deleted', () => addMeal(rest));
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={dateKey ? formatHeaderDate(fromKey(dateKey)) : ''}>
        {day && dateKey && (
          <div
            {...(onNavigate ? swipeHandlers : {})}
            className="touch-pan-y"
            style={{ transform: dragX ? `translateX(${dragX * 0.35}px)` : undefined, transition: dragX ? 'none' : 'transform .2s ease' }}
          >
          <div
            key={dateKey}
            className={`motion-reduce:animate-none ${slideFrom === 'right' ? 'animate-[calSlideFromRight_.22s_ease-out]' : slideFrom === 'left' ? 'animate-[calSlideFromLeft_.22s_ease-out]' : ''}`}
          >
            {onNavigate ? (
              <div className="flex items-center justify-between -mt-1 mb-3">
                <button
                  onClick={() => go(-1)}
                  aria-label="Previous day"
                  className="flex items-center gap-0.5 text-xs font-semibold text-gray-400 hover:text-emerald-600 py-1 pr-2 transition-colors"
                >
                  <ChevronLeft size={15} /> {formatDayShort(toKey(addDays(fromKey(dateKey), -1)))}
                </button>
                <span className="text-[11px] font-semibold text-gray-400">{isToday(dateKey) ? 'Today' : relativeDayLabel(dateKey)}</span>
                <button
                  onClick={() => go(1)}
                  aria-label="Next day"
                  className="flex items-center gap-0.5 text-xs font-semibold text-gray-400 hover:text-emerald-600 py-1 pl-2 transition-colors"
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

            {/* Stat pills */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { label: 'Calories', val: String(Math.round(day.totalCalories)), Icon: Flame, color: 'text-orange-500 bg-orange-50 dark:bg-orange-950' },
                { label: 'Protein', val: `${day.totalProtein.toFixed(1)}g`, Icon: Beef, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950' },
                { label: 'Carbs', val: `${day.totalCarbs.toFixed(0)}g`, Icon: Wheat, color: 'text-orange-400 bg-orange-50 dark:bg-orange-950' },
                { label: 'Fat', val: `${day.totalFat.toFixed(1)}g`, Icon: Droplet, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950' },
                { label: 'Fiber', val: `${day.totalFiber.toFixed(1)}g`, Icon: Sparkles, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950' },
              ].map(({ label, val, Icon, color }) => (
                <div key={label} className={`rounded-2xl p-3 flex flex-col items-center ${color}`}>
                  <Icon size={16} />
                  <span className="text-base font-bold mt-1">{val}</span>
                  <span className="text-[10px] font-medium opacity-80">{label}</span>
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
                className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full active:scale-95 transition-transform"
              >
                <Plus size={14} /> Log Meal
              </button>
            </div>
            {day.meals.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No meals logged this day.</p>
            ) : (
              <div className="space-y-3">
                {mealsByType.map(({ type, meals }) => {
                  const Icon = MEAL_ICON[type];
                  const typeCals = meals.reduce((a, b) => a + b.calories, 0);
                  return (
                    <div key={type} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-50 dark:border-gray-800 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50 dark:border-gray-800">
                        <Icon size={15} className="text-gray-400" />
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{type}</span>
                        <span className="text-xs text-gray-400 ml-auto">• {Math.round(typeCals).toLocaleString()} kcal</span>
                      </div>
                      <div className="px-4 divide-y divide-gray-50 dark:divide-gray-800">
                        {meals.map((m) => {
                          const itemNames = m.items.map((i) => i.name).join(', ');
                          const thumb = m.imageDatas?.[0] || m.imageData;
                          return (
                            <SwipeToDelete key={m.id} onDelete={() => onDeleteMeal(m)}>
                              <div className="flex items-center gap-3 py-2.5">
                                {thumb ? (
                                  <div className="relative flex-shrink-0">
                                    <MealPhoto src={thumb} alt="meal" className="w-11 h-11 rounded-2xl object-cover" />
                                    {m.imageDatas && m.imageDatas.length > 1 && (
                                      <span className="absolute -bottom-1 -right-1 bg-black/60 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">+{m.imageDatas.length - 1}</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                                    <Utensils size={16} className="text-gray-300" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{itemNames || m.mealType}</p>
                                  <p className="text-[11px] text-gray-400 mt-0.5">
                                    <span className="text-orange-500 font-semibold">{Math.round(m.calories)} kcal</span>
                                    {' · P '}{m.protein.toFixed(0)}g · C {m.carbs.toFixed(0)}g · F {m.fat.toFixed(0)}g
                                  </p>
                                </div>
                                <PinMealButton meal={m} />
                                <button onClick={() => setEditing(m)} className="flex-shrink-0 text-gray-300 hover:text-emerald-600 transition-colors p-1" aria-label="Edit meal">
                                  <Pencil size={14} />
                                </button>
                              </div>
                            </SwipeToDelete>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
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
        <LogModal open={weightOpen} onClose={() => setWeightOpen(false)} weightDate={dateKey} initialMode="weight" />
      )}
    </>
  );
}
