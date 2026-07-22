import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Legend,
} from 'recharts';
import type { MealEntry, WeightLog } from '@/types';
import { toKey } from '@/lib/dateUtils';

type RangeKey = '7d' | '30d' | '3m' | '1y';

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '3m', label: '3 Months', days: 90 },
  { key: '1y', label: '1 Year', days: 365 },
];

export function Statistics() {
  const { profile } = useAuth();
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [range, setRange] = useState<RangeKey>('7d');
  const [loading, setLoading] = useState(true);

  const days = RANGES.find((r) => r.key === range)!.days;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const startISO = startDate.toISOString();

    const [mealsRes, weightsRes] = await Promise.all([
      supabase
        .from('meals')
        .select('*')
        .gte('logged_at', startISO)
        .order('logged_at', { ascending: true }),
      supabase
        .from('weight_logs')
        .select('*')
        .gte('logged_at', startISO)
        .order('logged_at', { ascending: true }),
    ]);

    if (mealsRes.data) setMeals(mealsRes.data as MealEntry[]);
    if (weightsRes.data) setWeights(weightsRes.data as WeightLog[]);
    setLoading(false);
  }, [profile, startDate.toISOString()]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate macros by day
  const macroData = (() => {
    const byDay = new Map<string, { p: number; c: number; f: number; count: number }>();
    for (const m of meals) {
      const key = toKey(m.logged_at);
      const cur = byDay.get(key) || { p: 0, c: 0, f: 0, count: 0 };
      cur.p += m.protein;
      cur.c += m.carbs;
      cur.f += m.fat;
      cur.count += 1;
      byDay.set(key, cur);
    }
    const daysArr: { date: string; protein: number; carbs: number; fat: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toKey(d);
      const data = byDay.get(key);
      daysArr.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        protein: data ? Math.round(data.p / data.count) : 0,
        carbs: data ? Math.round(data.c / data.count) : 0,
        fat: data ? Math.round(data.f / data.count) : 0,
      });
    }
    return daysArr;
  })();

  // Weight trend
  const weightData = weights.map((w) => ({
    date: new Date(w.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: w.weight_kg,
  }));

  const currentWeight = weights.length > 0 ? weights[weights.length - 1].weight_kg : profile?.current_weight_kg;
  const startWeight = weights.length > 0 ? weights[0].weight_kg : null;
  const weightChange = currentWeight && startWeight ? (currentWeight - startWeight) : null;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Statistics</h1>
      </div>

      {/* Range selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              range === r.key
                ? 'bg-primary-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-500">Loading data…</div>
      ) : (
        <div className="space-y-6">
          {/* Macro Breakdown Bar Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Macro Breakdown</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Daily average macros (grams) over the selected period
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={macroData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#f3f4f6',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="protein" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Protein (g)" />
                <Bar dataKey="carbs" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Carbs (g)" />
                <Bar dataKey="fat" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Fat (g)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Weight Trend Area Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Weight Trend</h2>
              {weightChange !== null && (
                <span
                  className={`text-sm font-semibold px-2.5 py-1 rounded-full ${
                    weightChange < 0
                      ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400'
                      : weightChange > 0
                      ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'text-gray-500 bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  {weightChange > 0 ? '+' : ''}
                  {weightChange.toFixed(1)} kg
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Weight change trajectory over the selected period
            </p>
            {weightData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={weightData}>
                  <defs>
                    <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    domain={['dataMin - 1', 'dataMax + 1']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#f3f4f6',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#weightGrad)"
                    name="Weight (kg)"
                    dot={{ r: 3, fill: '#10b981' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-gray-300 dark:text-gray-600">
                <p className="text-sm">No weight logs in this period</p>
                <p className="text-xs mt-1">Log your weight in the Profile tab to see trends</p>
              </div>
            )}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Current Weight" value={currentWeight ? `${currentWeight} kg` : '—'} />
            <SummaryCard label="Total Meals" value={`${meals.length}`} />
            <SummaryCard
              label="Avg Daily Cal"
              value={meals.length > 0 ? `${Math.round(meals.reduce((a, m) => a + m.calories, 0) / Math.max(1, new Set(meals.map((m) => toKey(m.logged_at))).size))}` : '—'}
            />
            <SummaryCard label="Target Cal" value={profile?.target_daily_calories ? `${profile.target_daily_calories}` : '—'} />
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm text-center">
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
