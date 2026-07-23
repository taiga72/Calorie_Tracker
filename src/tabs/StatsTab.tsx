import { useStore } from '@/store';
import { lastNKeys, formatHeaderDate } from '@/lib/dateUtils';
import { fmtWeight } from '@/lib/units';
import { Flame, TrendingDown, TrendingUp, Beef, Droplet, Wheat } from 'lucide-react';

export function StatsTab() {
  const { getDay, settings, weights } = useStore();
  const days = lastNKeys(7);
  const summaries = days.map((k) => getDay(k));
  const calories = summaries.map((s) => Math.round(s.totalCalories));
  const maxCal = Math.max(settings.calorieGoal, ...calories, 500);

  // Y-axis ticks — round up to nearest 500
  const yMax = Math.ceil(maxCal / 500) * 500;
  const tickStep = 500;
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += tickStep) ticks.push(v);
  if (ticks[ticks.length - 1] < yMax) ticks.push(yMax);

  const chartH = 180;
  const chartW = 300;
  const padL = 40;
  const padR = 8;
  const padT = 10;
  const padB = 24;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const xFor = (i: number) => padL + (plotW * i) / Math.max(days.length - 1, 1);
  const yFor = (v: number) => padT + plotH - (v / yMax) * plotH;

  const points = calories.map((c, i) => `${xFor(i)},${yFor(c)}`).join(' ');
  const areaPath = `M ${xFor(0)},${yFor(0)} L ${points.split(' ').join(' L ')} L ${xFor(days.length - 1)},${yFor(0)} Z`;

  const avgCal = calories.length ? Math.round(calories.reduce((a, b) => a + b, 0) / calories.length) : 0;

  // Weight trend
  const recentWeights = weights.slice(-7);
  const weightDelta = recentWeights.length >= 2
    ? recentWeights[recentWeights.length - 1].weight - recentWeights[0].weight
    : 0;

  const avgProtein = Math.round(summaries.reduce((s, d) => s + d.totalProtein, 0) / days.length);
  const avgCarbs = Math.round(summaries.reduce((s, d) => s + d.totalCarbs, 0) / days.length);
  const avgFat = Math.round(summaries.reduce((s, d) => s + d.totalFat, 0) / days.length);

  return (
    <div className="px-5 pt-6 pb-4">
      <p className="text-sm text-gray-400 font-medium">Last 7 days</p>
      <h1 className="text-3xl font-bold text-gray-900 mt-0.5">Statistics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5 mt-5">
        <StatCard Icon={Flame} color="text-orange-500" label="Avg cal" value={`${avgCal}`} unit="kcal" />
        <StatCard Icon={Beef} color="text-emerald-600" label="Avg protein" value={`${avgProtein}`} unit="g" />
        <StatCard
          Icon={weightDelta <= 0 ? TrendingDown : TrendingUp}
          color={weightDelta <= 0 ? 'text-blue-500' : 'text-amber-500'}
          label="Weight Δ"
          value={fmtWeight(Math.abs(weightDelta), settings.weightUnit)}
          unit={weightDelta <= 0 ? 'lost' : 'gained'}
        />
      </div>

      {/* Calories trend chart with Y-axis labels */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 mt-4">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Calories Trend</h2>
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ minWidth: 280 }}>
            {/* Y-axis grid lines + labels */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} y1={yFor(t)} x2={chartW - padR} y2={yFor(t)} stroke="#f3f4f6" strokeWidth={1} />
                <text x={padL - 6} y={yFor(t) + 3} textAnchor="end" className="fill-gray-400" style={{ fontSize: 9 }}>
                  {t}
                </text>
              </g>
            ))}
            {/* Goal line */}
            {settings.calorieGoal > 0 && settings.calorieGoal <= yMax && (
              <>
                <line
                  x1={padL} y1={yFor(settings.calorieGoal)}
                  x2={chartW - padR} y2={yFor(settings.calorieGoal)}
                  stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6}
                />
                <text x={chartW - padR} y={yFor(settings.calorieGoal) - 4} textAnchor="end"
                  className="fill-emerald-500" style={{ fontSize: 8, fontWeight: 600 }}>
                  Goal {settings.calorieGoal}
                </text>
              </>
            )}
            {/* Area + line */}
            <path d={areaPath} fill="url(#calGrad)" opacity={0.2} />
            <polyline points={points} fill="none" stroke="#f97316" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Data points + x labels */}
            {calories.map((c, i) => (
              <g key={i}>
                <circle cx={xFor(i)} cy={yFor(c)} r={3.5} fill="#f97316" stroke="white" strokeWidth={1.5} />
                <text x={xFor(i)} y={chartH - 8} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 8 }}>
                  {formatHeaderDate(days[i]).slice(0, 3)}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-gray-400">
          <span className="font-semibold">kcal</span>
        </div>
      </div>

      {/* Macro breakdown */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-50 mt-4">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Avg Daily Macros</h2>
        <div className="grid grid-cols-3 gap-3">
          <MacroBar Icon={Beef} label="Protein" value={avgProtein} color="bg-emerald-500" />
          <MacroBar Icon={Wheat} label="Carbs" value={avgCarbs} color="bg-orange-500" />
          <MacroBar Icon={Droplet} label="Fat" value={avgFat} color="bg-amber-500" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ Icon, color, label, value, unit }: { Icon: typeof Flame; color: string; label: string; value: string; unit: string }) {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-50">
      <Icon size={16} className={color} />
      <p className="text-lg font-bold text-gray-900 mt-1.5 tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-400">{label} · {unit}</p>
    </div>
  );
}

function MacroBar({ Icon, label, value, color }: { Icon: typeof Beef; label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <Icon size={18} className="text-gray-400 mx-auto" />
      <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">{value}g</p>
      <p className="text-[10px] text-gray-400">{label}</p>
      <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value / 150 * 100, 100)}%` }} />
      </div>
    </div>
  );
}
