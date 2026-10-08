import { useState, type FormEvent } from 'react';
import { useAuth } from '@/auth';
import { Flame, Loader2, Mail, Lock, AlertCircle } from 'lucide-react';

type Mode = 'signin' | 'signup' | 'reset';

export function AuthScreen() {
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === 'reset') {
      if (!email.trim()) { setError('Enter your email.'); return; }
      setLoading(true);
      try {
        const err = await sendPasswordReset(email.trim());
        if (err) setError(err);
        else setInfo('If there is an account for that email, a reset link is on its way. Open it on this device to choose a new password.');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const err = mode === 'signin'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
      if (err) {
        setError(err);
      } else if (mode === 'signup') {
        setInfo('Account created. Check your email to confirm, or sign in if confirmation is disabled.');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next?: Mode) => {
    setMode((m) => next ?? (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
    setInfo(null);
  };

  return (
    <div className="min-h-screen bg-[#F4F5F6] dark:bg-[#0B0D10] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent-600 flex items-center justify-center mb-4 shadow-lg shadow-accent-600/20">
            <Flame size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calorie Tracker</h1>
          <p className="text-sm text-gray-400 mt-1">
            {mode === 'signin' ? 'Sign in to sync your data' : mode === 'signup' ? 'Create an account to get started' : "We'll email you a link to set a new password"}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-50 dark:border-gray-800">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-xs rounded-xl p-3 mb-4">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300 text-xs rounded-xl p-3 mb-4">{info}</div>
          )}
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-3">
              <Mail size={16} className="text-gray-400 flex-shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none"
              />
            </div>
            {mode !== 'reset' && (
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-3">
              <Lock size={16} className="text-gray-400 flex-shrink-0" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none"
              />
            </div>
            )}
            {mode === 'signin' && (
              <button type="button" onClick={() => switchMode('reset')} className="block ml-auto text-11 font-semibold text-gray-400 hover:text-accent-600">
                Forgot password?
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-600 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[.99] transition-transform"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </button>
          </form>
          <button
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            className="w-full text-center text-xs font-semibold text-accent-600 mt-4"
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : mode === 'signup' ? 'Already have an account? Sign in' : 'Back to sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
