import { Capacitor } from '@capacitor/core';

/**
 * True inside the iPhone app (Capacitor), false in a browser. Native-only
 * features (Apple Health, scheduled notifications, native haptics and voice
 * input) check this; everything else is the same web app.
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Status bar text to match the theme (dark text on light, light on dark). */
export function setNativeStatusBar(dark: boolean): void {
  if (!isNative()) return;
  void import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }))
    .catch(() => {});
}
