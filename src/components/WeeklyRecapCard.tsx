import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store';
import { computeWeeklyRecap, cachedRecapSummary, cacheRecapSummary, dismissRecap } from '@/lib/weeklyRecap';
import { cleanCoachText, getWeeklySummary } from '@/lib/geminiCoach';
import { formatShortDate } from '@/lib/dateUtils';
import { kgToUnit } from '@/lib/units';
import { weeklyTargetOn } from '@/lib/goalPlan';
import { CalendarCheck, Sparkles, X } from 'lucide-react';

interface WeeklyRecapCardProps {
  /** Home shows a dismiss button; Stats keeps it as a permanent card. */
  onDismiss?: () => void;
}

/**
 * The week at a glance. From Friday it covers this week so far and adds a
 * short AI coach note — the end-of-week brief, written once and cached.
 * Monday to Thursday it shows last week, with that Friday's brief if any.
 */
export function WeeklyRecapCard({ onDismiss }: WeeklyRecapCardProps) {
  const { meals, weights, settings } = useStore();
  const recap = useMemo(() => computeWeeklyRecap(meals, weights, settings), [meals, weights, settings]);
  const weekStart = recap?.weekStart;
  const [summary, setSummary] = useState<string | null>(() => (weekStart ? cachedRecapSummary(weekStart) : null));
  const [summaryState, setSummaryState] = useState<'idle' | 'loading' | 'failed'>('idle');

  const mode = recap?.mode;

  useEffect(() => {
    if (!recap || !weekStart) return;
    const cached = cachedRecapSummary(weekStart);
    setSummary(cached);
    // The brief is written from Friday; earlier in the week only last
    // Friday's (if any) is shown.
    if (cached || recap.mode !== 'this-week') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    let active = true;
    setSummaryState('loading');
    getWeeklySummary(settings.geminiApiKey, recap, settings)
      .then((text) => {
        cacheRecapSummary(weekStart, text);
        if (active) { setSummary(text); setSummaryState('idle'); }
      })
      .catch(() => { if (active) setSummaryState('failed'); });
    return () => { active = false; };
    // One request per week: only re-run when the week (or mode) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, mode]);

  if (!recap) return null;
  const unit = settings.weightUnit;
  const weight = recap.weightChangeKg === null ? null : kgToUnit(recap.weightChangeKg, unit);

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarCheck size={16} className="text-accent-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">{recap.mode === 'this-week' ? 'End-of-week brief' : 'Last week'}</h2>
        <span className="text-11 text-gray-400">
          {formatShortDate(recap.weekStart)} – {recap.mode === 'this-week' ? 'today' : formatShortDate(recap.weekEnd)}
        </span>
        {onDismiss && (
          <button
            onClick={() => { dismissRecap(recap.weekStart); onDismiss(); }}
            aria-label="Dismiss weekly recap"
            className="ml-auto text-gray-300 hover:text-gray-500 p-1 -m-1"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile
          label="Avg calories"
          value={`${recap.avgCalories.toLocaleString()} kcal`}
          sub={recap.avgCaloriesDelta === null ? `goal ${recap.calorieGoal.toLocaleString()}` : `${recap.avgCaloriesDelta > 0 ? '▲' : recap.avgCaloriesDelta < 0 ? '▼' : '='} ${Math.abs(recap.avgCaloriesDelta).toLocaleString()} vs ${recap.mode === 'this-week' ? 'last week' : 'week before'}`}
        />
        <Tile
          label="Within goal"
          value={recap.countedDays > 0 ? `${recap.daysOnTarget} of ${recap.countedDays} days` : '—'}
          sub={`${recap.loggedDays}/${recap.periodDays} days logged${recap.partialDays > 0 ? ` · ${recap.partialDays} partly` : ''}`}
          tone={recap.countedDays > 0 && recap.daysOnTarget >= Math.ceil(recap.countedDays * 0.7) ? 'good' : undefined}
        />
        <Tile
          label="Weight"
          value={weight === null ? '—' : `${weight > 0 ? '+' : weight < 0 ? '−' : ''}${Math.abs(weight).toFixed(1)} ${unit}`}
          sub={weight === null ? 'Weigh in 2+ times a week' : 'first to last weigh-in'}
          tone={weight !== null && Math.sign(weight) === Math.sign(weeklyTargetOn(settings, recap.weekEnd)) ? 'good' : undefined}
        />
        <Tile
          label="Protein"
          value={`${recap.avgProtein} g/day`}
          sub={recap.proteinTarget ? `target hit ${recap.daysProteinHit}/${recap.countedDays || recap.loggedDays} days` : 'daily average'}
        />
      </div>

      {recap.topFoods.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="text-10 font-semibold text-gray-400 mr-0.5">Most eaten</span>
          {recap.topFoods.map((f) => (
            <span key={f.name} className="text-11 font-semibold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-full px-2.5 py-1">
              {f.name} <span className="text-gray-400">×{f.count}</span>
            </span>
          ))}
        </div>
      )}

      {(summary || summaryState === 'loading') && (
        <div className="mt-3 bg-accent-50/70 dark:bg-accent-950/50 border border-accent-100 dark:border-accent-900 rounded-2xl p-3">
          <p className="flex items-center gap-1.5 text-10 font-bold text-accent-700 dark:text-accent-400 tracking-wider mb-1">
            <Sparkles size={11} /> FRIDAY BRIEF
          </p>
          {summary ? (
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{cleanCoachText(summary)}</p>
          ) : (
            <div className="space-y-1.5 py-0.5" aria-label="Writing your coach note">
              <div className="h-2.5 rounded bg-accent-100 dark:bg-accent-900 animate-pulse" />
              <div className="h-2.5 w-4/5 rounded bg-accent-100 dark:bg-accent-900 animate-pulse" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
      <p className="text-10 text-gray-400 font-medium">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${tone === 'good' ? 'text-emerald-600' : 'text-gray-900 dark:text-white'}`}>{value}</p>
      <p className="text-10 text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
