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

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
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
