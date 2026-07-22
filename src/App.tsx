import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Navigation } from '@/components/Navigation';
import { SignInPage } from '@/pages/SignInPage';
import { SetupWizard } from '@/pages/SetupWizard';
import { Dashboard } from '@/pages/Dashboard';
import { Statistics } from '@/pages/Statistics';
import { Profile } from '@/pages/Profile';
import { Settings } from '@/pages/Settings';

type Tab = 'dashboard' | 'stats' | 'profile' | 'settings';

function AppContent() {
  const { profile, loading, authMode } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-[3px] border-gray-200 dark:border-gray-700 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (authMode === 'none') {
    return <SignInPage />;
  }

  if (profile && !profile.setup_complete) {
    return <SetupWizard />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation activeTab={tab} onTabChange={setTab} />
      <main className="md:ml-64">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'stats' && <Statistics />}
        {tab === 'profile' && <Profile />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
