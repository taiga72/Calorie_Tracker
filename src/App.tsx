import { useState, useEffect, lazy, Suspense } from 'react';
import { StoreProvider, useStore } from '@/store';
import { AuthProvider, useAuth } from '@/auth';
import { AuthScreen } from '@/components/AuthScreen';
import { SetPasswordScreen } from '@/components/SetPasswordScreen';
import { SupabaseSetupScreen } from '@/components/SupabaseSetupScreen';
import { UndoToastProvider } from '@/components/UndoToastProvider';
import { ThemeProvider } from '@/lib/theme';
import { SplashProvider, SplashReady, ScreenSkeleton } from '@/components/SplashScreen';
import { useSplashReady } from '@/lib/splash';
import { ReminderBanner } from '@/components/Reminders';
import { useReminders } from '@/lib/useReminders';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { BottomNav } from '@/components/BottomNav';
import { FAB } from '@/components/FAB';
import { LogModal } from '@/modals/LogModal';
import { OPEN_COACH_EVENT } from '@/lib/coachLauncher';
import { StreakModal } from '@/modals/StreakModal';
import { HomeTab } from '@/tabs/HomeTab';
import { calculateStreak, shouldShowStreakPopup } from '@/lib/streakUtils';
import { newlyAchieved } from '@/lib/milestones';
import { todayKey } from '@/lib/dateUtils';
import { MilestoneModal } from '@/components/Milestones';
import { AppearanceSync } from '@/components/AppearanceSync';
import { WelcomeSheet } from '@/components/WelcomeSheet';
import { Loader2, AlertTriangle, X, CloudOff, RefreshCw } from 'lucide-react';
import type { Milestone, TabKey } from '@/types';

// Home is in the first download; the other tabs and the bigger sheets load
// on their own (and are fetched in the background once Home is up, so
// switching tabs stays instant and works offline).
const loadStats = () => import('@/tabs/StatsTab');
const loadCalendar = () => import('@/tabs/CalendarTab');
const loadSettings = () => import('@/tabs/SettingsTab');
const loadCoach = () => import('@/components/AICoachModal');
const loadWizard = () => import('@/modals/SetupWizardModal');
const StatsTab = lazy(() => loadStats().then((m) => ({ default: m.StatsTab })));
const CalendarTab = lazy(() => loadCalendar().then((m) => ({ default: m.CalendarTab })));
const SettingsTab = lazy(() => loadSettings().then((m) => ({ default: m.SettingsTab })));
const AICoachModal = lazy(() => loadCoach().then((m) => ({ default: m.AICoachModal })));
const SetupWizardModal = lazy(() => loadWizard().then((m) => ({ default: m.SetupWizardModal })));

function prefetchScreens() {
  for (const load of [loadStats, loadCalendar, loadSettings, loadCoach, loadWizard]) void load().catch(() => {});
}

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
  const { user, loading, recovering } = useAuth();
  // The splash covers the auth check; once signed in, AppInner keeps it up
  // until the data has loaded.
  useSplashReady(!loading && !user);

  if (loading) return null;

  if (!user) {
    return <AuthScreen />;
  }

  // Opened from a password-reset email: set the new password first.
  if (recovering) {
    return <SetPasswordScreen />;
  }

  return (
    <StoreProvider>
      <UndoToastProvider>
        <AppInner />
      </UndoToastProvider>
    </StoreProvider>
  );
}

const COACH_HINT_KEY = 'cc_coach_hint_seen';
function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}
function writeFlag(key: string): void {
  try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
}

function AppInner() {
  const [tab, setTab] = useState<TabKey>('home');
  const [logOpen, setLogOpen] = useState(false);
  const [logMode, setLogMode] = useState<'food' | 'weight'>('food');
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachQuestion, setCoachQuestion] = useState<string | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      setCoachQuestion((e as CustomEvent<string | undefined>).detail ?? null);
      setCoachOpen(true);
    };
    window.addEventListener(OPEN_COACH_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_COACH_EVENT, onOpen);
  }, []);
  const [streakOpen, setStreakOpen] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const { meals, weights, settings, updatePrefs, profile, loading, syncError, dismissSyncError, refresh, refreshing, online, pendingCount } = useStore();
  const [celebrate, setCelebrate] = useState<Milestone | null>(null);
  // A one-time hint that ✨ is the AI coach.
  const [coachHint, setCoachHint] = useState(() => !readFlag(COACH_HINT_KEY));
  const dismissCoachHint = () => { setCoachHint(false); writeFlag(COACH_HINT_KEY); };
  // First run (no goal set and nothing logged yet): a short welcome. It
  // stays dismissed once closed.
  const userId = useAuth().user?.id ?? '';
  const welcomeKey = `cc_welcome_done:${userId}`;
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  useEffect(() => {
    if (loading || !userId) return;
    if (!readFlag(welcomeKey) && !settings.calc && meals.length === 0) setWelcomeOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userId]);
  const closeWelcome = () => { setWelcomeOpen(false); writeFlag(welcomeKey); };
  useSplashReady(!loading);
  // Once Home is showing, fetch the other screens quietly in the background.
  useEffect(() => {
    if (loading) return;
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(prefetchScreens); else setTimeout(prefetchScreens, 1500);
  }, [loading]);
  // The coach and the goal setup are only mounted once first opened.
  const [coachMounted, setCoachMounted] = useState(false);
  const [wizardMounted, setWizardMounted] = useState(false);
  useEffect(() => { if (coachOpen) setCoachMounted(true); }, [coachOpen]);
  useEffect(() => { if (wizardOpen) setWizardMounted(true); }, [wizardOpen]);
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
      {/* Room at the bottom so the last card can scroll clear of the floating buttons. */}
      <main className="pb-48">
        {tab === 'home' && <HomeTab />}
        <Suspense fallback={<ScreenSkeleton />}>
          {tab === 'stats' && <StatsTab />}
          {tab === 'calendar' && <CalendarTab />}
          {tab === 'settings' && <SettingsTab />}
        </Suspense>
      </main>

      <FAB
        onClick={() => openLog('food')}
        onCoachClick={() => { dismissCoachHint(); setCoachOpen(true); }}
        coachHint={coachHint && !welcomeOpen && tab === 'home'}
        onHintDismiss={() => { dismissCoachHint(); setCoachOpen(true); }}
      />
      <BottomNav active={tab} onChange={(t) => { if (coachHint && t !== tab) dismissCoachHint(); setTab(t); }} />
      <LogModal open={logOpen} onClose={() => setLogOpen(false)} initialMode={logMode} />
      {coachMounted && (
        <Suspense fallback={null}>
          <AICoachModal open={coachOpen} onClose={() => { setCoachOpen(false); setCoachQuestion(null); }} question={coachQuestion} />
        </Suspense>
      )}
      <AppearanceSync />
      <WelcomeSheet
        open={welcomeOpen && !wizardOpen && !logOpen}
        onClose={closeWelcome}
        name={profile.name.trim()}
        goalSet={!!settings.calc}
        mealLogged={meals.length > 0}
        onSetGoal={() => setWizardOpen(true)}
        onLogMeal={() => openLog('food')}
      />
      {wizardMounted && (
        <Suspense fallback={null}>
          <SetupWizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} />
        </Suspense>
      )}
      <MilestoneModal milestone={celebrate} onClose={() => setCelebrate(null)} />
      {/* One celebration at a time: the streak waits for the milestone. */}
      <StreakModal
        open={streakOpen && !celebrate && !welcomeOpen}
        onClose={() => setStreakOpen(false)}
        name={profile.name}
        streak={streakCount}
      />
    </div>
  );
}

export default App;
