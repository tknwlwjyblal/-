import type { CapacitorConfig } from '@capacitor/cli';
import { existsSync } from 'node:fs';

const hasAndroidFirebaseConfig = existsSync('android/app/google-services.json');

const config: CapacitorConfig = {
  appId: 'com.hayanajmaha.app',
  appName: 'هيا نجمعها',
  webDir: 'dist',
  android: {
    includePlugins: hasAndroidFirebaseConfig
      ? ['@capacitor/app', '@capacitor/local-notifications', '@capacitor/push-notifications', '@capacitor-firebase/authentication']
      : ['@capacitor/app', '@capacitor/local-notifications'],
  },
  plugins: {
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'DARK' },
    LocalNotifications: { smallIcon: 'ic_stat_notification', iconColor: '#714a23' },
    PushNotifications: { presentationOptions: [] },
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
