import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { AppNotification } from '../types';

const channelId = 'haya_updates';
export const isAndroidApp = () => Capacitor.getPlatform() === 'android';
const preferenceKey = (uid: string) => `haya:phone-notifications:${uid}`;
let registration: { uid: string; documentId: string } | undefined;
const pending = new Set<string>();

function enabled(uid: string) { return localStorage.getItem(preferenceKey(uid)) === 'enabled'; }
function announce() { window.dispatchEvent(new Event('phone-notifications-changed')); }

export async function notificationStatus() {
  if (!isAndroidApp()) return { available: false, granted: false, enabled: false };
  const permission = await LocalNotifications.checkPermissions();
  return { available: true, granted: permission.display === 'granted', enabled: Boolean(auth.currentUser && enabled(auth.currentUser.uid)) };
}

async function createChannel() {
  await LocalNotifications.createChannel({ id: channelId, name: 'تنبيهات هيا نجمعها', description: 'إشعارات الجمعيات واعتماد الإيصالات والأدوار', importance: 4, visibility: 0, vibration: true });
}

export async function enablePhoneNotifications() {
  if (!isAndroidApp() || !auth.currentUser) throw new Error('افتح هذه الميزة من تطبيق Android بعد تسجيل الدخول.');
  const result = await LocalNotifications.requestPermissions();
  if (result.display !== 'granted') throw new Error('لم يُسمح بالإشعارات. يمكنك السماح بها من إعدادات الهاتف ← التطبيقات ← هيا نجمعها ← الإشعارات.');
  await createChannel();
  localStorage.setItem(preferenceKey(auth.currentUser.uid), 'enabled');
  window.dispatchEvent(new Event('phone-notification-preference-changed'));
  announce();
}

export async function unregisterDevice() {
  if (!isAndroidApp()) return;
  const previousRegistration = registration;
  registration = undefined;
  const operations: Promise<unknown>[] = [];
  if (previousRegistration && auth.currentUser?.uid === previousRegistration.uid) {
    operations.push(deleteDoc(doc(db, 'users', previousRegistration.uid, 'devices', previousRegistration.documentId)));
  }
  if (__ANDROID_GOOGLE_AUTH_CONFIGURED__) {
    operations.push(PushNotifications.unregister(), PushNotifications.removeAllDeliveredNotifications());
  }
  operations.push(LocalNotifications.removeAllDeliveredNotifications(), LocalNotifications.getPending().then(async scheduled => {
    if (scheduled.notifications.length) await LocalNotifications.cancel({ notifications: scheduled.notifications });
  }));
  // Network-dependent deregistration must not trap the user on the logout screen.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled(operations),
    new Promise<void>(resolve => { timeout = setTimeout(resolve, 3000); }),
  ]);
  if (timeout) clearTimeout(timeout);
}

export async function disablePhoneNotifications() {
  if (auth.currentUser) localStorage.setItem(preferenceKey(auth.currentUser.uid), 'disabled');
  await unregisterDevice();
  window.dispatchEvent(new Event('phone-notification-preference-changed'));
  announce();
}

export async function testPhoneNotification() {
  const status = await notificationStatus();
  if (!status.granted || !status.enabled) throw new Error('فعّل إشعارات الهاتف أولاً.');
  await createChannel();
  await LocalNotifications.schedule({ notifications: [{ id: 2147483000, title: 'هيا نجمعها', body: 'تم تفعيل إشعارات الهاتف بنجاح.', channelId, smallIcon: 'ic_stat_notification', extra: { screen: 'notifications' } }] });
}

export function nativeNotificationId(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) % 2000000000 + 1;
}

export async function showAccountNotification(notification: Pick<AppNotification, 'id' | 'title' | 'message' | 'isRead' | 'circleId'>) {
  const uid = auth.currentUser?.uid;
  if (!isAndroidApp() || !uid || !enabled(uid) || notification.isRead) return;
  const key = `haya:delivered:${uid}`;
  const seen: string[] = JSON.parse(localStorage.getItem(key) || '[]');
  const pendingKey = `${uid}:${notification.id}`;
  if (seen.includes(notification.id) || pending.has(pendingKey)) return;
  pending.add(pendingKey);
  try {
    if (!(await App.getState()).isActive) return; // FCM handles the background tray.
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
    if (auth.currentUser?.uid !== uid || !enabled(uid)) return;
    await createChannel();
    await LocalNotifications.schedule({ notifications: [{ id: nativeNotificationId(notification.id), title: notification.title, body: notification.message, channelId, smallIcon: 'ic_stat_notification', extra: { screen: 'notifications', notificationId: notification.id, circleId: notification.circleId } }] });
    const latest: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...latest, notification.id].slice(-200)));
  } finally { pending.delete(pendingKey); }
}

export async function startDeviceNotifications(uid: string, onOpen: () => void): Promise<() => Promise<void>> {
  if (!isAndroidApp()) return async () => {};
  const handles: PluginListenerHandle[] = [];
  try {
    handles.push(await LocalNotifications.addListener('localNotificationActionPerformed', () => { if (auth.currentUser?.uid === uid) onOpen(); }));
    if (enabled(uid) && (await LocalNotifications.checkPermissions()).display === 'granted') {
      await createChannel();
      if (__ANDROID_GOOGLE_AUTH_CONFIGURED__) {
        handles.push(await PushNotifications.addListener('registration', async ({ value }) => {
          if (auth.currentUser?.uid !== uid || !enabled(uid)) return;
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
          const documentId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
          try {
            await setDoc(doc(db, 'users', uid, 'devices', documentId), { token: value, platform: 'android', updatedAt: serverTimestamp() });
            if (auth.currentUser?.uid !== uid || !enabled(uid)) {
              await deleteDoc(doc(db, 'users', uid, 'devices', documentId)).catch(() => {});
              return;
            }
            registration = { uid, documentId };
            localStorage.removeItem('haya:push-error');
          } catch { localStorage.setItem('haya:push-error', 'تعذر تسجيل الهاتف لخدمة التنبيهات. حاول مجددًا بعد الاتصال بالإنترنت.'); }
          announce();
        }));
        handles.push(await PushNotifications.addListener('registrationError', () => { localStorage.setItem('haya:push-error', 'تعذر الاتصال بخدمة إشعارات Google. تأكد من اتصالك وخدمات Google Play.'); announce(); }));
        handles.push(await PushNotifications.addListener('pushNotificationReceived', notification => {
          if (auth.currentUser?.uid !== uid || notification.data?.userId !== uid) return;
          void showAccountNotification({ id: notification.data.notificationId || notification.id, title: notification.title || 'هيا نجمعها', message: notification.body || 'لديك إشعار جديد', isRead: false, circleId: notification.data.circleId }).catch(() => {});
        }));
        handles.push(await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => { if (auth.currentUser?.uid === uid && notification.data?.userId === uid) onOpen(); }));
        await PushNotifications.register().catch(() => { localStorage.setItem('haya:push-error', 'تعذر تسجيل الهاتف لاستقبال التنبيهات. حاول مجددًا.'); announce(); });
      }
    }
    return async () => { await Promise.all(handles.map(handle => handle.remove())); };
  } catch (error) {
    await Promise.all(handles.map(handle => handle.remove().catch(() => {})));
    throw error;
  }
}
