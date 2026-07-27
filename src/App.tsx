import { useState } from 'react';
import { StoreProvider } from '@/store';
import { BottomNav } from '@/components/BottomNav';
import { FAB } from '@/components/FAB';
import { LogModal } from '@/modals/LogModal';
import { AICoachModal } from '@/components/AICoachModal';
import { HomeTab } from '@/tabs/HomeTab';
import { StatsTab } from '@/tabs/StatsTab';
import { CalendarTab } from '@/tabs/CalendarTab';
import { SettingsTab } from '@/tabs/SettingsTab';
import type { TabKey } from '@/types';

function App() {
  const [tab, setTab] = useState<TabKey>('home');
  const [logOpen, setLogOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

  return (
    <StoreProvider>
      <div className="min-h-screen bg-[#F4F5F6] text-gray-900 max-w-md mx-auto">
        <main className="pb-24">
          {tab === 'home' && <HomeTab onOpenCoach={() => setCoachOpen(true)} />}
          {tab === 'stats' && <StatsTab />}
          {tab === 'calendar' && <CalendarTab />}
          {tab === 'settings' && <SettingsTab />}
        </main>

        <FAB onClick={() => setLogOpen(true)} />
        <BottomNav active={tab} onChange={setTab} />
        <LogModal open={logOpen} onClose={() => setLogOpen(false)} />
        <AICoachModal open={coachOpen} onClose={() => setCoachOpen(false)} />
      </div>
    </StoreProvider>
  );
}

export default App;
