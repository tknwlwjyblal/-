import type { CapacitorConfig } from '@capacitor/cli';
import { existsSync } from 'node:fs';

const hasAndroidFirebaseConfig = existsSync('android/app/google-services.json');

const config: CapacitorConfig = {
  appId: 'com.hayanajmaha.app',
  appName: 'هيا نجمعها',
  webDir: 'dist',
  android: {
    includePlugins: hasAndroidFirebaseConfig
      ? ['@capacitor/app', '@capacitor-firebase/authentication']
      : ['@capacitor/app'],
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
