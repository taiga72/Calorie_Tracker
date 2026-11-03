import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTabScroll } from '@/lib/useTabScroll';

const scrollTo = vi.fn();
const setScrollY = (y: number) => Object.defineProperty(window, 'scrollY', { value: y, configurable: true });

beforeEach(() => {
  scrollTo.mockClear();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  setScrollY(0);
});

describe('useTabScroll', () => {
  it('opens a tab at the top, and goes back to where each tab was left', () => {
    const { result } = renderHook(() => useTabScroll<'home' | 'stats'>('home'));
    setScrollY(500);
    act(() => result.current[1]('stats'));
    expect(result.current[0]).toBe('stats');
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    setScrollY(120);
    act(() => result.current[1]('home'));
    expect(result.current[0]).toBe('home');
    expect(scrollTo).toHaveBeenLastCalledWith(0, 500);
    act(() => result.current[1]('stats'));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 120);
  });

  it('tapping the tab you are on scrolls it to the top', () => {
    const { result } = renderHook(() => useTabScroll<'home' | 'stats'>('home'));
    setScrollY(800);
    act(() => result.current[1]('home'));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
  });
});
