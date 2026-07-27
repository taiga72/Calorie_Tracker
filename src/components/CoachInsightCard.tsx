import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { getInsight, type CoachInsight } from '@/lib/geminiCoach';
import { RateLimitError } from '@/lib/gemini';
import { Sparkles, Lightbulb, AlertCircle, RefreshCw, MessageCircle } from 'lucide-react';

interface Props {
  onOpenCoach: () => void;
}

export function CoachInsightCard({ onOpenCoach }: Props) {
  const { meals, weights, settings } = useStore();
  const [insight, setInsight] = useState<CoachInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getInsight(settings.geminiApiKey, { settings, meals, weights });
      setInsight(result);
    } catch (err) {
      const msg = err instanceof RateLimitError
        ? 'Too many requests right now. Try again in a moment.'
        : err instanceof Error ? err.message : 'Could not generate insight.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-3xl p-4 shadow-sm text-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles size={15} />
          </div>
          <span className="text-xs font-bold tracking-wider">SMART COACH INSIGHT</span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-50 active:scale-90 transition-transform"
          aria-label="Refresh insight"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && (
        <div className="space-y-2 py-1">
          <div className="h-3 w-full bg-white/20 rounded-full animate-pulse" />
          <div className="h-3 w-4/5 bg-white/20 rounded-full animate-pulse" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 text-xs text-white/90">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && insight && (
        <>
          <p className="text-sm leading-relaxed text-white/95">{insight.summary}</p>
          <div className="mt-3 bg-white/15 rounded-2xl p-3 flex items-start gap-2">
            <Lightbulb size={15} className="mt-0.5 flex-shrink-0 text-amber-200" />
            <div>
              <p className="text-[10px] font-bold tracking-wider text-amber-200 mb-0.5">TIP</p>
              <p className="text-xs leading-relaxed text-white/90">{insight.tip}</p>
            </div>
          </div>
        </>
      )}

      {!loading && !error && !insight && (
        <p className="text-sm text-white/80">Tap refresh to generate your weekly insight.</p>
      )}

      <button
        onClick={onOpenCoach}
        className="w-full mt-3 bg-white/15 hover:bg-white/25 rounded-xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
      >
        <MessageCircle size={14} /> Ask the coach
      </button>
    </div>
  );
}
