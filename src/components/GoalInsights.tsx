import { useMemo } from 'react';
import { formatShortDate, logicalNow, todayKey } from '@/lib/dateUtils';
import { baseGoalOn, calorieGoalOn, goalFor, phaseOn, sortedPhases, weeklyTargetOn, WEEKDAY_NAMES } from '@/lib/goalPlan';
import { useStore } from '@/store';
import { useUndoToast } from '@/components/UndoToastProvider';
import { adaptiveTarget, formatForecastDate, ADAPTIVE_WINDOW_DAYS } from '@/lib/forecast';
import { useGoalForecast } from '@/lib/useGoalForecast';
import { kgToUnit } from '@/lib/units';
import { Target, Gauge, Check, PartyPopper, CalendarRange } from 'lucide-react';
import type { WeightUnit } from '@/types';

function fmtRate(kgPerWeek: number, unit: WeightUnit): string {
  const v = kgToUnit(kgPerWeek, unit);
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)} ${unit}/wk`;
}

export function GoalForecastCard() {
  const { settings } = useStore();
  const forecast = useGoalForecast();
  const unit = settings.weightUnit;
  const goal = `${kgToUnit(settings.goalWeight, unit).toFixed(1)} ${unit}`;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Target size={16} className="text-blue-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Goal forecast</h2>
        <span className="ml-auto text-11 text-gray-400">Goal {goal}</span>
      </div>

      {forecast.status === 'on-track' && (
        <>
          <p className="text-xs text-gray-400 mb-3">At your current pace you'll reach your goal around</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatForecastDate(forecast.date)}</p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Mini label="Pace" value={fmtRate(forecast.weeklyChangeKg, unit)} />
            <Mini label="To go" value={`${Math.abs(kgToUnit(forecast.remainingKg, unit)).toFixed(1)} ${unit}`} />
            <Mini label="Time left" value={`~${forecast.weeks} wk${forecast.weeks === 1 ? '' : 's'}`} />
          </div>
        </>
      )}

      {forecast.status === 'off-track' && (
        <>
          <p className="text-sm font-semibold text-orange-500 mt-2">
            {Math.abs(forecast.weeklyChangeKg) < 0.04 ? 'Your weight is holding steady' : 'Your trend is moving away from your goal'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Over the last 4 weeks: {fmtRate(forecast.weeklyChangeKg, unit)}, {Math.abs(kgToUnit(forecast.remainingKg, unit)).toFixed(1)} {unit} to go.
            The calorie target check below can help adjust.
          </p>
        </>
      )}

      {forecast.status === 'reached' && (
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600 mt-2">
          <PartyPopper size={16} /> You're at your goal weight — nice work!
        </p>
      )}

      {forecast.status === 'not-enough-data' && (
        <p className="text-xs text-gray-400 mt-2">
          Log your weight a few times over at least a week to see when you'll reach your goal.
        </p>
      )}
    </div>
  );
}

export function AdaptiveTargetCard() {
  const { meals, weights, settings, updateSettings } = useStore();
  const { requestUndo } = useUndoToast();
  const today = todayKey();
  // With a goal plan, the target in effect today: the current phase's goal
  // (weekday adjustments go on top of it).
  const phase = phaseOn(settings, today);
  const currentGoal = baseGoalOn(settings, today);
  const weeklyTarget = weeklyTargetOn(settings, today);
  const result = useMemo(
    () => adaptiveTarget(meals, weights, weeklyTarget, logicalNow(), goalFor(settings)),
    [meals, weights, weeklyTarget, settings],
  );
  const unit = settings.weightUnit;

  const apply = (suggestedGoal: number, tdee: number) => {
    const previous = { calorieGoal: settings.calorieGoal, calc: settings.calc, prefs: settings.prefs };
    const calc = settings.calc ? { ...settings.calc, tdee, dailyDeficit: suggestedGoal - tdee } : settings.calc;
    if (phase) {
      const phases = (settings.prefs?.phases ?? []).map((p) => (p.id === phase.id ? { ...p, calorieGoal: suggestedGoal } : p));
      updateSettings({ calc, prefs: { ...settings.prefs, phases } });
    } else {
      updateSettings({ calorieGoal: suggestedGoal, calc });
    }
    requestUndo(`${phase ? `${phase.name} goal` : 'Calorie goal'} set to ${suggestedGoal.toLocaleString()} kcal`, () => updateSettings(previous));
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Gauge size={16} className="text-accent-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Calorie target check</h2>
      </div>

      {result.status === 'ready' ? (() => {
        const diff = result.suggestedGoal - currentGoal;
        const goalWord = weeklyTarget < 0 ? 'lose' : weeklyTarget > 0 ? 'gain' : 'maintain';
        const pace = weeklyTarget === 0 ? '' : ` ${Math.abs(kgToUnit(weeklyTarget, unit)).toFixed(2)} ${unit}/week`;
        return (
          <>
            <p className="text-xs text-gray-400 mb-3">
              Based on your last {ADAPTIVE_WINDOW_DAYS} days ({result.loggedDays} logged{result.partialDays > 0 ? `, ${result.partialDays} partly logged left out` : ''}): what you ate vs. how your weight moved.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Mini label="You ate" value={`${result.avgIntake.toLocaleString()} kcal`} />
              <Mini label="Weight" value={fmtRate(result.weeklyChangeKg, unit)} />
              <Mini label="Maintenance" value={`${result.tdee.toLocaleString()} kcal`} strong />
            </div>
            {Math.abs(diff) >= 75 ? (
              <div className="mt-3 bg-accent-50 dark:bg-accent-950 rounded-2xl p-3">
                <p className="text-xs text-accent-800 dark:text-accent-200">
                  To {goalWord}{pace}, aim for <strong>{result.suggestedGoal.toLocaleString()} kcal</strong>/day
                  {' '}({diff > 0 ? '+' : '−'}{Math.abs(diff).toLocaleString()} vs. your current {currentGoal.toLocaleString()}{phase ? ` ${phase.name} goal` : ''}).
                </p>
                <button
                  onClick={() => apply(result.suggestedGoal, result.tdee)}
                  className="mt-2 w-full bg-accent-600 text-white text-xs font-semibold py-2 rounded-xl active:scale-[.99] transition-transform"
                >
                  Use {result.suggestedGoal.toLocaleString()} kcal
                </button>
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <Check size={14} /> Your goal of {currentGoal.toLocaleString()} kcal is right on target.
              </p>
            )}
          </>
        );
      })() : (
        <>
          <p className="text-xs text-gray-400 mt-1">
            Once you have ~3 weeks of logs and weigh-ins, this works out your real maintenance calories and suggests a goal.
          </p>
          <div className="mt-3 space-y-2">
            <Progress label="Days logged" value={result.loggedDays} target={result.neededDays} />
            <Progress label="Weigh-ins spread over 10+ days" value={result.hasWeightTrend ? 1 : 0} target={1} />
          </div>
        </>
      )}
    </div>
  );
}

function Mini({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
      <p className="text-10 text-gray-400 font-medium">{label}</p>
      <p className={`text-xs font-bold mt-0.5 ${strong ? 'text-accent-600' : 'text-gray-900 dark:text-white'}`}>{value}</p>
    </div>
  );
}

function Progress({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(target, 1)) * 100));
  return (
    <div>
      <div className="flex justify-between text-10 mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold text-gray-500">{target === 1 ? (value >= 1 ? 'Done' : 'Not yet') : `${Math.min(value, target)}/${target}`}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full bg-accent-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Statistics → Goals: the goal plan at a glance — the phase you're in, what's
 * next, and any weekday adjustments. Edited in Settings → Goal plan.
 */
export function GoalPlanCard() {
  const { settings } = useStore();
  const today = todayKey();
  const phases = sortedPhases(settings);
  const current = phaseOn(settings, today);
  const next = phases.find((p) => p.start > today);
  const offsets = settings.prefs?.weekdayOffsets;
  const adjusted = offsets && offsets.length === 7
    ? [1, 2, 3, 4, 5, 6, 0].filter((i) => offsets[i]).map((i) => `${WEEKDAY_NAMES[i].slice(0, 3)} ${offsets[i] > 0 ? '+' : '−'}${Math.abs(offsets[i])}`)
    : [];
  const todayGoal = calorieGoalOn(settings, today);

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <CalendarRange size={16} className="text-accent-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Goal plan</h2>
        <span className="ml-auto text-11 text-gray-400">Today {todayGoal.toLocaleString()} kcal</span>
      </div>
      {phases.length === 0 && adjusted.length === 0 ? (
        <p className="text-xs text-gray-400 mt-1">
          One goal every day. In Settings → Goal plan you can plan phases (a cut, then maintenance…) or set different goals by weekday.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {phases.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
              {phases.map((p) => {
                const isNow = current?.id === p.id;
                const past = !isNow && p.start <= today;
                return (
                  <div
                    key={p.id}
                    className={`flex-shrink-0 rounded-xl px-3 py-2 ${isNow ? 'bg-accent-600 text-white' : past ? 'bg-gray-50 dark:bg-gray-800 text-gray-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}
                  >
                    <p className="text-xs font-bold">{p.name}{isNow ? ' · now' : ''}</p>
                    <p className={`text-10 ${isNow ? 'text-white/80' : 'text-gray-400'}`}>{formatShortDate(p.start)} · {p.calorieGoal.toLocaleString()} kcal</p>
                  </div>
                );
              })}
            </div>
          )}
          {next && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Next: <strong className="text-gray-900 dark:text-white">{next.name}</strong> on {formatShortDate(next.start)} ({next.calorieGoal.toLocaleString()} kcal)
            </p>
          )}
          {adjusted.length > 0 && <p className="text-11 text-gray-400">Weekday adjustments: {adjusted.join(' · ')}</p>}
        </div>
      )}
    </div>
  );
}
