import type { CapacitorConfig } from '@capacitor/cli';

// The iPhone app: the same web app (built into dist/) inside a native shell,
// plus Apple Health, notifications, haptics and voice input. See docs/IOS.md.
const config: CapacitorConfig = {
  appId: 'com.taiga72.calorietracker',
  appName: 'Tally',
  webDir: 'dist',
  ios: {
    // The page draws its own safe-area padding (viewport-fit=cover).
    contentInset: 'never',
    backgroundColor: '#F4F5F6',
  },
  plugins: {
    SplashScreen: {
      // The page shows its own skeleton right away; the native splash only
      // covers the moment before the web view paints.
      launchShowDuration: 300,
      launchAutoHide: true,
      backgroundColor: '#F4F5F6',
      showSpinner: false,
    },
    LocalNotifications: {
      iconColor: '#059669',
    },
  },
};

export default config;
