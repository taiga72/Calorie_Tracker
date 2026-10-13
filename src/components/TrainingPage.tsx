import { useMemo, useState } from 'react';
import { Dumbbell, Trophy, TrendingUp } from 'lucide-react';
import { useStore } from '@/store';
import { TrendChart } from '@/components/TrendChart';
import { WorkoutSheet } from '@/components/ActivityCard';
import { fitDomain } from '@/lib/trends';
import { formatShortDate, fromKey, logicalNow, todayKey } from '@/lib/dateUtils';
import { kgToUnit } from '@/lib/units';
import { liftHistory, liftRecords, weeklyTotals } from '@/lib/workouts';

const WEEKS = 8;

/** Statistics → Training: how much you move, and how your lifts progress. */
export function TrainingPage() {
  const { workouts, settings } = useStore();
  const unit = settings.weightUnit;
  const [adding, setAdding] = useState(false);
  const weeks = useMemo(() => weeklyTotals(workouts, logicalNow(), WEEKS), [workouts]);
  const records = useMemo(() => liftRecords(workouts), [workouts]);
  const [liftKey, setLiftKey] = useState<string | null>(null);
  const selected = records.find((r) => r.key === liftKey) ?? records[0];
  const history = useMemo(() => (selected ? liftHistory(workouts, selected.key) : []), [workouts, selected]);

  const thisWeek = weeks[weeks.length - 1];
  const maxMinutes = Math.max(30, ...weeks.map((w) => w.minutes));
  // Average over finished weeks since the first one with a workout.
  const firstActive = weeks.findIndex((w) => w.workouts > 0);
  const finished = firstActive >= 0 ? weeks.slice(firstActive, -1) : [];
  const avgPerWeek = finished.length ? Math.round(finished.reduce((a, w) => a + w.minutes, 0) / finished.length) : null;
  const u = (kg: number) => +kgToUnit(kg, unit).toFixed(1);

  if (workouts.length === 0) {
    return (
      <div className="card p-6 text-center mt-5">
        <Dumbbell size={22} className="mx-auto text-sky-600" />
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-2">No workouts yet</p>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
          Log a walk, a run or a gym session and your weekly activity, personal records and lift progress show up here.
        </p>
        <button onClick={() => setAdding(true)} className="mt-4 bg-accent-600 text-white text-sm font-semibold px-4 py-2.5 rounded-full">
          Log exercise
        </button>
        <WorkoutSheet open={adding} onClose={() => setAdding(false)} date={todayKey()} />
      </div>
    );
  }

  const bodyweight = !!selected && selected.best1RM === 0;
  const chartPoints = history.map((h) => ({ date: h.date, value: bodyweight ? h.reps : u(h.e1rm) }));

  return (
    <div className="space-y-4 compact:space-y-3 mt-5">
      {/* Weekly activity */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Dumbbell size={16} className="text-sky-600" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Weekly activity</h2>
        </div>
        <p className="text-xs text-gray-400 mb-3">Minutes of exercise per week</p>
        <div className="flex items-end gap-1.5 h-28" role="img" aria-label={`Exercise minutes per week for the last ${WEEKS} weeks`}>
          {weeks.map((w, i) => {
            const h = w.minutes ? Math.max(6, Math.round((w.minutes / maxMinutes) * 100)) : 0;
            const current = i === weeks.length - 1;
            return (
              <div key={w.start} className="flex-1 flex flex-col items-center justify-end h-full" title={`Week of ${formatShortDate(w.start)}: ${w.minutes} min, ${w.workouts} workout${w.workouts === 1 ? '' : 's'}`}>
                {w.minutes > 0 && <span className="text-9 text-gray-500 dark:text-gray-400 mb-0.5 tabular-nums">{w.minutes}</span>}
                <div
                  className={`w-full rounded-t-md ${current ? 'bg-sky-600' : 'bg-sky-300 dark:bg-sky-800'}`}
                  style={{ height: `${h}%`, minHeight: w.minutes ? 4 : 0 }}
                />
                <span className="text-9 text-gray-400 mt-1">{current ? 'Now' : fromKey(w.start).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' })}</span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Tile label="This week" value={`${thisWeek.workouts}`} unit={thisWeek.workouts === 1 ? 'workout' : 'workouts'} />
          <Tile label="Minutes" value={`${thisWeek.minutes}`} unit={avgPerWeek !== null ? `avg ${avgPerWeek}/wk` : 'this week'} />
          <Tile label="Burned" value={thisWeek.calories.toLocaleString()} unit="kcal this week" />
        </div>
        <p className="text-10 text-gray-400 mt-2">Health guidelines suggest about 150 minutes of moderate activity a week.</p>
      </div>

      {/* Personal records */}
      {records.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={16} className="text-amber-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Personal records</h2>
          </div>
          <p className="text-xs text-gray-400 mb-2">Tap a lift to see its progress</p>
          <ul className="divide-y divide-gray-50 dark:divide-gray-800">
            {records.slice(0, 12).map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => setLiftKey(r.key)}
                  aria-pressed={selected?.key === r.key}
                  className={`w-full flex items-center gap-3 py-2 text-left rounded-lg ${selected?.key === r.key ? 'bg-accent-50 dark:bg-accent-950 -mx-2 px-2' : ''}`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">{r.name}</span>
                    <span className="block text-10 text-gray-400">{r.sessions} session{r.sessions === 1 ? '' : 's'} · last {formatShortDate(r.lastDate)}</span>
                  </span>
                  <span className="text-right flex-shrink-0">
                    {r.best.weight > 0 ? (
                      <>
                        <span className="block text-sm font-bold text-gray-900 dark:text-white">{u(r.best.weight)} {unit} × {r.best.reps}</span>
                        <span className="block text-10 text-gray-400">≈ {u(r.best1RM)} {unit} 1-rep max</span>
                      </>
                    ) : (
                      <span className="block text-sm font-bold text-gray-900 dark:text-white">{r.mostReps} reps</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lift progress */}
      {selected && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-accent-600" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">{selected.name}</h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            {bodyweight ? 'Best set (reps) each session' : `Estimated 1-rep max each session, from your best set (${unit})`}
          </p>
          {chartPoints.length >= 2 ? (
            <TrendChart
              start={chartPoints[0].date}
              end={chartPoints[chartPoints.length - 1].date}
              raw={chartPoints}
              line={chartPoints}
              rawIsLine
              domain={fitDomain(chartPoints.map((p) => p.value), { minSpan: bodyweight ? 4 : unit === 'kg' ? 5 : 10 })}
              color="#0EA5E9"
              format={(v) => (bodyweight ? `${Math.round(v)}` : v.toFixed(1))}
              rawLabel={bodyweight ? 'reps' : `${unit} est. 1RM`}
              lineLabel={bodyweight ? 'Reps' : 'Est. 1RM'}
              height={150}
              ariaLabel={`${selected.name} progress`}
            />
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">Log {selected.name.toLowerCase()} in one more session to see a trend.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
      <p className="text-10 text-gray-400 font-medium">{label}</p>
      <p className="text-base font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-9 text-gray-400">{unit}</p>
    </div>
  );
}
