import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/lib/theme';
import type { Settings } from '@/types';

let settings: Settings;
const updatePrefs = vi.fn((patch: Settings['prefs']) => { settings = { ...settings, prefs: { ...settings.prefs, ...patch } }; });
vi.mock('@/store', () => ({ useStore: () => ({ settings, updatePrefs, loading: false }) }));
const { AppearanceSync } = await import('@/components/AppearanceSync');

const base: Settings = { calorieGoal: 2000, goalWeight: 70, weeklyWeightTarget: 0, weightUnit: 'kg', geminiApiKey: '' };
let theme: ReturnType<typeof useTheme>;
function Probe() { theme = useTheme(); return null; }
const tree = () => <ThemeProvider><AppearanceSync /><Probe /></ThemeProvider>;

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  updatePrefs.mockClear();
  settings = { ...base };
});

describe('AppearanceSync', () => {
  it("saves this device's look to the account when the account has none", () => {
    render(tree());
    expect(updatePrefs).toHaveBeenCalledWith({ appearance: expect.objectContaining({ accent: 'emerald', theme: 'system' }) });
  });

  it('applies the look saved on the account', () => {
    settings = { ...base, prefs: { appearance: { accent: 'violet', textSize: 'large', theme: 'dark' } } };
    render(tree());
    expect(theme.appearance.accent).toBe('violet');
    expect(theme.appearance.textSize).toBe('large');
    expect(theme.preference).toBe('dark');
    expect(updatePrefs).not.toHaveBeenCalled();
  });

  it('saves changes made here, and stays put when sync is off', () => {
    const { rerender } = render(tree());
    updatePrefs.mockClear();
    act(() => theme.setAppearance({ accent: 'blue' }));
    rerender(tree());
    expect(updatePrefs).toHaveBeenLastCalledWith({ appearance: expect.objectContaining({ accent: 'blue' }) });

    updatePrefs.mockClear();
    act(() => theme.setAppearance({ syncAcrossDevices: false }));
    act(() => theme.setAppearance({ accent: 'pink' }));
    rerender(tree());
    expect(updatePrefs).not.toHaveBeenCalled();
  });
});
