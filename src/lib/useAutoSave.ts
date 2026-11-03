import { useEffect, useRef } from 'react';

/**
 * Saves as you go, like iOS Settings: `save` runs a moment after the last
 * change to `deps` (so typing "1884" doesn't save "18"), never just for
 * opening the screen, and right away if the screen closes with a change
 * still waiting.
 */
export function useAutoSave(save: () => void, deps: unknown[], delay = 800): void {
  const latest = useRef(save);
  latest.current = save;
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; latest.current(); }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); latest.current(); }
  }, []);
}
