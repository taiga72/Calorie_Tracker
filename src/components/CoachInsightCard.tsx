import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { getOrFetchInsight, type CoachInsight } from '@/lib/geminiCoach';
import { RateLimitError } from '@/lib/gemini';
import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

export function CoachInsightCard() {
  const { meals, weights, settings } = useStore();
  const [insight, setInsight] = useState<CoachInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInsight = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOrFetchInsight(settings.geminiApiKey, { settings, meals, weights }, force);
      setInsight(res);
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
    loadInsight(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => loadInsight(true);

  return (
    <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-3.5 shadow-sm text-white">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Sparkles size={13} />
        </div>

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="h-2.5 w-full bg-white/20 rounded-full animate-pulse" />
          ) : error ? (
            <div className="flex items-start gap-1.5 text-xs text-white/90">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : insight ? (
            <p className="text-xs leading-relaxed text-white/95">{insight.tip}</p>
          ) : (
            <p className="text-xs text-white/80">Tap refresh for your daily tip.</p>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-50 active:scale-90 transition-transform flex-shrink-0"
          aria-label="Refresh insight"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  );
}
