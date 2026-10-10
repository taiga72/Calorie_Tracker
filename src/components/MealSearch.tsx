import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { Modal } from '@/components/Modal';
import { useUndoToast } from '@/components/UndoToastProvider';
import { searchMeals } from '@/lib/mealSearch';
import { formatShortDate, fromKey, relativeDayLabel, todayKey } from '@/lib/dateUtils';
import { haptic } from '@/lib/appearance';
import { Search, X, RotateCcw, ChevronRight } from 'lucide-react';
import type { MealEntry } from '@/types';

/**
 * Search everything you've logged ("when did I last have ramen?"). Tap a
 * result to open that day, or log it again for today.
 */
export function MealSearchModal({ open, onClose, onOpenDay }: { open: boolean; onClose: () => void; onOpenDay: (dateKey: string) => void }) {
  const { meals, addMeal, deleteMeal } = useStore();
  const { requestUndo } = useUndoToast();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchMeals(meals, query), [meals, query]);

  const logAgain = (m: MealEntry) => {
    const id = addMeal({
      date: todayKey(),
      mealType: m.mealType,
      items: m.items.map((i) => ({ ...i })),
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      fiber: m.fiber,
      reasoning: m.reasoning,
    });
    haptic('success');
    const name = m.items.map((i) => i.name).join(', ') || m.mealType;
    if (id) requestUndo(`Logged ${name.length > 28 ? `${name.slice(0, 27)}…` : name}`, () => deleteMeal(id));
  };

  const dayLabel = (key: string) => {
    const rel = relativeDayLabel(key);
    const d = fromKey(key);
    return /ago|Today|Yesterday/.test(rel) ? `${rel} · ${formatShortDate(key)}` : `${formatShortDate(key)}${d.getFullYear() !== fromKey(todayKey()).getFullYear() ? ` ${d.getFullYear()}` : ''}`;
  };

  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Search size={18} className="text-accent-600" /> Search meals</span>}>
      <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-3 py-2.5">
        <Search size={16} className="text-gray-400 flex-shrink-0" />
        <input
          autoFocus
          type="text"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. ramen, chicken rice, oats"
          aria-label="Search meals"
          className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 dark:text-white outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="Clear search" className="text-gray-400 hover:text-gray-500"><X size={16} /></button>
        )}
      </div>

      {query.trim() && (
        <p className="text-11 text-gray-400 mt-3 mb-2">
          {results.length === 0
            ? 'No meals found.'
            : `${results.length === 100 ? '100+' : results.length} meal${results.length === 1 ? '' : 's'} · last on ${formatShortDate(results[0].date)}`}
        </p>
      )}

      <ul className="space-y-2 pb-2">
        {results.map((m) => (
          <li key={m.id} className="card card-sm flex items-center gap-2 pl-3 pr-2 py-2.5">
            <button onClick={() => onOpenDay(m.date)} className="flex-1 min-w-0 flex items-center gap-2 text-left" aria-label={`Open ${formatShortDate(m.date)}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{m.items.map((i) => i.name).join(', ') || m.mealType}</p>
                <p className="text-11 text-gray-400 truncate">
                  {dayLabel(m.date)} · {m.mealType} · <span className="text-orange-500 font-semibold">{Math.round(m.calories)} kcal</span>
                </p>
              </div>
              <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />
            </button>
            <button
              onClick={() => logAgain(m)}
              aria-label="Log again today"
              className="flex-shrink-0 flex items-center gap-1 text-11 font-semibold text-accent-700 dark:text-accent-300 bg-accent-50 dark:bg-accent-950 rounded-full px-2.5 py-1.5 active:scale-95 transition-transform"
            >
              <RotateCcw size={12} /> Again
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
