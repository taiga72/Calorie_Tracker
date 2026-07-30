import { useState, useEffect } from 'react';
import { StoreProvider, useStore } from '@/store';
import { BottomNav } from '@/components/BottomNav';
import { FAB } from '@/components/FAB';
import { LogModal } from '@/modals/LogModal';
import { AICoachModal } from '@/components/AICoachModal';
import { StreakModal } from '@/modals/StreakModal';
import { HomeTab } from '@/tabs/HomeTab';
import { StatsTab } from '@/tabs/StatsTab';
import { CalendarTab } from '@/tabs/CalendarTab';
import { SettingsTab } from '@/tabs/SettingsTab';
import { calculateStreak, shouldShowStreakPopup } from '@/lib/streakUtils';
import type { TabKey } from '@/types';

function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}

function AppInner() {
  const [tab, setTab] = useState<TabKey>('home');
  const [logOpen, setLogOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const { meals, profile } = useStore();

  useEffect(() => {
    const { count } = calculateStreak(meals);
    if (shouldShowStreakPopup(count)) {
      setStreakCount(count);
      setStreakOpen(true);
    }
  }, [meals]);

  return (
    <div className="min-h-screen bg-[#F4F5F6] text-gray-900 max-w-md mx-auto">
      <main className="pb-24">
        {tab === 'home' && <HomeTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>

      <FAB onClick={() => setLogOpen(true)} onCoachClick={() => setCoachOpen(true)} />
      <BottomNav active={tab} onChange={setTab} />
      <LogModal open={logOpen} onClose={() => setLogOpen(false)} />
      <AICoachModal open={coachOpen} onClose={() => setCoachOpen(false)} />
      <StreakModal
        open={streakOpen}
        onClose={() => setStreakOpen(false)}
        name={profile.name}
        streak={streakCount}
      />
    </div>
  );
}

export default App;
