import { useMemo } from 'react';
import { useStore } from '@/store';
import { useUndoToast } from '@/components/UndoToastProvider';
import { adaptiveTarget, formatForecastDate, ADAPTIVE_WINDOW_DAYS } from '@/lib/forecast';
import { useGoalForecast } from '@/lib/useGoalForecast';
import { kgToUnit } from '@/lib/units';
import { Target, Gauge, Check, PartyPopper } from 'lucide-react';
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
    <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-sm border border-gray-50 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-1">
        <Target size={16} className="text-blue-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Goal forecast</h2>
        <span className="ml-auto text-[11px] text-gray-400">Goal {goal}</span>
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
  const result = useMemo(
    () => adaptiveTarget(meals, weights, settings.weeklyWeightTarget, new Date(), settings.calorieGoal),
    [meals, weights, settings.weeklyWeightTarget, settings.calorieGoal],
  );
  const unit = settings.weightUnit;

  const apply = (suggestedGoal: number, tdee: number) => {
    const previous = { calorieGoal: settings.calorieGoal, calc: settings.calc };
    updateSettings({
      calorieGoal: suggestedGoal,
      calc: settings.calc ? { ...settings.calc, tdee, dailyDeficit: suggestedGoal - tdee } : settings.calc,
    });
    requestUndo(`Calorie goal set to ${suggestedGoal.toLocaleString()} kcal`, () => updateSettings(previous));
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-sm border border-gray-50 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-1">
        <Gauge size={16} className="text-emerald-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Calorie target check</h2>
      </div>

      {result.status === 'ready' ? (() => {
        const diff = result.suggestedGoal - settings.calorieGoal;
        const goalWord = settings.weeklyWeightTarget < 0 ? 'lose' : settings.weeklyWeightTarget > 0 ? 'gain' : 'maintain';
        const pace = settings.weeklyWeightTarget === 0 ? '' : ` ${Math.abs(kgToUnit(settings.weeklyWeightTarget, unit)).toFixed(2)} ${unit}/week`;
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
              <div className="mt-3 bg-emerald-50 dark:bg-emerald-950 rounded-2xl p-3">
                <p className="text-xs text-emerald-800 dark:text-emerald-200">
                  To {goalWord}{pace}, aim for <strong>{result.suggestedGoal.toLocaleString()} kcal</strong>/day
                  {' '}({diff > 0 ? '+' : '−'}{Math.abs(diff).toLocaleString()} vs. your current {settings.calorieGoal.toLocaleString()}).
                </p>
                <button
                  onClick={() => apply(result.suggestedGoal, result.tdee)}
                  className="mt-2 w-full bg-emerald-600 text-white text-xs font-semibold py-2 rounded-xl active:scale-[.99] transition-transform"
                >
                  Use {result.suggestedGoal.toLocaleString()} kcal
                </button>
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <Check size={14} /> Your goal of {settings.calorieGoal.toLocaleString()} kcal is right on target.
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
      <p className="text-[10px] text-gray-400 font-medium">{label}</p>
      <p className={`text-xs font-bold mt-0.5 ${strong ? 'text-emerald-600' : 'text-gray-900 dark:text-white'}`}>{value}</p>
    </div>
  );
}

function Progress({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(target, 1)) * 100));
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold text-gray-500">{target === 1 ? (value >= 1 ? 'Done' : 'Not yet') : `${Math.min(value, target)}/${target}`}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
