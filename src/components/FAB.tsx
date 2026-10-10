import { useEffect, useRef, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';

/**
 * The floating + (log) and ✨ (coach) buttons. They slide away while you
 * scroll down — so they don't sit on top of what you're reading — and come
 * back as soon as you scroll up or reach the top or bottom.
 */
export function FAB({ onClick, onCoachClick, coachHint, onHintDismiss }: {
  onClick: () => void;
  onCoachClick: () => void;
  /** First-run hint next to the coach button. */
  coachHint?: boolean;
  onHintDismiss?: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 8;
      if (y < 40 || atBottom) setHidden(false);
      else if (y > lastY.current + 6) setHidden(true);
      else if (y < lastY.current - 6) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed right-5 bottom-28 z-50 flex flex-col items-end gap-3 transition-all duration-300 ${hidden ? 'translate-x-24 opacity-0 pointer-events-none' : ''}`}
      aria-hidden={hidden || undefined}
    >
      <div className="flex items-center gap-2 mr-1">
        {coachHint && !hidden && (
          <button
            onClick={onHintDismiss}
            className="relative bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold rounded-xl px-3 py-2 shadow-lg animate-[popIn_.3s_ease-out] text-left"
          >
            Ask your AI coach
            <span className="block text-10 font-normal opacity-70">Advice based on your own logs</span>
            <span aria-hidden className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 rotate-45 bg-gray-900 dark:bg-white" />
          </button>
        )}
        <button
          onClick={onCoachClick}
          aria-label="Open AI Coach"
          tabIndex={hidden ? -1 : undefined}
          className="w-12 h-12 rounded-full bg-accent-600 text-white shadow-lg shadow-accent-600/30 flex items-center justify-center active:scale-95 transition-transform hover:bg-accent-700"
        >
          <Sparkles size={20} />
        </button>
      </div>
      <button
        onClick={onClick}
        aria-label="Add entry"
        tabIndex={hidden ? -1 : undefined}
        className="w-14 h-14 rounded-full bg-gray-900 text-white shadow-lg shadow-black/30 flex items-center justify-center active:scale-95 transition-transform hover:bg-gray-800"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </div>
  );
}
