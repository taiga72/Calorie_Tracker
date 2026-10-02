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
    <nav className="fixed bottom-0 inset-x-0 z-40 pb-[calc(env(safe-area-inset-bottom)+12px)] pointer-events-none">
      <div className="max-w-md mx-auto px-4 pointer-events-none">
        <div className="pointer-events-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur rounded-full shadow-lg shadow-black/10 dark:shadow-black/40 border border-gray-100 dark:border-gray-800 grid grid-cols-4 overflow-hidden">
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
                  className={isActive ? 'text-emerald-600' : 'text-gray-300 dark:text-gray-600'}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={`text-[10px] font-semibold ${isActive ? 'text-emerald-600' : 'text-gray-400 dark:text-gray-500'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
