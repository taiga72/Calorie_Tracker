import { useState } from 'react';
import { useAuth } from '@/auth';
import { Modal } from '@/components/Modal';
import { User, LogOut, Mail, KeyRound, Trash2, AlertTriangle, Loader2, Check } from 'lucide-react';

const INPUT = 'w-full bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 ring-accent-500/30';

type Panel = 'email' | 'password' | null;

/** Settings → Account: email, password, sign out. */
export function AccountSection() {
  const { user, signOut, updateEmail, updatePassword, status } = useAuth();
  const [panel, setPanel] = useState<Panel>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const offline = status !== 'verified';

  const open = (p: Panel) => {
    setPanel((cur) => (cur === p ? null : p));
    setMessage(null);
    setEmail('');
    setPassword('');
    setConfirm('');
  };

  const saveEmail = async () => {
    const next = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(next)) { setMessage({ ok: false, text: 'Enter a valid email address.' }); return; }
    setBusy(true);
    const err = await updateEmail(next);
    setBusy(false);
    setMessage(err
      ? { ok: false, text: err }
      : { ok: true, text: `Check ${next} (and possibly your current inbox) for a confirmation link. Your email changes once it's confirmed.` });
    if (!err) setEmail('');
  };

  const savePassword = async () => {
    if (password.length < 6) { setMessage({ ok: false, text: 'Use at least 6 characters.' }); return; }
    if (password !== confirm) { setMessage({ ok: false, text: "The passwords don't match." }); return; }
    setBusy(true);
    const err = await updatePassword(password);
    setBusy(false);
    setMessage(err ? { ok: false, text: err } : { ok: true, text: 'Password updated.' });
    if (!err) { setPassword(''); setConfirm(''); }
  };

  return (
    <div className="card p-5 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <User size={18} className="text-accent-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Account</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4 truncate">Signed in as {user?.email}</p>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => open('email')} aria-expanded={panel === 'email'} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold ${panel === 'email' ? 'bg-gray-900 dark:bg-accent-600 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
          <Mail size={14} /> Change email
        </button>
        <button onClick={() => open('password')} aria-expanded={panel === 'password'} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold ${panel === 'password' ? 'bg-gray-900 dark:bg-accent-600 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
          <KeyRound size={14} /> Change password
        </button>
      </div>

      {panel && (
        <div className="mt-3 space-y-2">
          {offline && <p className="text-11 text-amber-600">You need to be online for this.</p>}
          {panel === 'email' ? (
            <input type="email" autoComplete="email" aria-label="New email" placeholder="New email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
          ) : (
            <>
              <input type="password" autoComplete="new-password" aria-label="New password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
              <input type="password" autoComplete="new-password" aria-label="Repeat new password" placeholder="Repeat new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT} />
            </>
          )}
          {message && (
            <p className={`text-xs rounded-xl px-3 py-2 ${message.ok ? 'bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300' : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300'}`}>
              {message.text}
            </p>
          )}
          <button
            onClick={panel === 'email' ? saveEmail : savePassword}
            disabled={busy || offline}
            className="w-full flex items-center justify-center gap-1.5 bg-accent-600 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <><Check size={15} /> {panel === 'email' ? 'Send confirmation' : 'Update password'}</>}
          </button>
        </div>
      )}

      <button
        onClick={() => signOut()}
        className="w-full mt-3 flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold py-3 rounded-xl text-sm active:scale-[.99] transition-transform"
      >
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}

/** Danger Zone: delete the account and everything in it, after typing DELETE. */
export function DeleteAccountButton() {
  const { deleteAccount, status } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    const err = await deleteAccount();
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setTyped(''); setError(null); }}
        className="w-full mt-2 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 font-semibold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.99] transition-transform"
      >
        <Trash2 size={16} /> Delete account
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Delete your account?">
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950 rounded-2xl p-3 mb-4">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">
            This permanently deletes your account, meals, photos, weight history and settings. It can't be undone — export a backup first if you might want them.
          </p>
        </div>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Type <strong>DELETE</strong> to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type DELETE to confirm" autoCapitalize="characters" className={`${INPUT} mt-1.5`} />
        </label>
        {status !== 'verified' && <p className="text-11 text-amber-600 mt-2">You need to be online for this.</p>}
        {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={() => setOpen(false)} disabled={busy} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold py-3 rounded-xl text-sm">Cancel</button>
          <button
            onClick={run}
            disabled={typed.trim() !== 'DELETE' || busy || status !== 'verified'}
            className="flex-1 bg-red-500 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : 'Delete forever'}
          </button>
        </div>
      </Modal>
    </>
  );
}
