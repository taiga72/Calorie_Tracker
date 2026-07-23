import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import {
  toKey, fromKey, formatMonthYear, weekdayShort,
  daysInMonth, firstWeekdayOfMonth, addMonths, isToday,
} from '@/lib/dateUtils';
import { fmtWeight } from '@/lib/units';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayDetailModal } from '@/modals/DayDetailModal';

export function CalendarTab() {
  const { getDay, settings } = useStore();
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
    <div className="px-5 pt-6 pb-4">
      <p className="text-sm text-gray-400 font-medium">Daily history</p>
      <h1 className="text-3xl font-bold text-gray-900 mt-0.5">Calendar</h1>

      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50 mt-5">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCursor(addMonths(cursor, -1))}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-gray-900">{formatMonthYear(cursor)}</span>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
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
            const hasData = day.meals.length > 0 || day.weight;
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className="flex flex-col items-center justify-center py-1.5 rounded-xl hover:bg-gray-50 transition-colors relative"
              >
                <span
                  className={`text-xs font-semibold ${
                    isCur ? 'bg-emerald-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-700'
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

      <p className="text-[11px] text-gray-400 text-center mt-3">
        Tap any day to see its full breakdown. Days with entries show calories and weight.
      </p>

      <DayDetailModal dateKey={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
