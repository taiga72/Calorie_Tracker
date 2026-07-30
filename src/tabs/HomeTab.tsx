import { useState } from 'react';
import { useStore } from '@/store';
import { toKey, formatHeaderDate } from '@/lib/dateUtils';
import { fmtWeight } from '@/lib/units';
import { CalorieRing } from '@/components/CalorieRing';
import { LogModal } from '@/modals/LogModal';
import { CoachInsightCard } from '@/components/CoachInsightCard';
import { Scale, Coffee, Sun, Moon, Cookie, Pencil, Trash2, Utensils } from 'lucide-react';
import type { MealEntry } from '@/types';
import { getDailyQuote } from '@/data/quotes';

const MEAL_ORDER = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const MEAL_ICON: Record<string, typeof Coffee> = {
  Breakfast: Coffee, Lunch: Sun, Dinner: Moon, Snack: Cookie,
};

export function HomeTab() {
  const { getDay, settings, deleteMeal, profile } = useStore();
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const todayKey = toKey(new Date());
  const day = getDay(todayKey);
  const remaining = Math.max(settings.calorieGoal - day.totalCalories, 0);
  const pct = Math.round((day.totalCalories / Math.max(settings.calorieGoal, 1)) * 100);
  const latestWeight = [...day.weight ? [day.weight] : []][0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const displayName = profile.name.trim() || 'Friend';
  const dailyQuote = getDailyQuote();

  const mealsByType = MEAL_ORDER.map((type) => ({
    type, meals: day.meals.filter((m) => m.mealType === type),
  })).filter((g) => g.meals.length > 0);

  return (
    <div className="px-5 pt-6 pb-4">
      <div className="flex items-center gap-3">
        {profile.avatar && (
          <img src={profile.avatar} alt="avatar" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm text-gray-400 font-medium truncate">{formatHeaderDate(new Date())}</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5 truncate">{greeting}, {displayName}</h1>
        </div>
      </div>



      {/* Smart Coach Insight */}
      <div className="mt-4">
        <CoachInsightCard />
      </div>

      {/* Today's Macros */}
      {settings.calc?.recommendedMacros && (
        <div className="mt-4 bg-white rounded-3xl p-4 shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold tracking-wider text-gray-400">TODAY'S MACROS</span>
            <span className="text-[10px] font-semibold text-gray-300">g</span>
          </div>
          <MacroProgress
            label="Protein"
            value={day.totalProtein}
            target={settings.calc.recommendedMacros.protein}
            color="bg-emerald-500"
            track="bg-emerald-50"
            text="text-emerald-600"
          />
          <MacroProgress
            label="Carbs"
            value={day.totalCarbs}
            target={settings.calc.recommendedMacros.carbs}
            color="bg-orange-400"
            track="bg-orange-50"
            text="text-orange-500"
          />
          <MacroProgress
            label="Fat"
            value={day.totalFat}
            target={settings.calc.recommendedMacros.fat}
            color="bg-amber-300"
            track="bg-amber-50"
            text="text-amber-500"
          />
        </div>
      )}

      {/* Top metric cards */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        {/* Calorie card */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50 flex flex-col items-center">
          <span className="text-[10px] font-bold tracking-wider text-gray-400 self-start">TODAY'S CALORIES</span>
          <CalorieRing
            value={day.totalCalories}
            goal={settings.calorieGoal}
            size={108}
            label={`${Math.round(day.totalCalories)}`}
            sublabel={`of ${settings.calorieGoal}`}
          />
          <div className="w-full mt-2 flex justify-between text-[11px]">
            <span className="text-gray-400">Remaining</span>
            <span className="font-semibold text-gray-700">{Math.round(remaining)} kcal</span>
          </div>
          <div className="w-full mt-1 flex justify-between text-[11px]">
            <span className="text-gray-400">Progress</span>
            <span className="font-semibold text-orange-500">{pct}%</span>
          </div>
        </div>

        {/* Weight card */}
        <div className="bg-blue-600 rounded-3xl p-4 shadow-sm flex flex-col text-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-blue-100">TODAY'S WEIGHT</span>
            <Scale size={16} className="text-blue-100" />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            {latestWeight ? (
              <>
                <span className="text-3xl font-bold leading-none">{fmtWeight(latestWeight.weight, settings.weightUnit, 1).split(' ')[0]}</span>
                <span className="text-xs text-blue-100 mt-1">{settings.weightUnit}</span>
              </>
            ) : (
              <span className="text-sm text-blue-100 mt-6 mb-6">No weight logged</span>
            )}
          </div>
          <div className="text-[11px] text-blue-100">
            Goal {fmtWeight(settings.goalWeight, settings.weightUnit, 0)}
          </div>
        </div>
      </div>

      {/* Meals today count */}
      <div className="flex items-center justify-between mt-6">
        <h2 className="text-base font-bold text-gray-900">Meals today</h2>
        <span className="text-sm font-semibold text-emerald-600">{day.meals.length}</span>
      </div>

      {mealsByType.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 text-center border border-gray-50 mt-3">
          <p className="text-sm text-gray-400">No meals logged yet.</p>
          <p className="text-xs text-gray-300 mt-1">Tap the + button to log your first meal.</p>
        </div>
      ) : (
        <div className="space-y-3 mt-3">
          {mealsByType.map(({ type, meals }) => {
            const Icon = MEAL_ICON[type];
            const typeCals = meals.reduce((a, b) => a + b.calories, 0);
            return (
              <div key={type} className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                  <Icon size={15} className="text-gray-400" />
                  <span className="text-sm font-bold text-gray-900">{type}</span>
                  <span className="text-xs text-gray-400 ml-auto">• {Math.round(typeCals)} kcal</span>
                </div>
                <div className="px-4 divide-y divide-gray-50">
                  {meals.map((m) => {
                    const itemNames = m.items.map((i) => i.name).join(', ');
                    const thumb = m.imageDatas?.[0] || m.imageData;
                    return (
                      <div key={m.id} className="flex items-center gap-3 py-2.5">
                        {thumb ? (
                          <div className="relative flex-shrink-0">
                            <img src={thumb} alt="meal" className="w-11 h-11 rounded-2xl object-cover" />
                            {m.imageDatas && m.imageDatas.length > 1 && (
                              <span className="absolute -bottom-1 -right-1 bg-black/60 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">+{m.imageDatas.length - 1}</span>
                            )}
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Utensils size={16} className="text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{itemNames || m.mealType}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            <span className="text-orange-500 font-semibold">{Math.round(m.calories)} kcal</span>
                            {' · P '}{m.protein.toFixed(0)}g · C {m.carbs.toFixed(0)}g · F {m.fat.toFixed(0)}g
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={() => setEditing(m)} className="text-gray-300 hover:text-emerald-600 transition-colors p-1" aria-label="Edit meal">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteMeal(m.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1" aria-label="Delete meal">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Total banner */}
      <div className="mt-4 bg-gray-900 rounded-2xl p-4 flex items-center justify-between text-white">
        <span className="text-sm font-medium text-gray-300">Total today</span>
        <span className="text-lg font-bold">{Math.round(day.totalCalories)} kcal</span>
      </div>

      <LogModal open={editing !== null} onClose={() => setEditing(null)} editMeal={editing} />
    </div>
  );
}

function MacroProgress({ label, value, target, color, track, text }: {
  label: string; value: number; target: number; color: string; track: string; text: string;
}) {
  const safeTarget = Math.max(target, 1);
  const pct = Math.min(Math.round((value / safeTarget) * 100), 100);
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className={`text-xs font-bold ${text}`}>{Math.round(value)}<span className="text-gray-300 font-medium"> / {Math.round(target)}</span></span>
      </div>
      <div className={`h-2 w-full rounded-full overflow-hidden ${track}`}>
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
