import { Home, BarChart3, Calendar, Settings } from 'lucide-react';
import type { TabKey } from '@/types';

interface BottomNavProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string; Icon: typeof Home }[] = [
  { key: 'home', label: 'Today', Icon: Home },
  { key: 'stats', label: 'Stats', Icon: BarChart3 },
  { key: 'calendar', label: 'Calendar', Icon: Calendar },
  { key: 'settings', label: 'Settings', Icon: Settings },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-2 pb-[env(safe-area-inset-bottom)] z-30">
      <div className="max-w-md mx-auto flex items-center justify-around h-16">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="flex flex-col items-center gap-1 py-1 px-3 transition-colors"
            >
              <Icon
                size={22}
                className={isActive ? 'text-emerald-600' : 'text-gray-300'}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] font-semibold ${isActive ? 'text-emerald-600' : 'text-gray-300'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
