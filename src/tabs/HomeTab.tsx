import { useState } from 'react';
import { useStore } from '@/store';
import { toKey, addDays, formatHeaderDate, isToday, isFuture } from '@/lib/dateUtils';
import { fmtWeight } from '@/lib/units';
import { CalorieRing } from '@/components/CalorieRing';
import { MealCard } from '@/components/MealCard';
import { LogModal } from '@/modals/LogModal';
import { Scale, Coffee, Sun, Moon, Cookie, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { MealEntry } from '@/types';

const MEAL_ORDER = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const MEAL_ICON: Record<string, typeof Coffee> = {
  Breakfast: Coffee, Lunch: Sun, Dinner: Moon, Snack: Cookie,
};

export function HomeTab() {
  const { getDay, settings, deleteMeal } = useStore();
  const [selectedDate, setSelectedDate] = useState(toKey(new Date()));
  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState<MealEntry | null>(null);

  const day = getDay(selectedDate);
  const todayKey = toKey(new Date());
  const isPrev = isToday(selectedDate);
  const isNextDisabled = isFuture(selectedDate) && selectedDate >= todayKey;
  const canGoNext = selectedDate < todayKey;

  const grouped = MEAL_ORDER.map((type) => ({
    type,
    Icon: MEAL_ICON[type],
    meals: day.meals.filter((m) => m.mealType === type),
  })).filter((g) => g.meals.length > 0);

  return (
    <div className="px-5 pt-6 pb-4">
      {/* Date header + navigation */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:scale-95 transition-transform"
          aria-label="Previous day"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">{formatHeaderDate(selectedDate)}</h1>
          <p className="text-xs text-gray-400">{day.meals.length} meal{day.meals.length === 1 ? '' : 's'} logged</p>
        </div>
        <button
          onClick={() => canGoNext && setSelectedDate(addDays(selectedDate, 1))}
          disabled={!canGoNext}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-30 active:scale-95 transition-transform"
          aria-label="Next day"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50 flex flex-col items-center justify-center">
          <CalorieRing consumed={day.totalCalories} goal={settings.calorieGoal} size={130} />
        </div>
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-blue-500 mb-1">
              <Scale size={16} />
              <span className="text-xs font-semibold text-gray-400">Weight</span>
            </div>
            {day.weight ? (
              <p className="text-2xl font-bold text-gray-900">{fmtWeight(day.weight.weight, settings.weightUnit)}</p>
            ) : (
              <p className="text-sm text-gray-300">Not logged</p>
            )}
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-emerald-500 mb-1">
              <Coffee size={16} />
              <span className="text-xs font-semibold text-gray-400">Goal</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{settings.calorieGoal}</p>
            <p className="text-[11px] text-gray-400">kcal / day</p>
          </div>
        </div>
      </div>

      {/* Log button */}
      <button
        onClick={() => setLogOpen(true)}
        className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 mb-4 active:scale-[.99] transition-transform"
      >
        <Plus size={18} /> Log meal / weight
      </button>

      {/* Meals list */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-900">Meals</h2>
        <span className="text-xs text-gray-400">{Math.round(day.totalCalories)} kcal</span>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-12 text-gray-300 text-sm">No meals logged yet. Tap "Log meal" to get started.</div>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.type}>
              <div className="flex items-center gap-2 mb-2">
                <g.Icon size={15} className="text-gray-400" />
                <h3 className="text-xs font-bold text-gray-500">{g.type}</h3>
              </div>
              <div className="space-y-2.5">
                {g.meals.map((m) => (
                  <MealCard key={m.id} meal={m} onDelete={deleteMeal} onEdit={(meal) => setEditing(meal)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <LogModal open={logOpen} onClose={() => setLogOpen(false)} targetDate={selectedDate} />
      <LogModal open={editing !== null} onClose={() => setEditing(null)} editMeal={editing} />
    </div>
  );
}
