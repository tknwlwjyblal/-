import type { AppNotification } from '../types.ts';

// Never deliver another member's notification through Android's lock screen.
export function isNativeNotificationRecipient(notification: AppNotification, uid: string, email?: string | null, managedCircleIds = new Set<string>()) {
  if (notification.userId) return notification.userId === uid;
  if (notification.userEmail) return notification.userEmail.trim().toLowerCase() === email?.trim().toLowerCase();
  return notification.targetRole === 'organizer' && Boolean(notification.circleId && managedCircleIds.has(notification.circleId));
}
