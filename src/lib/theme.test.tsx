import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/lib/theme';

function mockMatchMedia(prefersDark: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  return {
    fireChange: (matches: boolean) => {
      act(() => listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent)));
    },
  };
}

function Probe() {
  const { preference, isDark, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="pref">{preference}</span>
      <span data-testid="isDark">{String(isDark)}</span>
      <button onClick={() => setPreference('light')}>light</button>
      <button onClick={() => setPreference('dark')}>dark</button>
      <button onClick={() => setPreference('system')}>system</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('ThemeProvider', () => {
  it('defaults to system preference and resolves light when the OS prefers light', () => {
    mockMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('pref').textContent).toBe('system');
    expect(screen.getByTestId('isDark').textContent).toBe('false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('resolves dark when the OS prefers dark under the system preference', () => {
    mockMatchMedia(true);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('isDark').textContent).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('restores a previously saved preference from localStorage', () => {
    mockMatchMedia(false);
    localStorage.setItem('calorie_tracker_theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('pref').textContent).toBe('dark');
    expect(screen.getByTestId('isDark').textContent).toBe('true');
  });

  it('switches themes and persists the choice', () => {
    mockMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);

    fireEvent.click(screen.getByText('dark'));
    expect(screen.getByTestId('isDark').textContent).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('calorie_tracker_theme')).toBe('dark');

    fireEvent.click(screen.getByText('light'));
    expect(screen.getByTestId('isDark').textContent).toBe('false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('tracks OS changes live while on the system preference', () => {
    const { fireChange } = mockMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('isDark').textContent).toBe('false');

    fireChange(true);
    expect(screen.getByTestId('isDark').textContent).toBe('true');
  });

  it('throws when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/must be used within ThemeProvider/);
    spy.mockRestore();
  });
});
