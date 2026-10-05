import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAppearance, DEFAULT_APPEARANCE, haptic, parseAppearance, readAppearance, saveAppearance, seasonalTouch, setHapticsEnabled } from '@/lib/appearance';

afterEach(() => localStorage.clear());

describe('appearance', () => {
  it('falls back to defaults for missing or unknown values', () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance({ accent: 'neon', textSize: 'large', haptics: false })).toMatchObject({ accent: 'emerald', textSize: 'large', haptics: false });
  });

  it('persists on this device', () => {
    saveAppearance({ ...DEFAULT_APPEARANCE, accent: 'violet', cardStyle: 'outline' });
    expect(readAppearance()).toMatchObject({ accent: 'violet', cardStyle: 'outline' });
  });

  it('applies to the page as attributes and a text scale', () => {
    const root = document.createElement('html');
    applyAppearance({ ...DEFAULT_APPEARANCE, accent: 'blue', textSize: 'xlarge', density: 'compact', background: 'texture', darkStyle: 'black' }, root);
    expect(root.dataset).toMatchObject({ accent: 'blue', density: 'compact', bg: 'texture', card: 'soft', darkStyle: 'black' });
    expect(root.style.getPropertyValue('--fs')).toBe('1.2');
  });

  it('has a seasonal touch, with greetings on holidays', () => {
    expect(seasonalTouch(new Date(2026, 9, 31))).toEqual({ emoji: '🎃', greeting: 'Happy Halloween' });
    expect(seasonalTouch(new Date(2026, 11, 25)).greeting).toBe('Merry Christmas');
    expect(seasonalTouch(new Date(2026, 3, 10))).toEqual({ emoji: '🌸' });
    expect(seasonalTouch(new Date(2026, 9, 5))).toEqual({ emoji: '🍂' });
  });

  it('vibrates only when haptics are on', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    setHapticsEnabled(false);
    haptic('success');
    expect(vibrate).not.toHaveBeenCalled();
    setHapticsEnabled(true);
    haptic('success');
    expect(vibrate).toHaveBeenCalledWith([10, 40, 18]);
  });
});
