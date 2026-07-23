import { useMemo, useState } from 'react'
import { format, parseISO, differenceInDays, subDays, startOfDay } from 'date-fns'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts'
import { TrendingDown, TrendingUp, Minus, Scale, RefreshCw } from 'lucide-react'
import { useProfile } from '../context/ProfileContext'
import { getAllWeightLogs, getMealsForRange } from '../lib/storage'
import type { WeightLog, Meal } from '../types'

export default function StatisticsTab() {
  const { profile } = useProfile()
  const [refreshKey, setRefreshKey] = useState(0)

  const { weightLogs, recentMeals } = useMemo(() => {
    const end = new Date()
    const start = subDays(end, 6)
    const logs = getAllWeightLogs()
    const meals: Meal[] = getMealsForRange(start, end)
    return { weightLogs: logs, recentMeals: meals }
  }, [refreshKey])

  const chartData = useMemo(() => {
    return weightLogs
      .map((w: WeightLog) => ({
        date: format(parseISO(w.logged_at), 'MMM d'),
        weight: parseFloat(w.weight_kg.toFixed(1)),
        raw: w.logged_at,
      }))
      .sort((a, b) => new Date(a.raw).getTime() - new Date(b.raw).getTime())
  }, [weightLogs])

  const weightChange = useMemo(() => {
    if (weightLogs.length < 2) return null
    const sorted = [...weightLogs].sort(
      (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
    )
    const first = parseFloat(sorted[0].weight_kg.toFixed(1))
    const last = parseFloat(sorted[sorted.length - 1].weight_kg.toFixed(1))
    return { first, last, diff: parseFloat((last - first).toFixed(1)) }
  }, [weightLogs])

  const avgDailyCalories = useMemo(() => {
    const byDay = new Map<string, number>()
    recentMeals.forEach((m) => {
      const key = format(parseISO(m.logged_at), 'yyyy-MM-dd')
      byDay.set(key, (byDay.get(key) || 0) + m.calories)
    })
    const vals = Array.from(byDay.values())
    if (vals.length === 0) return 0
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }, [recentMeals])

  const currentWeight = weightLogs.length > 0
    ? parseFloat(weightLogs[weightLogs.length - 1].weight_kg.toFixed(1))
    : null

  const streak = useMemo(() => {
    const today = startOfDay(new Date())
    let count = 0
    for (let i = 0; i < 365; i++) {
      const day = subDays(today, i)
      const key = format(day, 'yyyy-MM-dd')
      const has = weightLogs.some((w) => format(parseISO(w.logged_at), 'yyyy-MM-dd') === key)
      if (has) count++
      else if (i > 0) break
      else continue
    }
    return count
  }, [weightLogs])

  const ChangeIcon = weightChange
    ? weightChange.diff < 0 ? TrendingDown : weightChange.diff > 0 ? TrendingUp : Minus
    : Minus
  const changeColor = weightChange
    ? weightChange.diff < 0 ? 'text-primary-600' : weightChange.diff > 0 ? 'text-accent-600' : 'text-neutral-500'
    : 'text-neutral-500'

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-4">
      <h2 className="mb-4 text-base font-bold text-neutral-900">Statistics</h2>

      {/* Summary stat cards */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card">
          <div className="mb-1 flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary-600" />
            <span className="text-xs font-medium text-neutral-500">Current Weight</span>
          </div>
          <p className="text-2xl font-bold text-neutral-900">
            {currentWeight != null ? currentWeight : '—'}<span className="text-sm font-medium text-neutral-400">{currentWeight != null ? ' kg' : ''}</span>
          </p>
        </div>
        <div className="card">
          <div className="mb-1 flex items-center gap-2">
            <ChangeIcon className={`h-4 w-4 ${changeColor}`} />
            <span className="text-xs font-medium text-neutral-500">Total Change</span>
          </div>
          <p className={`text-2xl font-bold ${changeColor}`}>
            {weightChange ? `${weightChange.diff > 0 ? '+' : ''}${weightChange.diff} kg` : '—'}
          </p>
        </div>
        <div className="card">
          <span className="text-xs font-medium text-neutral-500">Avg Daily Calories</span>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{avgDailyCalories}</p>
          <p className="text-[11px] text-neutral-400">last 7 days</p>
        </div>
        <div className="card">
          <span className="text-xs font-medium text-neutral-500">Logging Streak</span>
          <p className="mt-1 text-2xl font-bold text-neutral-900">{streak}</p>
          <p className="text-[11px] text-neutral-400">consecutive days</p>
        </div>
      </div>

      {/* Weight Trend Graph */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Weight Trend</h3>
            <p className="text-xs text-neutral-400">{weightLogs.length} data point{weightLogs.length !== 1 ? 's' : ''}</p>
          </div>
          {profile?.target_daily_calories && (
            <span className="rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
              Goal: {profile.target_goal === 'lose' ? 'Lose' : profile.target_goal === 'gain' ? 'Gain' : 'Maintain'}
            </span>
          )}
        </div>

        {chartData.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <Scale className="mb-2 h-8 w-8 text-neutral-300" />
            <p className="text-sm text-neutral-400">No weight data yet</p>
            <p className="text-xs text-neutral-300">Log your weight to see the trend</p>
          </div>
        ) : chartData.length === 1 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <Scale className="mb-2 h-8 w-8 text-neutral-300" />
            <p className="text-sm text-neutral-400">One entry: {chartData[0].weight} kg</p>
            <p className="text-xs text-neutral-300">Log more days to see a trend</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#919b9d' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 11, fill: '#919b9d' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #eef0f0',
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
                formatter={(v: number) => [`${v} kg`, 'Weight']}
                labelStyle={{ fontWeight: 600 }}
              />
              <ReferenceLine y={chartData[0].weight} stroke="#bbc1c2" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#2a9974"
                strokeWidth={2.5}
                dot={{ fill: '#2a9974', r: 4 }}
                activeDot={{ r: 6, fill: '#1d7c5e' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Days tracked info */}
      {weightLogs.length > 0 && (
        <div className="card mt-4 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Tracking span</span>
            <span className="text-sm font-semibold text-neutral-900">
              {differenceInDays(
                parseISO(weightLogs[weightLogs.length - 1].logged_at),
                parseISO(weightLogs[0].logged_at)
              )} days
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500">Starting weight</span>
            <span className="text-sm font-semibold text-neutral-900">
              {weightChange?.first} kg
            </span>
          </div>
        </div>
      )}

      <button
        onClick={() => setRefreshKey((k) => k + 1)}
        className="btn-ghost mx-auto mt-4 flex"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Refresh
      </button>
    </div>
  )
}
