import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { rangeKeys, formatShortDate, toKey } from '@/lib/dateUtils';
import { kgToUnit } from '@/lib/units';
import { TrendChart } from '@/components/TrendChart';
import { dayIndex, fitDomain, smoothingFor, trendLine, SMOOTHING_LABEL } from '@/lib/trends';
import { MacroBar } from '@/components/MacroBar';
import { GoalForecastCard, AdaptiveTargetCard } from '@/components/GoalInsights';
import { WeeklyRecapCard } from '@/components/WeeklyRecapCard';
import { useHorizontalSwipe } from '@/lib/useHorizontalSwipe';
import { PullToRefresh } from '@/components/PullToRefresh';
import { isOverGoal, isPartialDay } from '@/lib/goal';
import { fiberTarget } from '@/lib/macros';
import { Flame, TrendingUp, Scale } from 'lucide-react';

type Page = 'trends' | 'goals';
const PAGES: { key: Page; label: string }[] = [
  { key: 'trends', label: 'Trends' },
  { key: 'goals', label: 'Goals' },
];

type Range = '7d' | '30d' | '3m' | '1y';
const RANGES: { key: Range; label: string; days: number }[] = [
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '3m', label: '3 Months', days: 90 },
  { key: '1y', label: '1 Year', days: 365 },
];

export function StatsTab() {
  const { getDay, weights, settings, refresh, refreshing } = useStore();
  const [range, setRange] = useState<Range>('7d');
  const [page, setPage] = useState<Page>('trends');
  const [slideFrom, setSlideFrom] = useState<'left' | 'right' | null>(null);
  const days = RANGES.find((r) => r.key === range)!.days;

  const todayKey = toKey(new Date());
  const keys = useMemo(() => rangeKeys(new Date(), days), [days]);
  const smoothing = smoothingFor(days);
  const unit = settings.weightUnit;

  // Calories: only finished, logged days count. An unlogged day is a gap
  // (not a 0 kcal day), and today — still in progress — is shown on its own.
  // Partly logged days (under half the goal) are drawn faintly but kept out
  // of the line and the numbers, so a forgotten dinner isn't a "great day".
  const goal = settings.calorieGoal;
  const loggedDayList = useMemo(
    () => keys.filter((k) => k !== todayKey).map((k) => getDay(k)).filter((d) => d.meals.length > 0),
    [keys, todayKey, getDay],
  );
  const fullDayList = useMemo(() => loggedDayList.filter((d) => !isPartialDay(d.totalCalories, goal)), [loggedDayList, goal]);
  const partialRaw = useMemo(
    () => loggedDayList.filter((d) => isPartialDay(d.totalCalories, goal)).map((d) => ({ date: d.date, value: d.totalCalories })),
    [loggedDayList, goal],
  );
  const calRaw = useMemo(() => fullDayList.map((d) => ({ date: d.date, value: d.totalCalories })), [fullDayList]);
  const calLine = useMemo(() => trendLine(calRaw, smoothing), [calRaw, smoothing]);
  const todaySoFar = getDay(todayKey);
  const calPending = todaySoFar.meals.length > 0 ? { date: todayKey, value: todaySoFar.totalCalories } : null;
  // Fitted to the real days only: one 400 kcal partial day would squash the
  // rest into a thin band. Partial days below the axis still read out on hover.
  const calDomain = useMemo(
    () => fitDomain((calRaw.length ? calRaw : partialRaw).map((p) => p.value), { minSpan: 600, include: [goal] }),
    [calRaw, partialRaw, goal],
  );

  const loggedDays = loggedDayList.length;
  const fullDays = fullDayList.length;
  const avgCal = fullDays ? Math.round(calRaw.reduce((a, b) => a + b.value, 0) / fullDays) : 0;
  const highest = calRaw.reduce((a, b) => Math.max(a, b.value), 0);
  const daysWithinGoal = calRaw.filter((p) => !isOverGoal(p.value, goal)).length;

  // Macros averaged over the same fully logged days.
  const totals = useMemo(() => fullDayList.reduce(
    (acc, d) => ({ protein: acc.protein + d.totalProtein, carbs: acc.carbs + d.totalCarbs, fat: acc.fat + d.totalFat, fiber: acc.fiber + (d.totalFiber || 0) }),
    { protein: 0, carbs: 0, fat: 0, fiber: 0 },
  ), [fullDayList]);
  const perDay = (v: number) => v / Math.max(fullDays, 1);

  // Weight: weigh-ins as dots, a smoothed trend through them, and an axis
  // fitted to the data (from 0 kg, every line looked flat).
  const wRaw = useMemo(() => weights
    .filter((w) => w.date >= keys[0] && w.date <= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ({ date: w.date, value: kgToUnit(w.weight, unit) })), [weights, keys, todayKey, unit]);
  const wLine = useMemo(() => {
    const line = trendLine(wRaw, smoothing);
    // A trend needs a couple of weigh-ins; until then, just join the dots.
    return line.length >= 2 ? line : wRaw;
  }, [wRaw, smoothing]);
  const goalInUnit = kgToUnit(settings.goalWeight, unit);
  const wValues = wRaw.map((p) => p.value);
  const goalNearby = wValues.length > 0 && goalInUnit >= Math.min(...wValues) - (unit === 'kg' ? 3 : 6) && goalInUnit <= Math.max(...wValues) + (unit === 'kg' ? 3 : 6);
  const wDomain = useMemo(
    () => fitDomain(wValues, { minSpan: unit === 'kg' ? 2 : 4, include: goalNearby ? [goalInUnit] : [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wRaw, unit, goalNearby, goalInUnit],
  );
  const wFirst = wLine[0];
  const wLast = wLine[wLine.length - 1];
  const wChange = wFirst && wLast ? wLast.value - wFirst.value : 0;
  const wWeeks = wFirst && wLast ? (dayIndex(wLast.date) - dayIndex(wFirst.date)) / 7 : 0;
  const latestWeigh = wRaw[wRaw.length - 1];
  const lineLabel = SMOOTHING_LABEL[smoothing];

  const goToPage = (next: Page) => {
    if (next === page) return;
    setSlideFrom(next === 'goals' ? 'right' : 'left');
    setPage(next);
  };
  const { dragX, handlers: swipeHandlers } = useHorizontalSwipe({
    onSwipeLeft: () => goToPage('goals'),
    onSwipeRight: () => goToPage('trends'),
    // Dragging across a chart reads its values instead.
    ignoreSelector: '[data-chart]',
  });
  // A little resistance at either end, like the calendar.
  const edgeDrag = (page === 'trends' && dragX > 0) || (page === 'goals' && dragX < 0) ? dragX * 0.15 : dragX * 0.4;

  return (
    <PullToRefresh onRefresh={refresh} refreshing={refreshing}>
    <div className="px-5 pt-6 pb-4">
      <p className="text-sm text-gray-400 font-medium">{page === 'trends' ? 'Your trends' : 'Where you\'re headed'}</p>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-0.5">Statistics</h1>

      {/* Page switcher (also swipeable) */}
      <div role="tablist" aria-label="Statistics pages" className="relative grid grid-cols-2 mt-5 p-1 rounded-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
        <span
          aria-hidden
          className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-gray-900 dark:bg-emerald-600 transition-transform duration-300 ease-out"
          style={{ transform: page === 'goals' ? 'translateX(100%)' : undefined }}
        />
        {PAGES.map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={page === p.key}
            onClick={() => goToPage(p.key)}
            className={`relative z-10 py-2 rounded-full text-xs font-semibold transition-colors ${page === p.key ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div
        {...swipeHandlers}
        className="touch-pan-y min-h-[60vh]"
        style={{ transform: dragX ? `translateX(${edgeDrag}px)` : undefined, transition: dragX ? 'none' : 'transform .2s ease' }}
      >
      <div
        key={page}
        className={`motion-reduce:animate-none ${slideFrom === 'right' ? 'animate-[calSlideFromRight_.22s_ease-out]' : slideFrom === 'left' ? 'animate-[calSlideFromLeft_.22s_ease-out]' : ''}`}
      >
      {page === 'goals' ? (
        <div className="space-y-4 mt-5">
          <GoalForecastCard />
          <AdaptiveTargetCard />
        </div>
      ) : (
      <>
      <div className="mt-5">
        <WeeklyRecapCard />
      </div>

      {/* Range selector (for the charts below) */}
      <div className="flex gap-2 mt-5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              range === r.key ? 'bg-gray-900 dark:bg-emerald-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-800'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Calories trend */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-sm border border-gray-50 dark:border-gray-800 mt-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-orange-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Calories trend</h2>
          </div>
          <span className="text-[11px] text-gray-400">{loggedDays} of {keys.length - 1 || 1} days logged</span>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {smoothing === 'none' ? 'Each logged day' : `Dots are days · line is the ${lineLabel.toLowerCase()}`}
        </p>
        {loggedDays === 0 && !calPending ? (
          <p className="text-sm text-gray-400 py-6 text-center">No meals logged in this range.</p>
        ) : (
          <TrendChart
            start={keys[0]}
            end={todayKey}
            raw={calRaw}
            line={calLine}
            rawIsLine={smoothing === 'none'}
            pending={calPending}
            pendingLabel="Today so far"
            partial={partialRaw}
            partialLabel="kcal · partly logged"
            reference={{ value: settings.calorieGoal, label: 'Goal' }}
            domain={calDomain}
            color="#F97316"
            format={(v) => Math.round(v).toLocaleString()}
            rawLabel="kcal that day"
            lineLabel={lineLabel}
            ariaLabel={`Calories, ${lineLabel.toLowerCase()}, ${formatShortDate(keys[0])} to today`}
          />
        )}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Stat label="Avg/day" value={avgCal ? avgCal.toLocaleString() : '—'} unit="kcal" tone="orange" />
          <Stat label="Within goal" value={`${daysWithinGoal}/${fullDays}`} unit="days" tone="gray" />
          <Stat label="Highest" value={highest ? highest.toLocaleString() : '—'} unit="kcal" tone="gray" />
        </div>
        {partialRaw.length > 0 && (
          <p className="text-[10px] text-gray-400 mt-2">
            {partialRaw.length} partly logged day{partialRaw.length === 1 ? '' : 's'} (under half your goal) left out of these numbers.
          </p>
        )}
      </div>

      {/* Macros breakdown */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-sm border border-gray-50 dark:border-gray-800 mt-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={16} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Macros breakdown</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">Daily average percentage split</p>
        <MacroBar
          protein={perDay(totals.protein)}
          carbs={perDay(totals.carbs)}
          fat={perDay(totals.fat)}
        />
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Stat label="Protein" value={`${perDay(totals.protein).toFixed(0)}`} unit="g/day" tone="green" />
          <Stat label="Carbs" value={`${perDay(totals.carbs).toFixed(0)}`} unit="g/day" tone="orange" />
          <Stat label="Fat" value={`${perDay(totals.fat).toFixed(0)}`} unit="g/day" tone="amber" />
        </div>
        {fullDays > 0 && (
          <p className="text-[11px] text-gray-400 mt-3">
            Fiber <span className="font-bold text-purple-500">{perDay(totals.fiber).toFixed(0)} g/day</span>
            {' '}· aim for about {fiberTarget(goal)} g
          </p>
        )}
      </div>

      {/* Weight trend */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-sm border border-gray-50 dark:border-gray-800 mt-4">
        <div className="flex items-center gap-2 mb-1">
          <Scale size={16} className="text-blue-600" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Weight trend</h2>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {smoothing === 'none' ? 'Each weigh-in' : `Dots are weigh-ins · line is the ${lineLabel.toLowerCase()}`}
        </p>
        {wRaw.length > 0 ? (
          <>
            <TrendChart
              start={keys[0]}
              end={todayKey}
              raw={wRaw}
              line={wLine}
              rawIsLine={wLine === wRaw || smoothing === 'none'}
              reference={goalNearby ? { value: goalInUnit, label: 'Goal' } : undefined}
              domain={wDomain}
              color="#3B82F6"
              format={(v) => v.toFixed(1)}
              rawLabel={`${unit} weigh-in`}
              lineLabel={lineLabel}
                height={160}
              ariaLabel={`Weight in ${unit}, ${lineLabel.toLowerCase()}, ${formatShortDate(keys[0])} to today`}
            />
            <div className="flex items-end justify-between mt-4 pt-3 border-t border-gray-50 dark:border-gray-800">
              <div>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{latestWeigh ? latestWeigh.value.toFixed(1) : '—'}</span>
                <span className="text-sm text-gray-400 ml-1">{unit}</span>
                <p className="text-[10px] text-gray-400">latest weigh-in</p>
              </div>
              {wLine.length >= 2 && (
                <div className="text-right">
                  <p className={`text-sm font-semibold ${Math.sign(wChange) === Math.sign(settings.weeklyWeightTarget) || Math.abs(wChange) < 0.05 ? 'text-emerald-600' : 'text-orange-500'}`}>
                    {wChange > 0 ? '+' : wChange < 0 ? '−' : ''}{Math.abs(wChange).toFixed(1)} {unit}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    trend over range{wWeeks >= 1.5 ? ` · ${wChange > 0 ? '+' : wChange < 0 ? '−' : ''}${Math.abs(wChange / wWeeks).toFixed(2)} ${unit}/wk` : ''}
                  </p>
                </div>
              )}
            </div>
            {!goalNearby && (
              <p className="text-[10px] text-gray-400 mt-2">Goal {goalInUnit.toFixed(1)} {unit} is off this chart's scale.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">No weight entries in this range.</p>
        )}
      </div>
      </>
      )}
      </div>
      </div>
    </div>
    </PullToRefresh>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: 'orange' | 'green' | 'amber' | 'gray' }) {
  const toneClass = {
    orange: 'text-orange-500',
    green: 'text-emerald-600',
    amber: 'text-amber-500',
    gray: 'text-gray-900 dark:text-white',
  }[tone];
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
      <p className="text-[10px] text-gray-400 font-medium">{label}</p>
      <p className={`text-base font-bold ${toneClass}`}>{value}</p>
      <p className="text-[9px] text-gray-400">{unit}</p>
    </div>
  );
}
