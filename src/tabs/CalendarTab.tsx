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
    <div className="px-5 pt-6 pb-4">
      <p className="text-sm text-gray-400 font-medium">Daily history</p>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-0.5">Calendar</h1>

      <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-sm border border-gray-50 dark:border-gray-800 mt-5">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCursor(addMonths(cursor, -1))}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{formatMonthYear(cursor)}</span>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 mb-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-gray-400 py-1">
              {weekdayShort(i)}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((key, i) => {
            if (!key) return <div key={i} />;
            const day = getDay(key);
            const d = fromKey(key);
            const isCur = isToday(key);
            const hasMeals = day.meals.length > 0;
            const hasData = hasMeals || day.weight;
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
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors relative ${cellTint || 'hover:bg-gray-50 dark:hover:bg-gray-800'} ${cellTint ? 'hover:brightness-95' : ''}`}
              >
                <span
                  className={`text-xs font-semibold ${
                    isCur ? 'bg-emerald-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {d.getDate()}
                </span>
                {hasData && (
                  <div className="mt-0.5 leading-tight text-center">
                    {day.totalCalories > 0 && (
                      <span className="block text-[8px] font-semibold text-orange-500">{Math.round(day.totalCalories)}</span>
                    )}
                    {day.weight && (
                      <span className="block text-[8px] font-semibold text-blue-500">
                        {fmtWeight(day.weight.weight, settings.weightUnit, 1).split(' ')[0]}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
        <Legend color="bg-emerald-50 dark:bg-emerald-950" label="Within goal" />
        <Legend color="bg-rose-50 dark:bg-rose-950" label="Over goal" />
        <Legend color="bg-blue-50 dark:bg-blue-950" label="Weight only" />
      </div>
      <p className="text-[11px] text-gray-400 text-center mt-2">
        Tap any day to see its full breakdown.
      </p>

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
