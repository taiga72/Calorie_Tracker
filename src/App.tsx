import { useState } from 'react'
import { Home, Calendar, BarChart3, LogOut } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import AuthScreen from './components/AuthScreen'
import Onboarding from './components/Onboarding'
import HomeTab from './tabs/HomeTab'
import CalendarTab from './tabs/CalendarTab'
import StatisticsTab from './tabs/StatisticsTab'

type Tab = 'home' | 'calendar' | 'stats'

export default function App() {
  const { user, profile, loading, profileLoading, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('home')

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  if (!profile?.setup_complete && !profileLoading) {
    return <Onboarding />
  }

  if (profileLoading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
  ]

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 0-4 4c0 1.5.5 2.5 1 3.5L9 12h6l0-2.5c.5-1 1-2 1-3.5a4 4 0 0 0-4-4z" />
                <path d="M9 12h6M9 16h6M9 20h6" />
              </svg>
            </div>
            <span className="text-sm font-bold text-neutral-900">NutriTrack</span>
          </div>
          <button onClick={signOut} className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Tab content */}
      <main>
        {tab === 'home' && <HomeTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'stats' && <StatisticsTab />}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-neutral-100 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-lg items-center justify-around px-4 py-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-1 flex-col items-center gap-1 py-1.5 transition-colors ${tab === id ? 'text-primary-600' : 'text-neutral-400'}`}
            >
              <Icon className="h-5 w-5" strokeWidth={tab === id ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
