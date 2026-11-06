import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentCreatedWithAuthContext } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { recipientTarget, maySendNotification, type CircleAudience, type NotificationTarget } from './recipients.js';

initializeApp();
const databaseId = 'ai-studio-0a3c0d30-3145-41b0-ac2f-a8de927afa02';
const db = getFirestore(databaseId);

export const deliverAccountNotification = onDocumentCreatedWithAuthContext({ document: 'notifications/{notificationId}', database: databaseId, region: 'europe-west2', maxInstances: 5, retry: true }, async event => {
  if (Date.now() - Date.parse(event.time) > 24 * 60 * 60 * 1000) return;
  const notification = event.data?.data() as (NotificationTarget & { title?: string; message?: string; isRead?: boolean }) | undefined;
  if (!notification || notification.isRead || typeof notification.title !== 'string' || typeof notification.message !== 'string') return;
  let circle: CircleAudience | undefined;
  if (typeof notification.circleId === 'string' && !notification.circleId.includes('/')) {
    circle = (await db.collection('circles').doc(notification.circleId).get()).data() as CircleAudience | undefined;
  }
  const target = recipientTarget(notification, circle);
  if (!target) return;
  let recipientUid = target.uid;
  let recipientEmail: string | undefined;
  if (!recipientUid && target.email) {
    try { const user = await getAuth().getUserByEmail(target.email); recipientUid = user.uid; recipientEmail = user.email; }
    catch { return; }
  }
  if (!recipientUid || recipientUid.includes('/') || recipientUid.length > 128) return;
  const trustedServer = event.authType === 'system' || event.authType === 'service_account';
  if (!maySendNotification(notification, event.authId, recipientUid, recipientEmail, circle, trustedServer)) {
    logger.warn('Notification sender or audience could not be verified', { notificationId: event.params.notificationId });
    return;
  }
  const devices = await db.collection('users').doc(recipientUid).collection('devices').get();
  const registrations = devices.docs.filter(document => document.get('platform') === 'android' && typeof document.get('token') === 'string');
  for (let offset = 0; offset < registrations.length; offset += 500) {
    const batch = registrations.slice(offset, offset + 500);
    const result = await getMessaging().sendEachForMulticast({
      tokens: batch.map(document => document.get('token')),
      notification: { title: notification.title.slice(0, 150), body: notification.message.slice(0, 500) },
      data: { notificationId: event.params.notificationId, userId: recipientUid, circleId: notification.circleId || '', screen: 'notifications' },
      android: { priority: 'high', ttl: 24 * 60 * 60 * 1000, notification: { channelId: 'haya_updates', icon: 'ic_stat_notification', color: '#714a23', tag: event.params.notificationId, visibility: 'private', defaultSound: true } },
    });
    let retryableFailure = false;
    await Promise.all(result.responses.map((response, index) => {
      const code = response.error?.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') return batch[index].ref.delete();
      if (!response.success) { retryableFailure = true; logger.warn('Push delivery failed', { code }); }
      return Promise.resolve();
    }));
    if (retryableFailure) throw new Error('FCM delivery incomplete; retry requested.');
  }
});
