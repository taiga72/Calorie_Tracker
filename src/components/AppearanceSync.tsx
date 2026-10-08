import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { useTheme, type ThemePreference } from '@/lib/theme';
import { parseAppearance, type Appearance } from '@/lib/appearance';

type Synced = Omit<Appearance, 'syncAcrossDevices'> & { theme: ThemePreference };

function synced(a: Appearance, theme: ThemePreference): Synced {
  const { syncAcrossDevices, ...rest } = a;
  return { ...rest, theme };
}

function fromRemote(raw: Record<string, unknown>): Synced {
  const theme = raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : 'system';
  return synced(parseAppearance(raw), theme);
}

/**
 * Keeps the look the same on every device: a change here is saved to the
 * account (settings.prefs.appearance), and one made elsewhere is applied
 * here when it syncs in. The first time, what's already saved wins.
 * Switched off per device with "Same look on all my devices".
 */
export function AppearanceSync() {
  const { settings, updatePrefs, loading } = useStore();
  const { appearance, setAppearance, preference, setPreference } = useTheme();
  const enabled = appearance.syncAcrossDevices;
  const local = synced(appearance, preference);
  const localKey = JSON.stringify(local);
  const remoteRaw = settings.prefs?.appearance;
  const remoteKey = remoteRaw ? JSON.stringify(fromRemote(remoteRaw)) : null;
  const lastRemote = useRef<string | null | undefined>(undefined);
  const lastLocal = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (loading || !enabled) {
      lastRemote.current = undefined;
      lastLocal.current = undefined;
      return;
    }
    if (remoteKey !== lastRemote.current) {
      lastRemote.current = remoteKey;
      if (remoteKey && remoteRaw && remoteKey !== localKey) {
        const { theme, ...rest } = fromRemote(remoteRaw);
        setAppearance(rest);
        setPreference(theme);
        lastLocal.current = remoteKey;
        return;
      }
    }
    if (localKey !== lastLocal.current) {
      lastLocal.current = localKey;
      if (localKey !== remoteKey) {
        lastRemote.current = localKey;
        updatePrefs({ appearance: local });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, enabled, remoteKey, localKey]);

  return null;
}
