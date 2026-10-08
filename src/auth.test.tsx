import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthRetryableFetchError } from '@supabase/supabase-js';

type Listener = (event: string, session: unknown) => void;
let listener: Listener = () => {};
const getSession = vi.fn();
type Call = (...args: unknown[]) => Promise<{ error: unknown }>;
const resetPasswordForEmail = vi.fn<Call>(async () => ({ error: null }));
const updateUser = vi.fn<Call>(async () => ({ error: null }));
const rpc = vi.fn<Call>(async () => ({ error: null }));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: (cb: Listener) => {
        listener = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: vi.fn(async () => {}),
      resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
    },
    rpc: (...a: unknown[]) => rpc(...a),
  },
}));
vi.mock('@/lib/photoStorage', () => ({ deleteAllPhotos: vi.fn(async () => true) }));

const { AuthProvider, useAuth } = await import('@/auth');

const session = { user: { id: 'u1', email: 'me@example.com' } };

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider> });
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

beforeEach(() => {
  localStorage.clear();
  setOnline(true);
  getSession.mockReset();
});

describe('AuthProvider offline launch', () => {
  it('opens as the last signed-in user when the session cannot be refreshed offline', async () => {
    getSession.mockResolvedValueOnce({ data: { session }, error: null });
    const first = renderAuth();
    await waitFor(() => expect(first.result.current.user?.id).toBe('u1'));
    first.unmount();

    setOnline(false);
    getSession.mockResolvedValueOnce({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) });
    const second = renderAuth();

    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.user?.id).toBe('u1');
  });

  it('shows the sign-in screen when online and there is no session', async () => {
    getSession.mockResolvedValueOnce({ data: { session }, error: null });
    renderAuth().unmount();

    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const { result } = renderAuth();

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(result.current.loading).toBe(false);
  });

  it('forgets the user on sign-out', async () => {
    getSession.mockResolvedValueOnce({ data: { session }, error: null });
    const first = renderAuth();
    await waitFor(() => expect(first.result.current.user).not.toBeNull());
    act(() => { listener('SIGNED_OUT', null); });
    expect(first.result.current.user).toBeNull();
    first.unmount();

    setOnline(false);
    getSession.mockResolvedValueOnce({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) });
    const second = renderAuth();
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.user).toBeNull();
  });
});

/** A previous launch on this device where the user was signed in. */
async function previouslySignedIn() {
  getSession.mockResolvedValueOnce({ data: { session }, error: null });
  const r = renderAuth();
  await waitFor(() => expect(r.result.current.status).toBe('verified'));
  r.unmount();
}

describe('AuthProvider fast start', () => {
  it('opens right away as the last user while the session is still being checked', async () => {
    await previouslySignedIn();

    let resolve!: (v: unknown) => void;
    getSession.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const { result } = renderAuth();

    // No waiting on a (possibly slow) token refresh…
    expect(result.current.loading).toBe(false);
    expect(result.current.user?.id).toBe('u1');
    // …but not trusted for syncing yet.
    expect(result.current.status).toBe('pending');

    await act(async () => { resolve({ data: { session }, error: null }); });
    expect(result.current.status).toBe('verified');
  });

  it('waits for the check on a device nobody has signed in on', () => {
    getSession.mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderAuth();
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('marks an offline launch as offline rather than verified', async () => {
    await previouslySignedIn();

    setOnline(false);
    getSession.mockResolvedValueOnce({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.status).toBe('offline'));
    expect(result.current.user?.id).toBe('u1');
  });
});

describe('AuthProvider account actions', () => {
  it('emails a reset link that comes back to the app', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(await result.current.sendPasswordReset('me@example.com')).toBeNull();
    expect(resetPasswordForEmail).toHaveBeenCalledWith('me@example.com', { redirectTo: window.location.origin });
  });

  it('asks for a new password after a reset link, until it is saved', async () => {
    getSession.mockResolvedValueOnce({ data: { session }, error: null });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.id).toBe('u1'));
    act(() => listener('PASSWORD_RECOVERY', session));
    expect(result.current.recovering).toBe(true);
    await act(async () => { await result.current.updatePassword('new-secret'); });
    expect(updateUser).toHaveBeenCalledWith({ password: 'new-secret' });
    expect(result.current.recovering).toBe(false);
  });

  it('explains when account deletion has not been set up in Supabase', async () => {
    getSession.mockResolvedValueOnce({ data: { session }, error: null });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.id).toBe('u1'));
    rpc.mockResolvedValueOnce({ error: { code: 'PGRST202', message: 'not found' } });
    expect(await result.current.deleteAccount()).toMatch(/re-run supabase\/schema\.sql/);
  });

  it('deletes the account and clears its data on this device', async () => {
    getSession.mockResolvedValueOnce({ data: { session }, error: null });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.id).toBe('u1'));
    localStorage.setItem('calorie_tracker_snapshot_u1', '{}');
    let err: string | null = 'x';
    await act(async () => { err = await result.current.deleteAccount(); });
    expect(err).toBeNull();
    expect(rpc).toHaveBeenCalledWith('delete_my_account');
    expect(localStorage.getItem('calorie_tracker_snapshot_u1')).toBeNull();
  });
});
