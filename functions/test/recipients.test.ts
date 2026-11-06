import test from 'node:test';
import assert from 'node:assert/strict';
import { maySendNotification, recipientTarget } from '../src/recipients.ts';
const circle = { creatorId: 'organizer', members: [{ id: 'alice' }, { id: 'bob', email: 'bob@example.com' }] };
test('explicit UID takes precedence over conflicting email', () => assert.deepEqual(recipientTarget({ userId: 'alice', userEmail: 'bob@example.com' }), { uid: 'alice' }));
test('ambiguous member notifications never broadcast', () => assert.equal(recipientTarget({ targetRole: 'member' }, circle), undefined));
test('organizer role resolves only to the circle owner', () => assert.deepEqual(recipientTarget({ targetRole: 'organizer' }, circle), { uid: 'organizer' }));
test('unverified and spoofed senders cannot send push messages', () => {
 assert.equal(maySendNotification({}, undefined, 'alice', undefined, circle), false);
 assert.equal(maySendNotification({ senderId: 'organizer' }, 'bob', 'alice', undefined, circle), false);
});
test('outsiders cannot notify circle members and recipients outside the circle are rejected', () => {
 assert.equal(maySendNotification({}, 'outsider', 'alice', undefined, circle), false);
 assert.equal(maySendNotification({}, 'organizer', 'outsider', undefined, circle), false);
});
test('members can notify the organizer and the organizer can notify a member', () => {
 assert.equal(maySendNotification({}, 'alice', 'organizer', undefined, circle), true);
 assert.equal(maySendNotification({}, 'organizer', 'bob', undefined, circle), true);
});
test('direct self notifications are allowed; guest recipients are not', () => {
 assert.equal(maySendNotification({}, 'alice', 'alice', undefined), true);
 assert.equal(maySendNotification({}, 'alice', 'guest', undefined, circle, true), false);
});

import { isNativeNotificationRecipient } from '../../src/services/notificationPolicy.ts';
const base = { id: 'event', title: 'تنبيه', message: 'رسالة', time: '', type: 'system' as const, isRead: false };
test('Android never displays a different member’s notification', () => assert.equal(isNativeNotificationRecipient({ ...base, userId: 'bob', targetRole: 'member' }, 'alice'), false));
test('Android UID targeting cannot be overridden by a conflicting email', () => assert.equal(isNativeNotificationRecipient({ ...base, userId: 'bob', userEmail: 'alice@example.com' }, 'alice', 'alice@example.com'), false));
test('Android accepts an explicit recipient and scoped organizer; no ambiguous member broadcast', () => {
 assert.equal(isNativeNotificationRecipient({ ...base, userId: 'alice' }, 'alice'), true);
 assert.equal(isNativeNotificationRecipient({ ...base, targetRole: 'organizer', circleId: 'circle' }, 'alice', null, new Set(['circle'])), true);
 assert.equal(isNativeNotificationRecipient({ ...base, targetRole: 'member' }, 'alice'), false);
});

import { isNotificationForUser } from '../../src/types.ts';
test('inbox never falls through to a member role after UID mismatch', () => {
 for (const type of ['system', 'payment_approved', 'turn_alert'] as const) {
  assert.equal(isNotificationForUser({ ...base, type, userId: 'bob', targetRole: 'member', title: 'تم تعميد واعتماد قسطك' }, 'alice'), false);
 }
});
test('inbox UID has priority over a mismatched email', () => assert.equal(isNotificationForUser({ ...base, userId: 'bob', userEmail: 'alice@example.com' }, 'alice', 'alice@example.com'), false));
test('legacy email notifications match only their owner', () => {
 assert.equal(isNotificationForUser({ ...base, userEmail: ' Alice@Example.com ' }, 'alice', 'alice@example.com'), true);
 assert.equal(isNotificationForUser({ ...base, userEmail: 'bob@example.com', targetRole: 'member' }, 'alice', 'alice@example.com'), false);
});
test('unaddressed member and all-role records are not broadcast', () => {
 for (const targetRole of ['member', 'all'] as const) assert.equal(isNotificationForUser({ ...base, targetRole }, 'alice'), false);
});
test('inbox organizer fallback requires an owned circle', () => {
 assert.equal(isNotificationForUser({ ...base, targetRole: 'organizer', circleId: 'mine' }, 'alice', null, new Set(['mine'])), true);
 assert.equal(isNotificationForUser({ ...base, targetRole: 'organizer', circleId: 'other' }, 'alice', null, new Set(['mine'])), false);
});
test('signed-out user has no inbox even with matching email', () => assert.equal(isNotificationForUser({ ...base, userEmail: 'alice@example.com' }, null, 'alice@example.com'), false));
