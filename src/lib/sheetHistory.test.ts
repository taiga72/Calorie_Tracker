import { describe, expect, it, vi } from 'vitest';
import { trackSheet } from '@/lib/sheetHistory';

const nextPop = () => new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));

describe('sheet history', () => {
  it('closes the top sheet on back, leaving the one below open', async () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    const startLength = window.history.length;
    trackSheet(closeA);
    trackSheet(closeB);
    expect(window.history.length).toBe(startLength + 2);

    const popped = nextPop();
    window.history.back();
    await popped;
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
  });

  it('takes its entry back off when closed another way, without calling onBack', async () => {
    const onBack = vi.fn();
    const untrack = trackSheet(onBack);
    const popped = nextPop();
    untrack();
    await popped;
    expect(onBack).not.toHaveBeenCalled();
  });

  it('a sheet opened right after another closed waits for that back step', async () => {
    const first = trackSheet(vi.fn());
    const second = vi.fn();
    const popped = nextPop();
    first();
    trackSheet(second); // opened in the same tick
    await popped;
    await new Promise((r) => setTimeout(r, 0));
    expect(second).not.toHaveBeenCalled();
    expect(typeof (window.history.state as Record<string, unknown>).__sheet).toBe('number');
  });
});
