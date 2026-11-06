export interface NotificationTarget {
  userId?: string;
  userEmail?: string;
  senderId?: string;
  targetRole?: string;
  circleId?: string;
}
export interface CircleAudience {
  creatorId?: string;
  creatorEmail?: string;
  organizer?: { creatorId?: string };
  members?: { id: string; email?: string }[];
}
export function recipientTarget(notification: NotificationTarget, circle?: CircleAudience) {
  if (notification.userId) return typeof notification.userId === 'string' ? { uid: notification.userId } : undefined;
  if (notification.userEmail) return typeof notification.userEmail === 'string' ? { email: notification.userEmail.trim().toLowerCase() } : undefined;
  const owner = circle?.creatorId || circle?.organizer?.creatorId;
  if (notification.targetRole === 'organizer' && owner) return { uid: owner };
  return undefined; // Never broadcast an ambiguous financial notification.
}
export function maySendNotification(notification: NotificationTarget, senderUid: string | undefined, recipientUid: string, recipientEmail: string | undefined, circle?: CircleAudience, trustedServer = false) {
  if (!recipientUid || recipientUid === 'guest') return false;
  if (trustedServer) return true;
  if (!senderUid || (notification.senderId && notification.senderId !== senderUid)) return false;
  if (recipientUid === senderUid) return true;
  if (!circle) return false;
  const owner = circle.creatorId || circle.organizer?.creatorId;
  const senderBelongs = senderUid === owner || circle.members?.some(member => member.id === senderUid);
  const recipientBelongs = recipientUid === owner || circle.members?.some(member => member.id === recipientUid || Boolean(recipientEmail && member.email?.trim().toLowerCase() === recipientEmail.trim().toLowerCase()));
  return Boolean(senderBelongs && recipientBelongs);
}
