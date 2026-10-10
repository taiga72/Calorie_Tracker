import { useState } from 'react';
import { useStore } from '@/store';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { MealPhoto } from '@/components/MealPhoto';
import { PinMealButton } from '@/components/PinMealButton';
import { useUndoToast } from '@/components/UndoToastProvider';
import { isOverGoal } from '@/lib/goal';
import { calorieGoalOn } from '@/lib/goalPlan';
import { Coffee, Sun, Moon, Cookie, Pencil, Utensils, ChevronRight } from 'lucide-react';
import type { MealEntry, MealType, MealCalorieSplit } from '@/types';

const MEAL_ORDER: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const MEAL_ICON: Record<MealType, typeof Coffee> = {
  Breakfast: Coffee, Lunch: Sun, Dinner: Moon, Snack: Cookie,
};

/**
 * The per-meal calorie budget from the setup wizard / Settings, if set —
 * as a share of that day's goal, so it follows goal phases and weekday goals.
 */
function mealBudget(split: MealCalorieSplit | undefined, type: MealType, dayGoal: number): number | null {
  const v = split?.[type.toLowerCase() as keyof MealCalorieSplit];
  if (!split || !v || v <= 0) return null;
  const total = split.breakfast + split.lunch + split.dinner + split.snack;
  return total > 0 ? Math.round((v / total) * dayGoal / 10) * 10 : v;
}

/**
 * A day's meals grouped by meal type — the same list on Home and in the
 * calendar's day view. Rows swipe to delete (with undo) and pin; the pencil
 * calls `onEdit`, whose editor the parent renders outside any moving sheet.
 */
export function MealList({ meals, onEdit }: { meals: MealEntry[]; onEdit: (meal: MealEntry) => void }) {
  const { settings, addMeal, deleteMeal } = useStore();
  const { requestUndo } = useUndoToast();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const split = settings.calc?.suggestedMealSplit;
  const dayGoal = meals.length > 0 ? calorieGoalOn(settings, meals[0].date) : settings.calorieGoal;

  const groups = MEAL_ORDER
    .map((type) => ({ type, meals: meals.filter((m) => m.mealType === type) }))
    .filter((g) => g.meals.length > 0);

  const onDeleteMeal = (meal: MealEntry) => {
    deleteMeal(meal.id);
    const { id, createdAt, ...rest } = meal;
    requestUndo('Meal deleted', () => addMeal(rest));
  };

  return (
    <div className="space-y-3 compact:space-y-2">
      {groups.map(({ type, meals: group }) => {
        const Icon = MEAL_ICON[type];
        const typeCals = Math.round(group.reduce((a, b) => a + b.calories, 0));
        const budget = mealBudget(split, type, dayGoal);
        return (
          <div key={type} className="card card-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 compact:py-2 border-b border-gray-50 dark:border-gray-800">
              <Icon size={15} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">{type}</span>
              <span className="text-xs text-gray-400 ml-auto">
                •{' '}
                {budget ? (
                  <>
                    <span className={isOverGoal(typeCals, budget) ? 'font-semibold text-rose-500' : undefined}>{typeCals.toLocaleString()}</span>
                    {' / '}{budget.toLocaleString()} kcal
                  </>
                ) : (
                  `${typeCals.toLocaleString()} kcal`
                )}
              </span>
            </div>
            <div className="px-4 divide-y divide-gray-50 dark:divide-gray-800">
              {group.map((m) => {
                const itemNames = m.items.map((i) => i.name).join(', ');
                const thumb = m.imageDatas?.[0] || m.imageData;
                return (
                  <SwipeToDelete key={m.id} onDelete={() => onDeleteMeal(m)}>
                    <div className="flex items-center gap-3 py-2.5 compact:py-1.5">
                      {thumb ? (
                        <div className="relative flex-shrink-0">
                          <MealPhoto src={thumb} alt="meal" className="w-11 h-11 compact:w-9 compact:h-9 rounded-2xl object-cover" />
                          {m.imageDatas && m.imageDatas.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 bg-black/60 text-white text-9 font-bold rounded-full px-1.5 py-0.5">+{m.imageDatas.length - 1}</span>
                          )}
                        </div>
                      ) : (
                        <div className="w-11 h-11 compact:w-9 compact:h-9 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                          <Utensils size={16} className="text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{itemNames || m.mealType}</p>
                        <p className="text-11 text-gray-400 mt-0.5">
                          <span className="text-orange-500 font-semibold">{Math.round(m.calories)} kcal</span>
                          {' · P '}{m.protein.toFixed(0)}g · C {m.carbs.toFixed(0)}g · F {m.fat.toFixed(0)}g
                        </p>
                        {m.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => toggle(m.id)}
                            aria-expanded={expanded.has(m.id)}
                            className="mt-0.5 flex items-center gap-0.5 text-10 font-semibold text-gray-400 hover:text-accent-600"
                          >
                            <ChevronRight size={11} className={`transition-transform ${expanded.has(m.id) ? 'rotate-90' : ''}`} />
                            {m.items.length} items
                          </button>
                        )}
                      </div>
                      <PinMealButton meal={m} />
                      <button onClick={() => onEdit(m)} className="flex-shrink-0 text-gray-300 hover:text-accent-600 transition-colors p-1" aria-label="Edit meal">
                        <Pencil size={14} />
                      </button>
                    </div>
                    {/* Each food on its own, to pin just that one. */}
                    {m.items.length > 1 && expanded.has(m.id) && (
                      <ul className="pb-2.5 pl-14 compact:pl-12 space-y-1">
                        {m.items.map((it, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="flex-1 min-w-0 text-xs text-gray-600 dark:text-gray-300 truncate">{it.name}</span>
                            <span className="text-11 text-gray-400 flex-shrink-0">{Math.round(it.calories)} kcal</span>
                            <PinMealButton item={it} mealType={m.mealType} size={13} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </SwipeToDelete>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
