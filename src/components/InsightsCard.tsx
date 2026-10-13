import { useMemo, useState } from 'react';
import { ChevronDown, MessageCircle, PauseCircle, CalendarRange, X } from 'lucide-react';
import { useStore } from '@/store';
import { useUndoToast } from '@/components/UndoToastProvider';
import { plateau, weekendOffsets, weekendPattern } from '@/lib/insights';
import { logicalNow, toKey, addDays } from '@/lib/dateUtils';
import { kgToUnit } from '@/lib/units';
import { openCoach } from '@/lib/coachLauncher';

const HIDE_KEY = 'cc_insight_hidden';
const HIDE_DAYS = 7;

function hiddenUntil(id: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(HIDE_KEY) || '{}') as Record<string, string>)[id] ?? null;
  } catch {
    return null;
  }
}
function hideFor(id: string, days: number): void {
  try {
    const all = JSON.parse(localStorage.getItem(HIDE_KEY) || '{}') as Record<string, string>;
    all[id] = toKey(addDays(logicalNow(), days));
    localStorage.setItem(HIDE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

/**
 * A weight plateau (with its likely causes) and a weekend eating pattern,
 * when the logs show one. Renders nothing otherwise.
 */
export function InsightsCard({ compact = false }: { compact?: boolean }) {
  const { meals, weights, workouts, settings, updatePrefs } = useStore();
  const { requestUndo } = useUndoToast();
  const today = logicalNow();
  const todayKey = toKey(today);
  const stall = useMemo(() => plateau({ meals, weights, workouts, settings, today: logicalNow() }), [meals, weights, workouts, settings]);
  const weekends = useMemo(() => weekendPattern({ meals, settings, today: logicalNow() }), [meals, settings]);
  const [hidden, setHidden] = useState(() => ({
    plateau: (hiddenUntil('plateau') ?? '') > todayKey,
    weekend: (hiddenUntil('weekend') ?? '') > todayKey,
  }));
  const [showCauses, setShowCauses] = useState(false);
  // On Home, just the headlines until tapped.
  const [open, setOpen] = useState({ plateau: !compact, weekend: !compact });
  const unit = settings.weightUnit;

  const showPlateau = stall && !hidden.plateau;
  const showWeekend = weekends && !weekends.alreadyShifted && !hidden.weekend;
  if (!showPlateau && !showWeekend) return null;

  // The weekend card already covers that one.
  const causes = stall ? stall.causes.filter((c) => !(showWeekend && c.id === 'weekends')) : [];

  const dismiss = (id: 'plateau' | 'weekend') => {
    hideFor(id, HIDE_DAYS);
    setHidden((h) => ({ ...h, [id]: true }));
  };

  const applyShift = () => {
    if (!weekends) return;
    const previous = settings.prefs?.weekdayOffsets ?? null;
    updatePrefs({ weekdayOffsets: weekendOffsets(weekends.shift) });
    requestUndo(`Weekends +${weekends.shift.plus}, Mon–Thu −${weekends.shift.minus} kcal`, () => updatePrefs({ weekdayOffsets: previous }));
  };

  return (
    <div className="space-y-3">
      {showPlateau && stall && (
        <div className="card p-4 border-amber-100 dark:border-amber-900">
          <div className="flex items-start gap-2">
            <PauseCircle size={17} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <button type="button" onClick={() => setOpen((o) => ({ ...o, plateau: !o.plateau }))} aria-expanded={open.plateau} className="text-left w-full">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Your weight has stalled for {stall.weeks} weeks</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {Math.abs(kgToUnit(stall.weeklyChangeKg, unit)) < 0.05
                    ? 'Your trend is flat'
                    : `Your trend is ${stall.weeklyChangeKg > 0 ? 'up' : 'down'} ${Math.abs(kgToUnit(stall.weeklyChangeKg, unit)).toFixed(2)} ${unit} a week`}
                  {' '}while you're aiming to {stall.direction}. {open.plateau ? "It happens to everyone — here's what your logs suggest." : 'Tap to see why.'}
                </p>
              </button>
            </div>
            <button onClick={() => dismiss('plateau')} aria-label="Hide for a week" className="p-2 -m-2 text-gray-400 rounded-full"><X size={15} /></button>
          </div>
          {open.plateau && (<>
          <ul className="mt-3 space-y-2">
            {(showCauses ? causes : causes.slice(0, 2)).map((c) => (
              <li key={c.id} className="bg-amber-50/60 dark:bg-amber-950/40 rounded-xl px-3 py-2">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{c.title}</p>
                <p className="text-11 text-gray-600 dark:text-gray-300 leading-relaxed mt-0.5">{c.text}</p>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 mt-3">
            {causes.length > 2 && (
              <button onClick={() => setShowCauses((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 py-1.5">
                <ChevronDown size={14} className={showCauses ? 'rotate-180' : ''} /> {showCauses ? 'Less' : `${causes.length - 2} more`}
              </button>
            )}
            <button
              onClick={() => openCoach("My weight has stalled for a few weeks. Based on my logs, what's most likely going on and what one change should I make?")}
              className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-white bg-accent-600 px-3 py-2 rounded-full"
            >
              <MessageCircle size={14} /> Ask the coach
            </button>
          </div>
          </>)}
        </div>
      )}

      {showWeekend && weekends && (
        <div className="card p-4">
          <div className="flex items-start gap-2">
            <CalendarRange size={17} className="text-violet-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <button type="button" onClick={() => setOpen((o) => ({ ...o, weekend: !o.weekend }))} aria-expanded={open.weekend} className="text-left w-full">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">You eat about {weekends.diff.toLocaleString()} kcal more on weekends</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Fri–Sun average {weekends.weekendAvg.toLocaleString()} kcal vs. {weekends.weekdayAvg.toLocaleString()} on other days (last 4 weeks).
                  {open.weekend ? ' Plan for it: move some budget to the weekend and your week still adds up.' : ' Tap for a plan.'}
                </p>
              </button>
            </div>
            <button onClick={() => dismiss('weekend')} aria-label="Hide for a week" className="p-2 -m-2 text-gray-400 rounded-full"><X size={15} /></button>
          </div>
          {open.weekend && (<>
          <div className="grid grid-cols-7 gap-1 mt-3" aria-hidden>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => {
              const v = weekendOffsets(weekends.shift)[i];
              return (
                <div key={i} className={`rounded-lg py-1.5 text-center ${v > 0 ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300' : 'bg-gray-50 dark:bg-gray-800 text-gray-500'}`}>
                  <p className="text-10 font-semibold">{d}</p>
                  <p className="text-10 font-bold tabular-nums">{v > 0 ? '+' : '−'}{Math.abs(v)}</p>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={applyShift} className="flex-1 bg-gray-900 dark:bg-accent-600 text-white text-xs font-semibold py-2.5 rounded-full">
              Shift budget to weekends
            </button>
            <button
              onClick={() => openCoach('I eat a lot more on weekends. Give me three simple ways to keep weekends enjoyable without undoing my week.')}
              className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold py-2.5 rounded-full"
            >
              Tips from the coach
            </button>
          </div>
          </>)}
        </div>
      )}
    </div>
  );
}
