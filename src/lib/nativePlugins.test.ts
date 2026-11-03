import { describe, expect, it, vi } from 'vitest';

// Capacitor plugin objects answer every property with a native method, "then"
// included, so awaiting one never settles. This fake behaves the same way.
const capacitorLike = (methods: Record<string, unknown>) =>
  new Proxy({}, { get: (_, prop) => (prop in methods ? methods[prop as string] : () => new Promise(() => {})) });

vi.mock('@/lib/native', () => ({ isNative: () => true, setNativeStatusBar: () => {} }));
vi.mock('@capgo/capacitor-health', () => ({
  Health: capacitorLike({
    isAvailable: async () => ({ available: true }),
    requestAuthorization: async () => ({}),
  }),
}));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: capacitorLike({
    checkPermissions: async () => ({ display: 'granted' }),
    requestPermissions: async () => ({ display: 'granted' }),
  }),
}));

describe('native plugins load without hanging', () => {
  it('connects Apple Health', async () => {
    const { connectHealth, healthAvailable } = await import('@/lib/health');
    await expect(healthAvailable()).resolves.toBe(true);
    await expect(connectHealth()).resolves.toBe(true);
  });

  it('asks for notification permission', async () => {
    const reminders = await import('@/lib/reminders');
    await expect(reminders.refreshNotificationPermission()).resolves.toBe('granted');
  });
});
