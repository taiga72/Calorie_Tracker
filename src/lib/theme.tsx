import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { applyAppearance, readAppearance, saveAppearance, setHapticsEnabled, DEFAULT_APPEARANCE, type Appearance } from '@/lib/appearance';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'calorie_tracker_theme';

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveIsDark(pref: ThemePreference): boolean {
  return pref === 'dark' || (pref === 'system' && getSystemPrefersDark());
}

function readStoredPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // localStorage can throw (private browsing, disabled storage) — fall back to system.
  }
  return 'system';
}

interface ThemeContextValue {
  preference: ThemePreference;
  isDark: boolean;
  setPreference: (p: ThemePreference) => void;
  /** Accent, text size, density, card style… (see lib/appearance). */
  appearance: Appearance;
  setAppearance: (patch: Partial<Appearance>) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [isDark, setIsDark] = useState(() => resolveIsDark(preference));
  const [appearance, setAppearanceState] = useState<Appearance>(readAppearance);

  useEffect(() => {
    applyAppearance(appearance);
    setHapticsEnabled(appearance.haptics);
  }, [appearance]);

  const setAppearance = (patch: Partial<Appearance>) => {
    setAppearanceState((prev) => {
      const next = { ...prev, ...patch };
      saveAppearance(next);
      return next;
    });
  };

  useEffect(() => {
    setIsDark(resolveIsDark(preference));
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // best-effort persistence only
    }
  };

  return (
    <ThemeContext.Provider value={{ preference, isDark, setPreference, appearance, setAppearance }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** The look-and-feel settings; defaults outside a ThemeProvider (e.g. in tests). */
export function useAppearance(): Appearance {
  return useContext(ThemeContext)?.appearance ?? DEFAULT_APPEARANCE;
}
