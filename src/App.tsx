import { useState, useEffect } from 'react';
import { StoreProvider, useStore } from '@/store';
import { AuthProvider, useAuth } from '@/auth';
import { AuthScreen } from '@/components/AuthScreen';
import { SupabaseSetupScreen } from '@/components/SupabaseSetupScreen';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import { ThemeProvider } from '@/lib/theme';
import { SplashProvider, SplashReady } from '@/components/SplashScreen';
import { useSplashReady } from '@/lib/splash';
import { ReminderBanner } from '@/components/Reminders';
import { useReminders } from '@/lib/useReminders';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
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
import { newlyAchieved } from '@/lib/milestones';
import { todayKey } from '@/lib/dateUtils';
import { MilestoneModal } from '@/components/Milestones';
import { Loader2, AlertTriangle, X, CloudOff, RefreshCw } from 'lucide-react';
import type { Milestone, TabKey } from '@/types';

function App() {
  return (
    <ThemeProvider>
      <SplashProvider>
        {isSupabaseConfigured ? (
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        ) : (
          <>
            <SplashReady />
            <SupabaseSetupScreen />
          </>
        )}
      </SplashProvider>
    </ThemeProvider>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  // The splash covers the auth check; once signed in, AppInner keeps it up
  // until the data has loaded.
  useSplashReady(!loading && !user);

  if (loading) return null;

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <StoreProvider>
      <UndoToastProvider>
        <AppInner />
      </UndoToastProvider>
    </StoreProvider>
  );
}

function AppInner() {
  const [tab, setTab] = useState<TabKey>('home');
  const [logOpen, setLogOpen] = useState(false);
  const [logMode, setLogMode] = useState<'food' | 'weight'>('food');
  const [coachOpen, setCoachOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const { meals, weights, settings, updatePrefs, profile, loading, syncError, dismissSyncError, refresh, refreshing, online, pendingCount } = useStore();
  const [celebrate, setCelebrate] = useState<Milestone | null>(null);
  useSplashReady(!loading);
  const reminder = useReminders(!loading);

  const openLog = (mode: 'food' | 'weight') => {
    setLogMode(mode);
    setLogOpen(true);
  };

  useEffect(() => {
    if (loading) return;
    const { count, todayLogged } = calculateStreak(meals);
    if (shouldShowStreakPopup(count, todayLogged)) {
      setStreakCount(count);
      setStreakOpen(true);
    }
  }, [meals, loading]);

  // Celebrate milestones as they're reached (once each: they're marked as
  // reached right away, on every device).
  useEffect(() => {
    if (loading) return;
    const milestones = settings.prefs?.milestones ?? [];
    const reached = newlyAchieved(milestones, { meals, weights, settings });
    if (reached.length === 0) return;
    const ids = new Set(reached.map((m) => m.id));
    const today = todayKey();
    updatePrefs({ milestones: milestones.map((m) => (ids.has(m.id) ? { ...m, achievedAt: today } : m)) });
    setCelebrate(reached[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals, weights, settings.prefs?.milestones, loading]);

  if (loading) return null;

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 max-w-md mx-auto">
      {syncError && (
        <div className="sticky top-0 z-50 flex items-start gap-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-xs p-3 border-b border-red-100 dark:border-red-900">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span className="flex-1">{syncError}</span>
          <button
            onClick={() => refresh()}
            disabled={refreshing}
            aria-label="Retry"
            className="flex-shrink-0 flex items-center gap-1 font-semibold underline disabled:opacity-50"
          >
            {refreshing ? <Loader2 size={13} className="animate-spin" /> : 'Retry now'}
          </button>
          <button onClick={dismissSyncError} aria-label="Dismiss" className="flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}
      {(!online || pendingCount > 0) && (
        <div className="sticky top-0 z-40 flex justify-center pt-2 -mb-9 pointer-events-none">
          <span role="status" className="pointer-events-auto inline-flex items-center gap-1.5 text-11 font-semibold px-3 py-1.5 rounded-full shadow-sm bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 backdrop-blur animate-[slideDown_.25s_ease-out]">
            {!online ? (
              <><CloudOff size={12} /> Offline{pendingCount > 0 ? ` · ${pendingCount} change${pendingCount === 1 ? '' : 's'} saved on this device` : ''}</>
            ) : (
              <><RefreshCw size={12} className="animate-spin" /> Syncing {pendingCount} change{pendingCount === 1 ? '' : 's'}…</>
            )}
          </span>
        </div>
      )}
      {reminder.active && (
        <ReminderBanner
          id={reminder.active}
          onLog={() => { openLog(reminder.active === 'weighIn' ? 'weight' : 'food'); reminder.dismiss(); }}
          onDismiss={reminder.dismiss}
        />
      )}
      <main className="pb-28">
        {tab === 'home' && <HomeTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>

      <FAB onClick={() => openLog('food')} onCoachClick={() => setCoachOpen(true)} />
      <BottomNav active={tab} onChange={setTab} />
      <LogModal open={logOpen} onClose={() => setLogOpen(false)} initialMode={logMode} />
      <AICoachModal open={coachOpen} onClose={() => setCoachOpen(false)} />
      <MilestoneModal milestone={celebrate} onClose={() => setCelebrate(null)} />
      {/* One celebration at a time: the streak waits for the milestone. */}
      <StreakModal
        open={streakOpen && !celebrate}
        onClose={() => setStreakOpen(false)}
        name={profile.name}
        streak={streakCount}
      />
    </div>
  );
}

export default App;
