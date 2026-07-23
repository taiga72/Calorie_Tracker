import { useState } from 'react';
import { StoreProvider } from '@/store';
import { BottomNav } from '@/components/BottomNav';
import { HomeTab } from '@/tabs/HomeTab';
import { StatsTab } from '@/tabs/StatsTab';
import { CalendarTab } from '@/tabs/CalendarTab';
import { SettingsTab } from '@/tabs/SettingsTab';
import type { TabKey } from '@/types';

export function App() {
  const [tab, setTab] = useState<TabKey>('home');

  return (
    <StoreProvider>
      <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
        {tab === 'home' && <HomeTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'settings' && <SettingsTab />}
        <BottomNav active={tab} onChange={setTab} />
      </div>
    </StoreProvider>
  );
}
