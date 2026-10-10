import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { UndoToast } from '@/components/UndoToast';

interface PendingUndo {
  id: number;
  message: string;
  onUndo?: () => void;
  tone: 'info' | 'error';
}

interface UndoToastContextValue {
  /** Shows a dismissible "<message> — Undo" toast; calls onUndo if the user taps Undo before it times out. */
  requestUndo: (message: string, onUndo: () => void) => void;
  /** A short message with no Undo (e.g. "Backup restored"), in place of a browser alert. */
  notify: (message: string, tone?: 'info' | 'error') => void;
}

let toastSeq = 0;

const UndoToastContext = createContext<UndoToastContextValue | null>(null);

export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingUndo | null>(null);

  const requestUndo = useCallback((message: string, onUndo: () => void) => {
    setPending({ id: ++toastSeq, message, onUndo, tone: 'info' });
  }, []);
  const notify = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    setPending({ id: ++toastSeq, message, tone });
  }, []);

  const dismiss = useCallback(() => setPending(null), []);
  const undo = useCallback(() => {
    setPending((current) => {
      current?.onUndo?.();
      return null;
    });
  }, []);

  return (
    <UndoToastContext.Provider value={{ requestUndo, notify }}>
      {children}
      {pending && (
        <UndoToast
          key={pending.id}
          message={pending.message}
          onUndo={pending.onUndo ? undo : undefined}
          onDismiss={dismiss}
          tone={pending.tone}
        />
      )}
    </UndoToastContext.Provider>
  );
}

export function useUndoToast(): UndoToastContextValue {
  const ctx = useContext(UndoToastContext);
  if (!ctx) throw new Error('useUndoToast must be used within UndoToastProvider');
  return ctx;
}
