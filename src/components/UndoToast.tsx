import { useEffect } from 'react';
import { Undo2 } from 'lucide-react';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export function UndoToast({ message, onUndo, onDismiss, durationMs = 5000 }: UndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[70] w-[calc(100%-2.5rem)] max-w-sm px-0">
      <div className="bg-gray-900 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 animate-[slideUp_.2s_ease]">
        <span className="flex-1 text-sm font-medium truncate">{message}</span>
        <button
          onClick={onUndo}
          className="flex items-center gap-1 text-emerald-400 font-semibold text-sm flex-shrink-0 active:scale-95 transition-transform"
        >
          <Undo2 size={15} /> Undo
        </button>
      </div>
    </div>
  );
}
