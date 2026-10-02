import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { UndoToast } from '@/components/UndoToast';

interface PendingUndo {
  message: string;
  onUndo: () => void;
}

interface UndoToastContextValue {
  /** Shows a dismissible "<message> — Undo" toast; calls onUndo if the user taps Undo before it times out. */
  requestUndo: (message: string, onUndo: () => void) => void;
}

const UndoToastContext = createContext<UndoToastContextValue | null>(null);

export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingUndo | null>(null);

  const requestUndo = useCallback((message: string, onUndo: () => void) => {
    setPending({ message, onUndo });
  }, []);

  const dismiss = useCallback(() => setPending(null), []);
  const undo = useCallback(() => {
    setPending((current) => {
      current?.onUndo();
      return null;
    });
  }, []);

  return (
    <UndoToastContext.Provider value={{ requestUndo }}>
      {children}
      {pending && <UndoToast key={pending.message} message={pending.message} onUndo={undo} onDismiss={dismiss} />}
    </UndoToastContext.Provider>
  );
}

export function useUndoToast(): UndoToastContextValue {
  const ctx = useContext(UndoToastContext);
  if (!ctx) throw new Error('useUndoToast must be used within UndoToastProvider');
  return ctx;
}
