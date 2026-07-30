import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/Modal';
import { useStore } from '@/store';
import { askCoach, getOrFetchInsight, type CoachMessage, type CoachInsight } from '@/lib/geminiCoach';
import { RateLimitError } from '@/lib/gemini';
import { Sparkles, Send, AlertCircle, RefreshCw } from 'lucide-react';

const QUICK_PROMPTS = [
  'Is my calorie deficit right for me?',
  'What should I do if my weight loss stalls?',
  'How am I doing this week?',
  'What should I eat for dinner to hit my macros?',
];

const GREETING: CoachMessage = {
  role: 'model',
  text: "Hi! I'm your AI coach. I can see your goals and recent logs. Ask me anything, or tap a suggestion below.",
};

export function AICoachModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { meals, weights, settings } = useStore();
  const [messages, setMessages] = useState<CoachMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<CoachInsight | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([GREETING]);
      setError(null);
      setInput('');
      setInsight(null);
      getOrFetchInsight(settings.geminiApiKey, { settings, meals, weights }, false)
        .then(setInsight)
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const nextHistory = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    try {
      const reply = await askCoach(settings.geminiApiKey, { settings, meals, weights }, nextHistory.slice(0, -1), trimmed);
      setMessages((prev) => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      const msg = err instanceof RateLimitError
        ? `You're sending requests too fast. Please wait about ${err.retryAfterSec}s and try again.`
        : err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Sparkles size={18} className="text-emerald-600" /> AI Coach</span>}>
      {insight && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-2xl px-3.5 py-3 mb-3">
          <Sparkles size={15} className="mt-0.5 flex-shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-emerald-900">{insight.summary}</p>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="space-y-3 max-h-[52vh] overflow-y-auto -mx-1 px-1 pb-2">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-md'
                  : 'bg-white border border-gray-100 text-gray-700 rounded-bl-md'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-3.5 py-3 flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-600 text-xs rounded-xl p-3 mt-3">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick prompts */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 -mx-1 px-1">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            disabled={loading}
            className="flex-shrink-0 bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-2 rounded-full whitespace-nowrap disabled:opacity-50 active:scale-[.98] transition-transform"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 mt-3 bg-white border border-gray-100 rounded-2xl px-3 py-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
          placeholder="Ask your coach anything..."
          disabled={loading}
          className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-300 disabled:opacity-50"
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
        >
          <Send size={15} />
        </button>
      </div>
    </Modal>
  );
}

export function CoachRefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="p-1.5 rounded-full hover:bg-emerald-50 text-emerald-600 disabled:opacity-40 active:scale-90 transition-transform"
      aria-label="Refresh insight"
    >
      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
    </button>
  );
}
