import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface UpdateInfo {
  available: boolean;
  versionCode: number;
  versionName: string;
  sizeBytes: number;
  notes: string;
}
export interface UpdateProgress { bytes: number; total: number; }
interface AppUpdaterPlugin {
  checkForUpdate(): Promise<UpdateInfo>;
  downloadUpdate(options: { versionCode: number }): Promise<void>;
  installUpdate(): Promise<{ status: 'permission_required' | 'installer_opened' }>;
  openInstallSettings(): Promise<void>;
  addListener(event: 'downloadProgress', callback: (progress: UpdateProgress) => void): Promise<PluginListenerHandle>;
}
export const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');
export const supportsAppUpdates = () => Capacitor.getPlatform() === 'android';
export function requestUpdateCheck() { window.dispatchEvent(new Event('check-for-app-update')); }
