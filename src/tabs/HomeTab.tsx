import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { toKey, addDays, formatHeaderDate, relativeDayLabel } from '@/lib/dateUtils';
import { fmtWeight } from '@/lib/units';
import { CalorieRing } from '@/components/CalorieRing';
import { LogModal } from '@/modals/LogModal';
import { PullToRefresh } from '@/components/PullToRefresh';
import { MealList } from '@/components/MealList';
import { useGoalForecast } from '@/lib/useGoalForecast';
import { formatForecastDate } from '@/lib/forecast';
import { WeeklyRecapCard } from '@/components/WeeklyRecapCard';
import { recapPeriod, showRecapOnHome } from '@/lib/weeklyRecap';
import { isOverGoal, isPartialDay } from '@/lib/goal';
import { fiberTarget, macroTargets } from '@/lib/macros';
import { calculateStreak } from '@/lib/streakUtils';
import { Scale, Flame } from 'lucide-react';
import type { MealEntry } from '@/types';

export function HomeTab() {
  const { getDay, settings, meals, profile, weights, refresh, refreshing } = useStore();
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const todayKey = toKey(new Date());
  const day = getDay(todayKey);
  const goal = settings.calorieGoal;
  const remaining = Math.max(goal - day.totalCalories, 0);
  // Up to 5% over still counts as on target (see lib/goal).
  const overTarget = isOverGoal(day.totalCalories, goal);
  const overAmount = Math.round(day.totalCalories - goal);
  const macros = macroTargets(settings);
  const streak = useMemo(() => calculateStreak(meals).count, [meals]);
  // The last 7 finished days, fully logged ones only — the ring already
  // shows today, so this is the bigger picture.
  const weekAvg = useMemo(() => {
    const totals = Array.from({ length: 7 }, (_, i) => getDay(toKey(addDays(new Date(), -(i + 1)))).totalCalories)
      .filter((c) => c > 0 && !isPartialDay(c, goal));
    return totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : null;
  }, [getDay, goal]);
  // `weights` is kept sorted ascending by date, so the last entry is the most
  // recent one logged — not necessarily today's, which is what the card
  // should actually show (see "why is the app not showing the saved weight").
  const latestWeight = weights.length > 0 ? weights[weights.length - 1] : undefined;
  const forecast = useGoalForecast();
  // The end-of-week brief, Friday to Sunday until dismissed; it's always on Stats.
  const [recapVisible, setRecapVisible] = useState(() => showRecapOnHome(new Date(), recapPeriod(new Date()).start));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const displayName = profile.name.trim() || 'Friend';

  return (
    <PullToRefresh onRefresh={refresh} refreshing={refreshing}>
    <div className="px-5 pt-6 pb-28">
      <div className="flex items-center gap-3">
        {profile.avatar && (
          <img src={profile.avatar} alt="avatar" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-400 font-medium truncate">{formatHeaderDate(new Date())}</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5 truncate">{greeting}, {displayName}</h1>
        </div>
        {streak > 0 && (
          <span
            className="flex-shrink-0 self-start mt-1 inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-300 px-2.5 py-1 text-xs font-bold"
            aria-label={`${streak} day logging streak`}
          >
            <Flame size={13} /> {streak}
          </span>
        )}
      </div>

      {/* Balanced Dashboard Grid (Calories Left, Weight + Macros Right) */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        
        {/* Left Column: Today's Calories */}
        <div className={`bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-sm border flex flex-col justify-between transition-colors duration-300 ${overTarget ? 'border-rose-100 dark:border-rose-900' : 'border-gray-50 dark:border-gray-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-gray-400">TODAY'S CALORIES</span>
            {overTarget && (
              <span className="inline-flex items-center justify-center whitespace-nowrap text-[8px] font-extrabold text-rose-600 bg-rose-100/90 px-2 py-1 rounded-full uppercase tracking-wider leading-none">
      OVER TARGET
    </span>
            )}
          </div>
          <div className="my-auto py-2 flex justify-center">
            <CalorieRing
              value={day.totalCalories}
              goal={goal}
              size={108}
              color={overTarget ? '#F43F5E' : '#F97316'}
              label={`${Math.round(day.totalCalories)}`}
              sublabel={`of ${goal}`}
            />
          </div>
          <div className="w-full space-y-1 pt-2 border-t border-gray-50 dark:border-gray-800 text-[11px]">
            {overTarget ? (
              <div className="flex justify-between">
                <span className="text-rose-400">Over target</span>
                <span className="font-bold text-rose-600">+{overAmount} kcal</span>
              </div>
            ) : overAmount > 0 ? (
              <div className="flex justify-between">
                <span className="text-gray-400">On target</span>
                <span className="font-semibold text-gray-700 dark:text-gray-200">+{overAmount} kcal</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-gray-400">Remaining</span>
                <span className="font-semibold text-gray-700 dark:text-gray-200">{Math.round(remaining).toLocaleString()} kcal</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">7-day avg</span>
              <span className={`font-semibold ${weekAvg !== null && isOverGoal(weekAvg, goal) ? 'text-rose-600' : 'text-orange-500'}`}>
                {weekAvg !== null ? `${weekAvg.toLocaleString()} kcal` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Today's Weight + Today's Macros Stacked */}
        <div className="flex flex-col gap-3 justify-between">
          
          {/* Top Half: Latest Weight — tap to log today's weight */}
          <button
            onClick={() => setWeightOpen(true)}
            aria-label="Log weight"
            className="bg-blue-600 rounded-3xl p-3.5 shadow-sm text-white flex flex-col justify-between text-left active:scale-[.98] transition-transform"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-blue-100">LATEST WEIGHT</span>
              <Scale size={15} className="text-blue-100" />
            </div>
            <div className="my-1">
              {latestWeight ? (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-2xl font-bold leading-none">{fmtWeight(latestWeight.weight, settings.weightUnit, 1).split(' ')[0]}</span>
                  <span className="text-xs text-blue-100">{settings.weightUnit}</span>
                  {latestWeight.date !== todayKey && (
                    <span className="text-[9px] font-semibold text-blue-50 bg-white/15 px-1.5 py-0.5 rounded-full">
                      {relativeDayLabel(latestWeight.date)}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-blue-100 block">No weight logged</span>
              )}
            </div>
            <span className="text-[10px] text-blue-100 block">
              Goal {fmtWeight(settings.goalWeight, settings.weightUnit, 0)}
              {forecast.status === 'on-track' && <> · by ~{formatForecastDate(forecast.date, false)}</>}
            </span>
          </button>

          {/* Bottom Half: Today's Macros (Compact Font Layout) */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-3 shadow-sm border border-gray-50 dark:border-gray-800 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold tracking-wider text-gray-400">TODAY'S MACROS</span>
              <span className="text-[8px] font-semibold text-gray-300">g</span>
            </div>
            <MacroProgress label="Protein" value={day.totalProtein} target={macros?.protein} color="bg-emerald-500" track="bg-emerald-50 dark:bg-emerald-950" text="text-emerald-600" />
            <MacroProgress label="Carbs" value={day.totalCarbs} target={macros?.carbs} color="bg-orange-400" track="bg-orange-50 dark:bg-orange-950" text="text-orange-500" />
            <MacroProgress label="Fat" value={day.totalFat} target={macros?.fat} color="bg-amber-300" track="bg-amber-50 dark:bg-amber-950" text="text-amber-500" />
            <MacroProgress label="Fiber" value={day.totalFiber || 0} target={fiberTarget(goal)} color="bg-purple-400" track="bg-purple-50 dark:bg-purple-950" text="text-purple-500" />
            {!macros && (
              <p className="text-[9px] text-gray-400 leading-tight mt-0.5">Set macro targets in Settings</p>
            )}
          </div>

        </div>

      </div>

      {recapVisible && (
        <div className="mt-4">
          <WeeklyRecapCard onDismiss={() => setRecapVisible(false)} />
        </div>
      )}

      {/* Meals today count */}
      <div className="flex items-center justify-between mt-6">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Meals today</h2>
        <span className="text-sm font-semibold text-emerald-600">{day.meals.length}</span>
      </div>

      {day.meals.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 text-center border border-gray-50 dark:border-gray-800 mt-3">
          <p className="text-sm text-gray-400">No meals logged yet.</p>
          <p className="text-xs text-gray-300 mt-1">Tap the + button to log your first meal.</p>
        </div>
      ) : (
        <div className="mt-3">
          <MealList meals={day.meals} onEdit={setEditing} />
        </div>
      )}

      <LogModal open={editing !== null} onClose={() => setEditing(null)} editMeal={editing} />
      <LogModal open={weightOpen} onClose={() => setWeightOpen(false)} weightDate={todayKey} initialMode="weight" />
    </div>
    </PullToRefresh>
  );
}

function MacroProgress({ label, value, target, color, track, text }: {
  label: string; value: number; target?: number; color: string; track: string; text: string;
}) {
  // No target set: show the grams eaten, without a made-up goal to fill.
  const pct = target ? Math.min(Math.round((value / Math.max(target, 1)) * 100), 100) : 0;
  return (
    <div className="mb-1 last:mb-0">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-medium text-gray-500">{label}</span>
        <span className={`text-[10px] font-bold ${text}`}>
          {Math.round(value)}
          {target ? <span className="text-gray-300 font-normal">/{Math.round(target)}</span> : <span className="text-gray-300 font-normal"> g</span>}
        </span>
      </div>
      {target ? (
        <div className={`h-1.5 w-full rounded-full overflow-hidden ${track}`}>
          <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className="h-1.5" />
      )}
    </div>
  );
}
