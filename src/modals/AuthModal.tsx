import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { getSupabase } from '@/lib/supabase';
import { Loader2, Mail, Lock, User, Cloud, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail('');
    setPassword('');
    setError(null);
    setLoading(false);
    setOauthLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      setError('Cloud sync is not configured for this app.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      handleClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setError('Cloud sync is not configured for this app.');
      return;
    }
    setError(null);
    setOauthLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (err) throw err;
      // browser redirects; no need to close here
    } catch (err) {
      setOauthLoading(false);
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Cloud Account">
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <Cloud size={16} className="text-emerald-600" />
            <p className="text-xs font-bold text-emerald-700">Back up your progress</p>
          </div>
          <p className="text-xs text-emerald-700/80 leading-relaxed">
            Sign in to sync your meals, weight history, and goals across devices. Your existing
            local data moves to your account automatically.
          </p>
        </div>

        {/* Google OAuth */}
        <button
          onClick={onGoogle}
          disabled={oauthLoading || loading}
          className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 flex items-center justify-center gap-2.5 font-semibold text-sm text-gray-700 active:scale-[.99] transition-transform disabled:opacity-50"
        >
          {oauthLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email / password */}
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2.5">
            <Mail size={16} className="text-gray-400 flex-shrink-0" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none ml-2.5"
            />
          </div>
          <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2.5">
            <Lock size={16} className="text-gray-400 flex-shrink-0" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none ml-2.5"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {mode === 'signin' ? <><User size={16} /> Sign in</> : <><ArrowRight size={16} /> Create account</>}
              </>
            )}
          </button>
        </form>

        <button
          onClick={() => { setMode((m) => (m === 'signin' ? 'signup' : 'signin')); setError(null); }}
          className="w-full text-center text-xs font-semibold text-emerald-600"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>

        {/* Skip / continue as guest */}
        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={handleClose}
            className="w-full text-center text-xs font-semibold text-gray-400 py-2"
          >
            Skip for now — Continue as Guest
          </button>
        </div>
      </div>
    </Modal>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
