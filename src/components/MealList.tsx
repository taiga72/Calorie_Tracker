import { useStore } from '@/store';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { MealPhoto } from '@/components/MealPhoto';
import { PinMealButton } from '@/components/PinMealButton';
import { useUndoToast } from '@/components/UndoToastProvider';
import { isOverGoal } from '@/lib/goal';
import { Coffee, Sun, Moon, Cookie, Pencil, Utensils } from 'lucide-react';
import type { MealEntry, MealType, MealCalorieSplit } from '@/types';

const MEAL_ORDER: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const MEAL_ICON: Record<MealType, typeof Coffee> = {
  Breakfast: Coffee, Lunch: Sun, Dinner: Moon, Snack: Cookie,
};

/** The per-meal calorie budget from the setup wizard / Settings, if set. */
function mealBudget(split: MealCalorieSplit | undefined, type: MealType): number | null {
  const v = split?.[type.toLowerCase() as keyof MealCalorieSplit];
  return v && v > 0 ? v : null;
}

/**
 * A day's meals grouped by meal type — the same list on Home and in the
 * calendar's day view. Rows swipe to delete (with undo) and pin; the pencil
 * calls `onEdit`, whose editor the parent renders outside any moving sheet.
 */
export function MealList({ meals, onEdit }: { meals: MealEntry[]; onEdit: (meal: MealEntry) => void }) {
  const { settings, addMeal, deleteMeal } = useStore();
  const { requestUndo } = useUndoToast();
  const split = settings.calc?.suggestedMealSplit;

  const groups = MEAL_ORDER
    .map((type) => ({ type, meals: meals.filter((m) => m.mealType === type) }))
    .filter((g) => g.meals.length > 0);

  const onDeleteMeal = (meal: MealEntry) => {
    deleteMeal(meal.id);
    const { id, createdAt, ...rest } = meal;
    requestUndo('Meal deleted', () => addMeal(rest));
  };

  return (
    <div className="space-y-3">
      {groups.map(({ type, meals: group }) => {
        const Icon = MEAL_ICON[type];
        const typeCals = Math.round(group.reduce((a, b) => a + b.calories, 0));
        const budget = mealBudget(split, type);
        return (
          <div key={type} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-50 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50 dark:border-gray-800">
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
                      <button onClick={() => onEdit(m)} className="flex-shrink-0 text-gray-300 hover:text-emerald-600 transition-colors p-1" aria-label="Edit meal">
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
  );
}
