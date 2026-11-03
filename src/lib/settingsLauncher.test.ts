import { describe, it, expect, vi } from 'vitest';
import { OPEN_SETTINGS_EVENT, openSettings } from '@/lib/settingsLauncher';

describe('openSettings', () => {
  it('asks the app to show Settings at a section', () => {
    const onOpen = vi.fn();
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpen);
    openSettings('goalPlan');
    window.removeEventListener(OPEN_SETTINGS_EVENT, onOpen);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect((onOpen.mock.calls[0][0] as CustomEvent).detail).toBe('goalPlan');
  });
});
