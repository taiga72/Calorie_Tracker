import { useState } from 'react';
import { useStore } from '@/store';
import { toKey, fromKey, addDays, formatHeaderDate } from '@/lib/dateUtils';
import { DayDetailModal } from '@/modals/DayDetailModal';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarTab() {
  const { getDay, meals } = useStore();
  const [cursor, setCursor] = useState(toKey(new Date()));
  const [selected, setSelected] = useState<string | null>(null);

  const d = fromKey(cursor);
  const year = d.getFullYear();
  const month = d.getMonth();

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const todayKey = toKey(new Date());

  const calorieMap = new Map<string, number>();
  meals.forEach((m) => calorieMap.set(m.date, (calorieMap.get(m.date) ?? 0) + m.calories));

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(toKey(new Date(year, month, day)));

  return (
    <div className="px-5 pt-6 pb-4">
      <p className="text-sm text-gray-400 font-medium">Track your progress</p>
      <h1 className="text-3xl font-bold text-gray-900 mt-0.5">Calendar</h1>

      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50 mt-5">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor(toKey(new Date(year, month - 1, 1)))}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-sm font-bold text-gray-900">
            {d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button onClick={() => setCursor(toKey(new Date(year, month + 1, 1)))}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-gray-300 py-1">{w}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((key, i) => {
            if (!key) return <div key={i} />;
            const cals = calorieMap.get(key) ?? 0;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-colors relative
                  ${isToday ? 'bg-emerald-600 text-white' : cals > 0 ? 'bg-emerald-50 text-gray-900' : 'bg-gray-50 text-gray-400'}`}
              >
                <span className="text-xs font-bold">{fromKey(key).getDate()}</span>
                {cals > 0 && (
                  <span className={`text-[8px] flex items-center gap-0.5 ${isToday ? 'text-emerald-100' : 'text-emerald-500'}`}>
                    <Flame size={7} />{Math.round(cals)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <DayDetailModal dateKey={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
