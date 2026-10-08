import type { ReactNode } from 'react';
import { useTheme, type ThemePreference } from '@/lib/theme';
import { ACCENTS, DEFAULT_APPEARANCE, haptic, type Appearance } from '@/lib/appearance';
import { useUndoToast } from '@/components/UndoToastProvider';
import { Sun, Moon, MonitorSmartphone, Check, Palette, RotateCcw } from 'lucide-react';

/** Settings → Appearance: theme plus the look-and-feel options (kept on this device). */
export function AppearanceSection() {
  const { preference, setPreference, appearance: a, setAppearance } = useTheme();
  const { requestUndo } = useUndoToast();
  const isDefault = preference === 'system' && (Object.keys(DEFAULT_APPEARANCE) as (keyof Appearance)[])
    .every((k) => k === 'syncAcrossDevices' || a[k] === DEFAULT_APPEARANCE[k]);
  const reset = () => {
    const before = { appearance: a, preference };
    setAppearance({ ...DEFAULT_APPEARANCE, syncAcrossDevices: a.syncAcrossDevices });
    setPreference('system');
    requestUndo('Appearance reset', () => { setAppearance(before.appearance); setPreference(before.preference); });
  };

  return (
    <div className="card p-5 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <Palette size={18} className="text-accent-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Appearance</h2>
        {!isDefault && (
          <button onClick={reset} className="ml-auto flex items-center gap-1 text-11 font-semibold text-gray-400 hover:text-accent-600">
            <RotateCcw size={12} /> Reset to default
          </button>
        )}
      </div>

      <Segmented<ThemePreference>
        label="Theme"
        value={preference}
        onChange={setPreference}
        options={[
          { value: 'light', label: 'Light', icon: <Sun size={15} /> },
          { value: 'dark', label: 'Dark', icon: <Moon size={15} /> },
          { value: 'system', label: 'System', icon: <MonitorSmartphone size={15} /> },
        ]}
      />

      <p className="text-11 font-semibold text-gray-500 dark:text-gray-400 mt-4 mb-2">Accent colour</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent colour">
        {ACCENTS.map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={a.accent === c.id}
            aria-label={c.label}
            onClick={() => setAppearance({ accent: c.id })}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 ${a.accent === c.id ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white ring-offset-white dark:ring-offset-gray-900' : ''}`}
            style={{ backgroundColor: c.swatch }}
          >
            {a.accent === c.id && <Check size={16} className="text-white" strokeWidth={3} />}
          </button>
        ))}
      </div>

      <Segmented<Appearance['textSize']>
        label="Text size"
        value={a.textSize}
        onChange={(textSize) => setAppearance({ textSize })}
        options={[
          { value: 'standard', label: 'Standard', icon: <span className="text-xs font-bold">Aa</span> },
          { value: 'large', label: 'Large', icon: <span className="text-sm font-bold">Aa</span> },
          { value: 'xlarge', label: 'Extra large', icon: <span className="text-base font-bold">Aa</span> },
        ]}
      />

      <Segmented<Appearance['background']>
        label="Background"
        value={a.background}
        onChange={(background) => setAppearance({ background })}
        options={[
          { value: 'plain', label: 'Plain', icon: <Swatch className="bg-gray-100 dark:bg-gray-800" /> },
          { value: 'gradient', label: 'Gradient', icon: <Swatch className="bg-gradient-to-b from-accent-200 to-gray-100 dark:from-accent-800 dark:to-gray-800" /> },
          { value: 'texture', label: 'Texture', icon: <Swatch className="bg-gray-100 dark:bg-gray-800 bg-[radial-gradient(rgb(0_0_0/.25)_1px,transparent_1.2px)] dark:bg-[radial-gradient(rgb(255_255_255/.3)_1px,transparent_1.2px)] bg-[length:5px_5px]" /> },
        ]}
      />

      <Segmented<Appearance['cardStyle']>
        label="Cards"
        value={a.cardStyle}
        onChange={(cardStyle) => setAppearance({ cardStyle })}
        options={[
          { value: 'soft', label: 'Soft', icon: <span className="w-6 h-4 rounded-md bg-white dark:bg-gray-700 shadow" /> },
          { value: 'sharp', label: 'Sharp', icon: <span className="w-6 h-4 rounded-sm bg-white dark:bg-gray-700 shadow" /> },
          { value: 'outline', label: 'Outlined', icon: <span className="w-6 h-4 rounded-md border-2 border-gray-300 dark:border-gray-500" /> },
        ]}
      />

      <Segmented<Appearance['density']>
        label="Layout"
        value={a.density}
        onChange={(density) => setAppearance({ density })}
        options={[
          { value: 'comfortable', label: 'Comfortable' },
          { value: 'compact', label: 'Compact' },
        ]}
      />

      <Segmented<Appearance['darkStyle']>
        label="Dark mode style"
        value={a.darkStyle}
        onChange={(darkStyle) => setAppearance({ darkStyle })}
        options={[
          { value: 'gray', label: 'Dark grey', icon: <Swatch className="bg-[#111827] border border-gray-500" /> },
          { value: 'black', label: 'True black', icon: <Swatch className="bg-black border border-gray-600" /> },
        ]}
      />

      <div className="mt-4 space-y-1">
        <Toggle
          label="Seasonal touches"
          sub="A small seasonal emoji on Home, and a greeting on holidays"
          on={a.seasonal}
          onChange={(seasonal) => setAppearance({ seasonal })}
        />
        <Toggle
          label="Haptics"
          sub="A light tap on swipes, saves and milestones (support varies on iPhone)"
          on={a.haptics}
          onChange={(haptics) => {
            setAppearance({ haptics });
            if (haptics) setTimeout(() => haptic('success'), 0);
          }}
        />
        <Toggle
          label="Same look on all my devices"
          sub="Theme, colour, text size and the rest follow your account"
          on={a.syncAcrossDevices}
          onChange={(syncAcrossDevices) => setAppearance({ syncAcrossDevices })}
        />
      </div>
    </div>
  );
}

function Swatch({ className }: { className: string }) {
  return <span className={`w-6 h-4 rounded-md ${className}`} />;
}

export function Segmented<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-11 font-semibold text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2.5 compact:py-2 rounded-xl text-xs font-semibold transition-colors ${
              value === o.value
                ? 'bg-gray-900 dark:bg-accent-600 text-white'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            {o.icon && <span className="h-5 flex items-center">{o.icon}</span>}
            <span className="truncate max-w-full px-1">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
        {sub && <p className="text-11 text-gray-400 leading-snug">{sub}</p>}
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${on ? 'bg-accent-600' : 'bg-gray-200 dark:bg-gray-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
