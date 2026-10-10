import { useState } from 'react';
import { useStore } from '@/store';
import { estimateItem, RateLimitError } from '@/lib/gemini';
import { haptic } from '@/lib/appearance';
import { Sparkles, Loader2, X } from 'lucide-react';
import type { FoodItem } from '@/types';

/**
 * A ✨ button on one food in a meal: describe or correct just that food
 * ("200 g grilled chicken, not 100 g") and only it is re-estimated.
 */
export function ItemReestimate({ item, others, onApply }: { item: FoodItem; others: string[]; onApply: (next: FoodItem) => void }) {
  const { settings } = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(item.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const next = await estimateItem(settings.geminiApiKey, text, others.filter(Boolean));
      onApply(next);
      haptic('success');
      setOpen(false);
    } catch (e) {
      setError(e instanceof RateLimitError
        ? `Too many requests — try again in about ${e.retryAfterSec}s.`
        : e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setText(item.name); setError(null); setOpen(true); }}
        aria-label={`Re-estimate ${item.name || 'this item'}`}
        title="Re-estimate this item"
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-accent-600 hover:bg-accent-50 dark:hover:bg-accent-950 transition-colors"
      >
        <Sparkles size={15} />
      </button>
    );
  }

  return (
    <div className="basis-full min-w-0 w-full mt-2 bg-accent-50/70 dark:bg-accent-950/50 border border-accent-100 dark:border-accent-900 rounded-xl p-2.5">
      <p className="text-11 font-semibold text-accent-700 dark:text-accent-300 mb-1.5">Re-estimate just this item</p>
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void run(); }}
          aria-label="Describe this item"
          placeholder="e.g. 200 g grilled chicken breast"
          className="flex-1 min-w-0 bg-white dark:bg-gray-900 rounded-lg px-2.5 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 ring-accent-500/30"
        />
        <button
          type="button"
          onClick={run}
          disabled={loading || !text.trim()}
          className="flex-shrink-0 h-9 px-3 rounded-lg bg-accent-600 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <><Sparkles size={13} /> Estimate</>}
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel" className="flex-shrink-0 w-8 h-9 flex items-center justify-center text-gray-400">
          <X size={15} />
        </button>
      </div>
      <p className="text-10 text-gray-400 mt-1.5">Add the amount or a correction — the other items stay as they are.</p>
      {error && <p className="text-11 text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
}
