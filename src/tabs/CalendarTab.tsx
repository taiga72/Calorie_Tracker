import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import {
  toKey, fromKey, formatMonthYear, weekdayShort,
  daysInMonth, firstWeekdayOfMonth, addMonths, isToday,
} from '@/lib/dateUtils';
import { fmtWeight } from '@/lib/units';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayDetailModal } from '@/modals/DayDetailModal';
import { PullToRefresh } from '@/components/PullToRefresh';

export function CalendarTab() {
  const { getDay, settings, refresh, refreshing } = useStore();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const total = daysInMonth(year, month);
  const leadBlanks = firstWeekdayOfMonth(year, month);

  const cells: (string | null)[] = useMemo(() => {
    const arr: (string | null)[] = Array(leadBlanks).fill(null);
    for (let d = 1; d <= total; d++) {
      arr.push(toKey(new Date(year, month, d)));
    }
    return arr;
  }, [year, month, total, leadBlanks]);

  return (
    <PullToRefresh onRefresh={refresh} refreshing={refreshing}>
    <div className="pt-6 pb-4">
      {/* Month navigation — large, Apple-Calendar-style title */}
      <div className="px-5 flex items-center justify-between">
        <button
          onClick={() => setCursor(addMonths(cursor, -1))}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
          aria-label="Previous month"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{formatMonthYear(cursor)}</h1>
        <button
          onClick={() => setCursor(addMonths(cursor, 1))}
          className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
          aria-label="Next month"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="px-5 flex items-center justify-center gap-4 mt-2 flex-wrap">
        <Legend color="bg-emerald-50 dark:bg-emerald-950" label="Within goal" />
        <Legend color="bg-rose-50 dark:bg-rose-950" label="Over goal" />
        <Legend color="bg-blue-50 dark:bg-blue-950" label="Weight only" />
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mt-4 border-t border-gray-100 dark:border-gray-800">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="text-center text-[11px] font-bold text-gray-400 py-2 border-b border-gray-100 dark:border-gray-800">
            {weekdayShort(i)}
          </div>
        ))}
      </div>

      {/* Day grid — full-bleed, tall cells, filling most of the screen like Apple Calendar */}
      <div className="grid grid-cols-7 auto-rows-fr min-h-[66vh] border-l border-gray-100 dark:border-gray-800">
        {cells.map((key, i) => {
          if (!key) return <div key={i} className="border-r border-b border-gray-100 dark:border-gray-800" />;
          const day = getDay(key);
          const d = fromKey(key);
          const isCur = isToday(key);
          const hasMeals = day.meals.length > 0;
          const overTarget = hasMeals && day.totalCalories > settings.calorieGoal;
          // A quick-scan heatmap of goal adherence, so trends read at a
          // glance instead of relying on the tiny numbers alone.
          const cellTint = hasMeals
            ? overTarget ? 'bg-rose-50 dark:bg-rose-950' : 'bg-emerald-50 dark:bg-emerald-950'
            : day.weight ? 'bg-blue-50 dark:bg-blue-950' : '';
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`flex flex-col items-start p-1.5 border-r border-b border-gray-100 dark:border-gray-800 text-left transition-colors ${cellTint || 'hover:bg-gray-50 dark:hover:bg-gray-800/60'} ${cellTint ? 'hover:brightness-95' : ''}`}
            >
              <span
                className={`text-sm font-semibold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                  isCur ? 'bg-rose-500 text-white' : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {d.getDate()}
              </span>
              <div className="mt-1 w-full space-y-0.5 overflow-hidden">
                {day.totalCalories > 0 && (
                  <span className="block text-[10px] font-semibold text-orange-600 dark:text-orange-300 truncate">
                    {Math.round(day.totalCalories)} kcal
                  </span>
                )}
                {day.weight && (
                  <span className="block text-[10px] font-semibold text-blue-600 dark:text-blue-300 truncate">
                    {fmtWeight(day.weight.weight, settings.weightUnit, 1).split(' ')[0]} {settings.weightUnit}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <DayDetailModal dateKey={selected} onClose={() => setSelected(null)} />
    </div>
    </PullToRefresh>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${color} border border-black/5`} />
      <span className="text-[10px] text-gray-400 font-medium">{label}</span>
    </div>
  );
}
