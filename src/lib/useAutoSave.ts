import { useEffect, useRef } from 'react';

/** True once `deps` differ from what they were when the component first rendered. */
export function useChangedSinceOpen(deps: unknown[]): boolean {
  const opened = useRef<string | null>(null);
  const now = JSON.stringify(deps);
  if (opened.current === null) opened.current = now;
  return now !== opened.current;
}

/**
 * Saves as you go, like iOS Settings: `save` runs a moment after the last
 * change to `deps` (so typing "1884" doesn't save "18"), right away if the
 * screen closes with a change still waiting, and never while the values are
 * still the ones the screen opened with. That's a comparison, not "skip the
 * first effect": React's StrictMode runs effects twice in development.
 */
export function useAutoSave(save: () => void, deps: unknown[], delay = 800): void {
  const latest = useRef(save);
  latest.current = save;
  const changed = useChangedSinceOpen(deps);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!changed) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; latest.current(); }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; latest.current(); }
  }, []);
}
