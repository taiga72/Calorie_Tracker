import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { rangeKeys, formatShortDate, toKey } from '@/lib/dateUtils';
import { CalorieLineChart } from '@/components/CalorieLineChart';
import { MacroBar } from '@/components/MacroBar';
import { Flame, TrendingUp, Scale } from 'lucide-react';

type Range = '7d' | '30d' | '3m' | '1y';
const RANGES: { key: Range; label: string; days: number }[] = [
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '3m', label: '3 Months', days: 90 },
  { key: '1y', label: '1 Year', days: 365 },
];

export function StatsTab() {
  const { getDay, weights, settings } = useStore();
  const [range, setRange] = useState<Range>('7d');
  const days = RANGES.find((r) => r.key === range)!.days;

  const series = useMemo(() => {
    const keys = rangeKeys(new Date(), Math.min(days, 60));
    return keys.map((k) => {
      const d = getDay(k);
      return { label: formatShortDate(k), value: d.totalCalories, date: k, day: d };
    });
  }, [days, getDay]);

  const avgCal = series.length ? Math.round(series.reduce((a, b) => a + b.value, 0) / series.length) : 0;
  const loggedDays = series.filter((s) => s.value > 0).length;
  const maxDay = series.reduce((a, b) => (b.value > a.value ? b : a), series[0] ?? { value: 0, date: '' });

  // macros aggregated over the range
  const totals = useMemo(() => {
    return series.reduce(
      (acc, s) => ({
        protein: acc.protein + s.day.totalProtein,
        carbs: acc.carbs + s.day.totalCarbs,
        fat: acc.fat + s.day.totalFat,
        calories: acc.calories + s.day.totalCalories,
      }),
      { protein: 0, carbs: 0, fat: 0, calories: 0 }
    );
  }, [series]);

  const weightSeries = useMemo(() => {
    return weights.filter((w) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return w.date >= toKey(cutoff);
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [weights, days]);

  const latestWeight = weightSeries[weightSeries.length - 1];
  const firstWeight = weightSeries[0];
  const weightDelta = latestWeight && firstWeight ? latestWeight.weight - firstWeight.weight : 0;

  return (
    <div className="px-5 pt-6 pb-4">
      <p className="text-sm text-gray-400 font-medium">Your trends</p>
      <h1 className="text-3xl font-bold text-gray-900 mt-0.5">Statistics</h1>

      {/* Range selector */}
      <div className="flex gap-2 mt-5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              range === r.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-100'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Calories trend */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50 mt-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-orange-500" />
            <h2 className="text-sm font-bold text-gray-900">Calories trend</h2>
          </div>
          <span className="text-[11px] text-gray-400">{loggedDays} logged days</span>
        </div>
        <p className="text-xs text-gray-400 mb-3">Daily average over time</p>
        <CalorieLineChart data={series} goal={settings.calorieGoal} />
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Stat label="Avg/day" value={`${avgCal}`} unit="kcal" tone="orange" />
          <Stat label="Best day" value={`${maxDay.value}`} unit="kcal" tone="gray" />
          <Stat label="Logged" value={`${loggedDays}`} unit="days" tone="gray" />
        </div>
      </div>

      {/* Macros breakdown */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50 mt-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={16} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-gray-900">Macros breakdown</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">Daily average percentage split</p>
        <MacroBar
          protein={totals.protein / Math.max(loggedDays, 1)}
          carbs={totals.carbs / Math.max(loggedDays, 1)}
          fat={totals.fat / Math.max(loggedDays, 1)}
        />
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Stat label="Protein" value={`${(totals.protein / Math.max(loggedDays, 1)).toFixed(0)}`} unit="g/day" tone="green" />
          <Stat label="Carbs" value={`${(totals.carbs / Math.max(loggedDays, 1)).toFixed(0)}`} unit="g/day" tone="orange" />
          <Stat label="Fat" value={`${(totals.fat / Math.max(loggedDays, 1)).toFixed(0)}`} unit="g/day" tone="amber" />
        </div>
      </div>

      {/* Weight trend */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-50 mt-4">
        <div className="flex items-center gap-2 mb-1">
          <Scale size={16} className="text-blue-600" />
          <h2 className="text-sm font-bold text-gray-900">Weight trend</h2>
        </div>
        <p className="text-xs text-gray-400 mb-3">Change over the selected range</p>
        {weightSeries.length > 0 ? (
          <div className="flex items-end justify-between">
            <div>
              <span className="text-2xl font-bold text-gray-900">
                {latestWeight ? (settings.weightUnit === 'lb' ? latestWeight.weight * 2.2046 : latestWeight.weight).toFixed(1) : '—'}
              </span>
              <span className="text-sm text-gray-400 ml-1">{settings.weightUnit}</span>
            </div>
            <div className={`text-sm font-semibold ${weightDelta <= 0 ? 'text-emerald-600' : 'text-orange-500'}`}>
              {weightDelta > 0 ? '+' : ''}{(settings.weightUnit === 'lb' ? weightDelta * 2.2046 : weightDelta).toFixed(1)} {settings.weightUnit}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No weight entries in this range.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: 'orange' | 'green' | 'amber' | 'gray' }) {
  const toneClass = {
    orange: 'text-orange-500',
    green: 'text-emerald-600',
    amber: 'text-amber-500',
    gray: 'text-gray-900',
  }[tone];
  return (
    <div className="bg-gray-50 rounded-xl p-2.5">
      <p className="text-[10px] text-gray-400 font-medium">{label}</p>
      <p className={`text-base font-bold ${toneClass}`}>{value}</p>
      <p className="text-[9px] text-gray-400">{unit}</p>
    </div>
  );
}
