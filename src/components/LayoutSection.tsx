import type { ReactNode } from 'react';
import { useStore } from '@/store';
import { Segmented, Toggle } from '@/components/AppearanceSection';
import { GOALS_LAYOUT, HOME_LAYOUT, STATS_LAYOUT, homeSummaryPrefs, resolveLayout, toLayout, type LayoutDef, type LayoutItem } from '@/lib/layout';
import { useUndoToast } from '@/components/UndoToastProvider';
import { LayoutGrid, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import type { CalendarCellContent, CardLayout } from '@/types';

/** Settings → Layout: which cards Home and Statistics show, in what order, and what calendar days show. */
export function LayoutSection() {
  const { settings, updatePrefs } = useStore();
  const prefs = settings.prefs ?? {};
  const summary = homeSummaryPrefs(prefs);
  const { requestUndo } = useUndoToast();
  const LAYOUT_KEYS = ['homeCards', 'homeSummary', 'showStreak', 'statsCards', 'goalsCards', 'calendarCell'] as const;
  const customized = LAYOUT_KEYS.some((k) => prefs[k] !== undefined);
  const reset = () => {
    const before = Object.fromEntries(LAYOUT_KEYS.map((k) => [k, prefs[k]]));
    updatePrefs(Object.fromEntries(LAYOUT_KEYS.map((k) => [k, undefined])));
    requestUndo('Layout reset', () => updatePrefs(before));
  };

  return (
    <div className="card p-5 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <LayoutGrid size={18} className="text-accent-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Layout</h2>
        {customized && (
          <button onClick={reset} className="ml-auto flex items-center gap-1 text-11 font-semibold text-gray-400 hover:text-accent-600">
            <RotateCcw size={12} /> Reset to default
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-4">Show, hide and reorder cards.</p>

      <CardListEditor
        title="Home"
        def={HOME_LAYOUT}
        saved={prefs.homeCards}
        onChange={(homeCards) => updatePrefs({ homeCards })}
        extra={(item) => item.id === 'summary' && item.visible ? (
          <div className="flex gap-3 pl-1 mt-1.5">
            <MiniCheck label="Weight" on={summary.weight} onChange={(weight) => updatePrefs({ homeSummary: { ...summary, weight } })} />
            <MiniCheck label="Macros" on={summary.macros} onChange={(macros) => updatePrefs({ homeSummary: { ...summary, macros } })} />
          </div>
        ) : null}
      />
      <div className="mt-1">
        <Toggle label="Streak counter in the header" on={prefs.showStreak ?? true} onChange={(showStreak) => updatePrefs({ showStreak })} />
      </div>

      <div className="mt-4">
        <CardListEditor title="Statistics — Trends" def={STATS_LAYOUT} saved={prefs.statsCards} onChange={(statsCards) => updatePrefs({ statsCards })} />
      </div>
      <div className="mt-4">
        <CardListEditor title="Statistics — Goals" def={GOALS_LAYOUT} saved={prefs.goalsCards} onChange={(goalsCards) => updatePrefs({ goalsCards })} />
      </div>

      <Segmented<CalendarCellContent>
        label="Calendar days show"
        value={prefs.calendarCell ?? 'both'}
        onChange={(calendarCell) => updatePrefs({ calendarCell })}
        options={[
          { value: 'both', label: 'Both' },
          { value: 'calories', label: 'Calories' },
          { value: 'weight', label: 'Weight' },
          { value: 'color', label: 'Colour' },
        ]}
      />
    </div>
  );
}

function CardListEditor<T extends string>({ title, def, saved, onChange, extra }: {
  title: string;
  def: LayoutDef<T>;
  saved: CardLayout<T> | undefined;
  onChange: (layout: CardLayout<T>) => void;
  extra?: (item: LayoutItem<T>) => ReactNode;
}) {
  const items = resolveLayout(saved, def);
  const update = (next: LayoutItem<T>[]) => onChange(toLayout(next));
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    update(next);
  };

  return (
    <div>
      <p className="text-11 font-semibold text-gray-500 dark:text-gray-400 mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={item.id} className={`bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 ${item.visible ? '' : 'opacity-60'}`}>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.visible}
                  onChange={() => update(items.map((x) => (x.id === item.id ? { ...x, visible: !x.visible } : x)))}
                  className="w-4 h-4 accent-accent-600 flex-shrink-0"
                />
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{def.labels[item.id]}</span>
              </label>
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${def.labels[item.id]} up`} className="p-1 text-gray-400 disabled:opacity-25">
                <ChevronUp size={16} />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${def.labels[item.id]} down`} className="p-1 text-gray-400 disabled:opacity-25">
                <ChevronDown size={16} />
              </button>
            </div>
            {extra?.(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniCheck({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-11 font-medium text-gray-500 dark:text-gray-400 cursor-pointer">
      <input type="checkbox" checked={on} onChange={() => onChange(!on)} className="w-3.5 h-3.5 accent-accent-600" />
      {label}
    </label>
  );
}
