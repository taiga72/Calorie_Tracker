import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * The selected tab, iPhone-style: each tab keeps its own scroll position
 * (a tab not seen yet opens at the top), and tapping the tab you're already
 * on scrolls it back to the top.
 */
export function useTabScroll<T extends string>(initial: T): [T, (t: T) => void] {
  const [tab, setTab] = useState<T>(initial);
  const current = useRef(initial);
  const positions = useRef(new Map<T, number>());
  const pending = useRef<number | null>(null);

  const select = useCallback((next: T) => {
    if (next === current.current) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    positions.current.set(current.current, window.scrollY);
    current.current = next;
    pending.current = positions.current.get(next) ?? 0;
    setTab(next);
  }, []);

  // After the new tab has rendered, before it's painted.
  useLayoutEffect(() => {
    if (pending.current === null) return;
    window.scrollTo(0, pending.current);
    pending.current = null;
  }, [tab]);

  return [tab, select];
}
