import { useState, type FormEvent } from 'react';
import { useAuth } from '@/auth';
import { KeyRound, Loader2, Lock, AlertCircle } from 'lucide-react';

/** Shown after opening a password-reset link: choose the new password. */
export function SetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Use at least 6 characters.'); return; }
    if (password !== confirm) { setError("The passwords don't match."); return; }
    setLoading(true);
    try {
      const err = await updatePassword(password);
      if (err) setError(err);
    } finally {
      setLoading(false);
    }
  };

  const field = 'flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-3';
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent-600 flex items-center justify-center mb-4">
            <KeyRound size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Choose a new password</h1>
        </div>
        <form onSubmit={onSubmit} className="card p-6 space-y-3">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-xs rounded-xl p-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> <span>{error}</span>
            </div>
          )}
          <div className={field}>
            <Lock size={16} className="text-gray-400" />
            <input type="password" autoComplete="new-password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none" />
          </div>
          <div className={field}>
            <Lock size={16} className="text-gray-400" />
            <input type="password" autoComplete="new-password" placeholder="Repeat new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-accent-600 text-white font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Save new password'}
          </button>
        </form>
      </div>
    </div>
  );
}
