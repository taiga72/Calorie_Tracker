/**
 * Look-and-feel preferences. Like light/dark mode, they're kept per device
 * (a phone and a tablet can look different) and applied to <html> as data
 * attributes and CSS variables that index.css and tailwind.config.js read.
 */

export type AccentId = 'emerald' | 'teal' | 'blue' | 'indigo' | 'violet' | 'pink' | 'slate';
export type TextSize = 'standard' | 'large' | 'xlarge';
export type Density = 'comfortable' | 'compact';
export type BackgroundStyle = 'plain' | 'gradient' | 'texture';
export type CardStyle = 'soft' | 'sharp' | 'outline';
export type DarkStyle = 'gray' | 'black';

export interface Appearance {
  accent: AccentId;
  textSize: TextSize;
  density: Density;
  background: BackgroundStyle;
  cardStyle: CardStyle;
  darkStyle: DarkStyle;
  seasonal: boolean;
  haptics: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
  accent: 'emerald',
  textSize: 'standard',
  density: 'comfortable',
  background: 'plain',
  cardStyle: 'soft',
  darkStyle: 'gray',
  seasonal: false,
  haptics: true,
};

/** Swatches for the picker (the 600 shade, as in buttons). */
export const ACCENTS: { id: AccentId; label: string; swatch: string }[] = [
  { id: 'emerald', label: 'Emerald', swatch: '#059669' },
  { id: 'teal', label: 'Teal', swatch: '#0d9488' },
  { id: 'blue', label: 'Blue', swatch: '#2563eb' },
  { id: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
  { id: 'violet', label: 'Violet', swatch: '#7c3aed' },
  { id: 'pink', label: 'Pink', swatch: '#db2777' },
  { id: 'slate', label: 'Slate', swatch: '#475569' },
];

export const TEXT_SCALE: Record<TextSize, number> = { standard: 1, large: 1.1, xlarge: 1.2 };

export const APPEARANCE_KEY = 'calorie_tracker_appearance';

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly unknown[]).includes(v) ? (v as T) : fallback;

export function parseAppearance(raw: unknown): Appearance {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_APPEARANCE;
  return {
    accent: pick(o.accent, ACCENTS.map((a) => a.id), d.accent),
    textSize: pick(o.textSize, ['standard', 'large', 'xlarge'] as const, d.textSize),
    density: pick(o.density, ['comfortable', 'compact'] as const, d.density),
    background: pick(o.background, ['plain', 'gradient', 'texture'] as const, d.background),
    cardStyle: pick(o.cardStyle, ['soft', 'sharp', 'outline'] as const, d.cardStyle),
    darkStyle: pick(o.darkStyle, ['gray', 'black'] as const, d.darkStyle),
    seasonal: typeof o.seasonal === 'boolean' ? o.seasonal : d.seasonal,
    haptics: typeof o.haptics === 'boolean' ? o.haptics : d.haptics,
  };
}

export function readAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    return parseAppearance(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(a: Appearance): void {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(a));
  } catch {
    // best-effort, like the theme
  }
}

/** Mirrors the pre-paint script in index.html (keep the two in step). */
export function applyAppearance(a: Appearance, root: HTMLElement = document.documentElement): void {
  root.dataset.accent = a.accent;
  root.dataset.density = a.density;
  root.dataset.bg = a.background;
  root.dataset.card = a.cardStyle;
  root.dataset.darkStyle = a.darkStyle;
  root.style.setProperty('--fs', String(TEXT_SCALE[a.textSize]));
}

// ---- Seasonal touches

export interface SeasonalTouch {
  emoji: string;
  /** Only on special days, e.g. "Happy Halloween". */
  greeting?: string;
}

/** A small seasonal emoji for the Home header, and a line on special days. */
export function seasonalTouch(d: Date): SeasonalTouch {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if ((m === 12 && day === 31) || (m === 1 && day <= 2)) return { emoji: '🎆', greeting: 'Happy New Year' };
  if (m === 2 && day === 14) return { emoji: '💝', greeting: "Happy Valentine's Day" };
  if (m === 10 && day >= 25) return { emoji: '🎃', greeting: day === 31 ? 'Happy Halloween' : undefined };
  if (m === 12 && day >= 20 && day <= 26) return { emoji: '🎄', greeting: day === 25 ? 'Merry Christmas' : undefined };
  if (m === 12 || m <= 2) return { emoji: '❄️' };
  if (m <= 5) return { emoji: '🌸' };
  if (m <= 8) return { emoji: '☀️' };
  return { emoji: '🍂' };
}

// ---- Haptics

let hapticsOn = DEFAULT_APPEARANCE.haptics;
export function setHapticsEnabled(on: boolean): void {
  hapticsOn = on;
}

const PATTERNS = { light: 8, success: [10, 40, 18], celebrate: [14, 50, 14, 50, 28] } as const;
export type HapticKind = keyof typeof PATTERNS;

/**
 * A short vibration. Android supports it; iPhone browsers don't offer the
 * vibration API, so there it falls back to toggling a hidden switch, which
 * recent iOS versions answer with a light tap (and older ones ignore).
 */
export function haptic(kind: HapticKind = 'light'): void {
  if (!hapticsOn || typeof window === 'undefined') return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind] as number | number[]);
      return;
    }
    iosTick();
  } catch {
    // haptics are a nicety; never let them break anything
  }
}

let iosSwitch: HTMLLabelElement | null = null;
function iosTick() {
  if (!/iP(hone|ad|od)/.test(navigator.userAgent)) return;
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}
