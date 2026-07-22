import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store';
import { exportToCsv } from '@/lib/csvExport';
import { isApiKeyConfigured } from '@/lib/gemini';
import { getGuestMeals, getGuestWeights } from '@/lib/guestStorage';
import type { MealEntry, WeightLog } from '@/types';
import { Sun, Moon, Download, Loader2, LogOut, Sparkles } from 'lucide-react';

export function Settings() {
  const { theme, toggleTheme } = useStore();
  const { profile, signOut, isGuest } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      let meals: MealEntry[] = [];
      let weights: WeightLog[] = [];

      if (isGuest) {
        meals = getGuestMeals();
        weights = getGuestWeights();
      } else {
        const [mealsRes, weightsRes] = await Promise.all([
          supabase.from('meals').select('*').order('logged_at', { ascending: false }),
          supabase.from('weight_logs').select('*').order('logged_at', { ascending: false }),
        ]);
        meals = (mealsRes.data as MealEntry[]) || [];
        weights = (weightsRes.data as WeightLog[]) || [];
      }

      exportToCsv(meals, weights, profile?.display_name || 'user');
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto pb-24 md:pb-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Settings</h1>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Appearance
        </h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon size={20} className="text-gray-400" /> : <Sun size={20} className="text-amber-500" />}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Theme</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Currently in {theme === 'dark' ? 'dark' : 'light'} mode
              </p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              theme === 'dark' ? 'bg-primary-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${
                theme === 'dark' ? 'translate-x-7' : ''
              }`}
            />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          AI Configuration
        </h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-primary-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Gemini AI</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                API key is read from environment variables
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              isApiKeyConfigured()
                ? 'text-primary-700 bg-primary-50 dark:text-primary-300 dark:bg-primary-900/30'
                : 'text-gray-500 bg-gray-100 dark:bg-gray-700'
            }`}
          >
            {isApiKeyConfigured() ? 'Configured' : 'Not Set'}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Data Export
        </h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Download size={20} className="text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Export to CSV</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Download your meals, weight history, and macros
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
            <span className="text-white font-bold">M</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">MacroFlow</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Version 1.0.0</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          AI-powered nutrition tracking with Mifflin-St Jeor calorie calculations. Your data is securely stored
          and encrypted in the cloud, tied to your account.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
          Account
        </h2>
        <div className="flex items-center gap-3 mb-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-bold text-gray-500">
              {(profile?.display_name || 'U')[0]}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile?.display_name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {isGuest ? 'Guest mode — data stored locally' : (profile?.email || 'Signed in')}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full py-3 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={16} /> {isGuest ? 'Exit Guest Mode' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
}
