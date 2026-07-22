import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { todayKey, toKey } from '@/lib/dateUtils';
import { LogModal } from '@/modals/LogModal';
import type { MealEntry } from '@/types';
import { Plus, Flame, Beef, Wheat, Droplet, Trash2, Sparkles, type LucideIcon } from 'lucide-react';

export function Dashboard() {
  const { profile } = useAuth();
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayKey());

  const loadMeals = useCallback(async () => {
    if (!profile) return;
    const startOfDay = new Date(selectedDate + 'T00:00:00');
    const endOfDay = new Date(selectedDate + 'T23:59:59');
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .gte('logged_at', startOfDay.toISOString())
      .lte('logged_at', endOfDay.toISOString())
      .order('logged_at', { ascending: false });
    if (error) {
      console.error('Failed to load meals:', error.message);
      return;
    }
    setMeals((data as MealEntry[]) || []);
    setLoading(false);
  }, [profile, selectedDate]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
      fiber: acc.fiber + m.fiber,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  const targetCal = profile?.target_daily_calories || 2000;
  const targetProtein = profile?.target_protein_g || 150;
  const targetCarbs = profile?.target_carbs_g || 200;
  const targetFat = profile?.target_fat_g || 67;

  const deleteMeal = async (id: string) => {
    const { error } = await supabase.from('meals').delete().eq('id', id);
    if (error) {
      console.error('Delete failed:', error.message);
      return;
    }
    setMeals((prev) => prev.filter((m) => m.id !== id));
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(toKey(d));
    setLoading(true);
  };

  const isToday = selectedDate === todayKey();
  const calPct = Math.min(100, (totals.calories / targetCal) * 100);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDate(-1)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            ←
          </button>
          {!isToday && (
            <button
              onClick={() => shiftDate(1)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              →
            </button>
          )}
        </div>
      </div>

      {/* Calorie ring */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm mb-4">
        <div className="flex items-center gap-6">
          <div className="relative w-32 h-32 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10"
                className="stroke-gray-100 dark:stroke-gray-700" />
              <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" strokeLinecap="round"
                className="stroke-primary-500 transition-all duration-500"
                strokeDasharray={`${(calPct / 100) * 327} 327`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totals.calories}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">/ {targetCal}</span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Daily Calories</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {Math.max(0, targetCal - totals.calories)}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {Math.max(0, targetCal - totals.calories)} kcal remaining
            </p>
          </div>
        </div>
      </div>

      {/* Macro cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <MacroCard icon={Beef} label="Protein" value={totals.protein} target={targetProtein} color="blue" />
        <MacroCard icon={Wheat} label="Carbs" value={totals.carbs} target={targetCarbs} color="amber" />
        <MacroCard icon={Droplet} label="Fat" value={totals.fat} target={targetFat} color="rose" />
      </div>

      {/* Log button */}
      <button
        onClick={() => setLogOpen(true)}
        className="w-full bg-primary-500 text-white font-semibold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/20 mb-6"
      >
        <Sparkles size={18} /> Log a Meal with AI
      </button>

      {/* Meal list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Today's Meals
        </h2>
        {loading ? (
          <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">Loading…</div>
        ) : meals.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <Flame size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-gray-500">No meals logged yet today</p>
            <button onClick={() => setLogOpen(true)} className="mt-3 text-sm text-primary-600 dark:text-primary-400 font-medium">
              Log your first meal
            </button>
          </div>
        ) : (
          meals.map((meal) => (
            <div
              key={meal.id}
              className="group bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full">
                      {meal.meal_type}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(meal.logged_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{meal.calories} kcal</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>P: {meal.protein}g</span>
                    <span>C: {meal.carbs}g</span>
                    <span>F: {meal.fat}g</span>
                  </div>
                  {meal.food_items && meal.food_items.length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                      {meal.food_items.map((i) => i.name).join(', ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteMeal(meal.id)}
                  className="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <LogModal open={logOpen} onClose={() => setLogOpen(false)} onSaved={loadMeals} />
    </div>
  );
}

function MacroCard({
  icon: Icon,
  label,
  value,
  target,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  target: number;
  color: 'blue' | 'amber' | 'rose';
}) {
  const pct = Math.min(100, (value / target) * 100);
  const colorMap = {
    blue: 'bg-blue-500 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-500 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500 text-rose-600 dark:text-rose-400',
  };
  const [bg, text] = colorMap[color].split(' ');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${bg} bg-opacity-10 flex items-center justify-center`}>
          <Icon size={14} className={text} />
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
        {value}
        <span className="text-xs font-normal text-gray-400 dark:text-gray-500"> / {target}g</span>
      </p>
      <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${bg} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
