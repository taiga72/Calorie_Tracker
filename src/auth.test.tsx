import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthRetryableFetchError } from '@supabase/supabase-js';

type Listener = (event: string, session: unknown) => void;
let listener: Listener = () => {};
const getSession = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      onAuthStateChange: (cb: Listener) => {
        listener = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: vi.fn(async () => {}),
    },
  },
}));

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
