import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoSave } from '@/lib/useAutoSave';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useAutoSave', () => {
  it('does not save when the screen opens', () => {
    const save = vi.fn();
    renderHook(({ v }) => useAutoSave(save, [v]), { initialProps: { v: 1 } });
    vi.advanceTimersByTime(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it('saves once, shortly after the last change', () => {
    const save = vi.fn();
    const { rerender } = renderHook(({ v }) => useAutoSave(save, [v]), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    vi.advanceTimersByTime(500);
    rerender({ v: 3 });
    vi.advanceTimersByTime(500);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves right away a change still waiting when the screen closes', () => {
    const save = vi.fn();
    const { rerender, unmount } = renderHook(({ v }) => useAutoSave(save, [v]), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    unmount();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('uses the latest save function', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ v, s }) => useAutoSave(s, [v]), { initialProps: { v: 1, s: first } });
    rerender({ v: 2, s: second });
    vi.advanceTimersByTime(1000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
