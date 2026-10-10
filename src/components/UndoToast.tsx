import { useEffect } from 'react';
import { Undo2, AlertCircle, X } from 'lucide-react';

interface UndoToastProps {
  message: string;
  /** Without it, the toast is just a message (no Undo). */
  onUndo?: () => void;
  onDismiss: () => void;
  durationMs?: number;
  tone?: 'info' | 'error';
}

export function UndoToast({ message, onUndo, onDismiss, durationMs = 5000, tone = 'info' }: UndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[70] w-[calc(100%-2.5rem)] max-w-sm px-0">
      <div role="status" className={`${tone === 'error' ? 'bg-red-600' : 'bg-gray-900'} text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 animate-[slideUp_.2s_ease]`}>
        {tone === 'error' && <AlertCircle size={16} className="flex-shrink-0" />}
        <span className={`flex-1 text-sm font-medium ${onUndo ? 'truncate' : 'leading-snug'}`}>{message}</span>
        {onUndo ? (
          <button
            onClick={onUndo}
            className="flex items-center gap-1 text-accent-400 font-semibold text-sm flex-shrink-0 active:scale-95 transition-transform"
          >
            <Undo2 size={15} /> Undo
          </button>
        ) : (
          <button onClick={onDismiss} aria-label="Dismiss" className="flex-shrink-0 -m-1 p-1 opacity-70">
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
