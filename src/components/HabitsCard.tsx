import { useMemo } from 'react';
import { Repeat } from 'lucide-react';
import { useStore } from '@/store';
import { habitStreaks, type HabitStreak } from '@/lib/habits';
import { logicalNow } from '@/lib/dateUtils';

const EMOJI: Record<HabitStreak['id'], string> = {
  logging: '📝', withinGoal: '🎯', protein: '🥩', fiber: '🥦', active: '🏃',
};

/** Statistics → Goals: streaks for each habit, with the last two weeks at a glance. */
export function HabitsCard() {
  const { meals, workouts, weights, settings } = useStore();
  const habits = useMemo(
    () => habitStreaks({ meals, workouts, weights, settings, today: logicalNow() }),
    [meals, workouts, weights, settings],
  );

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Repeat size={16} className="text-accent-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Habit streaks</h2>
      </div>
      <p className="text-xs text-gray-400 mb-3">Today (or this week) still counts until it's over.</p>
      <ul className="space-y-3">
        {habits.map((h) => (
          <li key={h.id}>
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="text-lg w-6 text-center">{EMOJI[h.id]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{h.label}</p>
                <p className="text-10 text-gray-400 truncate">{h.rule}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold leading-tight ${h.current > 0 ? 'text-accent-600' : 'text-gray-400'}`}>
                  {h.current} {h.unit}{h.current === 1 ? '' : 's'}
                </p>
                <p className="text-10 text-gray-400">best {h.best}</p>
              </div>
            </div>
            <div
              className="flex gap-1 mt-1.5 pl-8"
              role="img"
              aria-label={`${h.label}: ${h.recent.filter((r) => r === 'done').length} of the last ${h.recent.length} ${h.unit}s`}
            >
              {h.recent.map((r, i) => (
                <span
                  key={i}
                  className={`flex-1 h-1.5 rounded-full ${r === 'done' ? 'bg-accent-500' : r === 'open' ? 'bg-gray-200 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600' : 'bg-gray-100 dark:bg-gray-800'}`}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
