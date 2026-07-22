import { Home, BarChart3, Calendar, Settings as SettingsIcon } from 'lucide-react';
import type { TabKey } from '@/types';

const ITEMS: { key: TabKey; label: string; Icon: typeof Home }[] = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'stats', label: 'Statistics', Icon: BarChart3 },
  { key: 'calendar', label: 'Calendar', Icon: Calendar },
  { key: 'settings', label: 'Settings', Icon: SettingsIcon },
];

interface BottomNavProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-4">
        {ITEMS.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
            >
              <Icon
                size={22}
                className={isActive ? 'text-emerald-600' : 'text-gray-300'}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] font-semibold ${isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
