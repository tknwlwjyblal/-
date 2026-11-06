export type Currency = 'YER' | 'SAR' | 'USD';

export type CircleType = 'collective' | 'solo';

export type CircleStatus = 'active' | 'completed' | 'draft';

export type PaymentStatus = 'paid' | 'pending' | 'under_review' | 'overdue';

export interface Member {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar: string;
  turnNumber: number;
  payoutMonth: string;
  isCurrentRecipient?: boolean;
  isPaidThisMonth: boolean;
  paidMonthsCount?: number;
  totalPaidAmount?: number;
  isCurrentUser?: boolean;
  sharesCount?: number;
  turns?: number[];
  joinedViaCode?: boolean;
  isConfirmed?: boolean;
}

export interface ShareTurnAssignment {
  shareIndex: number;
  turnNumber: number;
  monthName: string;
  memberId: string;
  memberName: string;
  memberAvatar?: string;
  payoutAmount: number;
}

export interface SavingsCircle {
  id: string;
  creatorId?: string;
  creatorEmail?: string;
  title: string;
  type: CircleType;
  currency: Currency;
  currencySymbol: string;
  sharePrice?: number;
  sharesCount?: number;
  monthlyPayout?: number;
  mySharesCount?: number;
  monthlyShare: number;
  totalPool: number;
  totalMonths: number;
  completedMonths: number;
  membersCount: number;
  paidMembersThisMonthCount: number;
  myTurnNumber: number;
  myTurnMonth: string;
  myTurnReceived?: boolean;
  myPaymentStatus: PaymentStatus;
  code: string;
  organizer: {
    name: string;
    avatar: string;
    trustScore: number;
    managedCirclesCount: number;
    creatorId?: string;
  };
  members: Member[];
  nextPayoutMonth: string;
  currentRecipientName: string;
  status: CircleStatus;
  isConfirmedByAdmin?: boolean;
  turnsAssigned?: boolean;
  shareTurnAssignments?: ShareTurnAssignment[];
  cashierBankAccounts?: {
    kuraimiAccount?: string;
    jeebWallet?: string;
  };
  daysLeftForPayment?: number;
}

export const SUPER_ADMIN_EMAIL = 'tknwlwjyblal@gmail.com';
export const SUPER_ADMIN_EMAILS = [
  'tknwlwjyblal@gmail.com',
  'dev520top@gmail.com',
];

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.includes(clean);
}

/**
 * Checks whether a circle should be visible to a user:
 * - Super admin sees all circles
 * - Visible to the Circle Organizer / Creator (so they can manage and confirm it)
 * - Visible ONLY to members who joined via the invite code AND have been confirmed/approved
 *   (either the circle is confirmed via isConfirmedByAdmin or the member is confirmed via member.isConfirmed).
 */
export function canUserSeeCircle(
  circle: SavingsCircle,
  userId?: string | null,
  userEmail?: string | null
): boolean {
  if (!circle) return false;
  const cleanEmail = userEmail?.trim().toLowerCase();

  // 0. Super Admin sees all circles to manage platform
  if (cleanEmail && isSuperAdminEmail(cleanEmail)) return true;

  // 1. Circle Creator / Organizer always sees their own created circle to manage & confirm it
  const isCreator = Boolean(
    (userId &&
      ((circle.creatorId && circle.creatorId === userId) ||
        (circle.organizer?.creatorId && circle.organizer.creatorId === userId))) ||
      (cleanEmail &&
        circle.creatorEmail &&
        circle.creatorEmail.trim().toLowerCase() === cleanEmail)
  );
  if (isCreator) return true;

  // 2. Member who joined via code AND was confirmed by the organizer
  const myMember = (circle.members || []).find(
    (m) =>
      (userId && m.id === userId) ||
      (cleanEmail &&
        ((m.email && m.email.trim().toLowerCase() === cleanEmail) ||
          m.id?.trim().toLowerCase() === cleanEmail))
  );

  if (!myMember) return false;

  return Boolean(circle.isConfirmedByAdmin || myMember.isConfirmed);
}

/**
 * Checks if the user joined the circle via code but is still awaiting the organizer's confirmation.
 */
export function isUserPendingConfirmationInCircle(
  circle: SavingsCircle,
  userId?: string | null,
  userEmail?: string | null
): boolean {
  if (!circle) return false;
  if (canUserSeeCircle(circle, userId, userEmail)) return false;

  const cleanEmail = userEmail?.trim().toLowerCase();
  const myMember = (circle.members || []).find(
    (m) =>
      (userId && m.id === userId) ||
      (cleanEmail &&
        ((m.email && m.email.trim().toLowerCase() === cleanEmail) ||
          m.id?.trim().toLowerCase() === cleanEmail))
  );

  return Boolean(myMember);
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  operator: string;
  payoutType: 'bank' | 'wallet';
  institution: string;
  institutionName: string;
  accountNumber: string;
  beneficiaryName: string;
  isVerified: boolean;
  isSuspended?: boolean;
  suspendedReason?: string;
  avatar: string;
}

/**
 * Checks if the user has completed their mandatory first-time profile setup (100% completed).
 */
export function isUserProfileComplete(profile?: UserProfile | null): boolean {
  if (!profile) return false;
  const cleanPhone = (profile.phone || '').replace('+967', '').trim();
  return Boolean(
    profile.isVerified &&
      profile.fullName &&
      profile.fullName.trim().length >= 2 &&
      cleanPhone.length >= 6 &&
      profile.accountNumber &&
      profile.accountNumber.trim().length >= 3
  );
}

export interface SystemLogEntry {
  id: string;
  level: 'info' | 'warning' | 'error';
  title: string;
  details: string;
  path?: string;
  userEmail?: string;
  timestamp: string;
  createdAt: number;
}

export interface GlobalAppSettings {
  id: string;
  maintenanceMode: boolean;
  allowCreateCircles: boolean;
  allowJoinCircles: boolean;
  announcementText: string;
  updatedAt: number;
}

export interface PaymentSubmission {
  id: string;
  circleId: string;
  circleTitle: string;
  amount: number;
  currencySymbol: string;
  trxId: string;
  method: 'bank' | 'wallet' | 'cash';
  receiptFileName: string;
  receiptFileSize: string;
  receiptImageData?: string;
  receiptFileType?: 'image' | 'pdf' | string;
  submittedAt: string;
  createdAt?: number;
  status: 'under_review' | 'approved' | 'rejected';
  recipientName: string;
  advanceMonths?: number;
  coveredMonths?: string[];
  payerId?: string;
  payerName?: string;
  payerEmail?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

/**
 * Validates that a payment document is a real member receipt submission
 * and not a synthesized notification artifact.
 */
export function isValidPaymentSubmission(p?: PaymentSubmission | null): boolean {
  if (!p || !p.id || !p.circleId) return false;
  if (
    p.id.startsWith('notif-approved-') ||
    p.id.startsWith('notif-rejected-') ||
    p.id.startsWith('notif-payer-submit-') ||
    p.id.startsWith('notif-payment-') ||
    p.id.startsWith('n-')
  ) {
    return false;
  }
  if (p.receiptFileSize === 'موثق عبر إشعار السداد') {
    return false;
  }
  if (p.circleId === 'circle-default') {
    return false;
  }
  return true;
}

/**
 * Extracts a reliable numeric timestamp (ms) from a PaymentSubmission
 * so newest receipts always appear first.
 */
export function getPaymentTimestamp(p?: PaymentSubmission | null): number {
  if (!p) return 0;
  if (typeof p.createdAt === 'number' && !isNaN(p.createdAt) && p.createdAt > 0) {
    return p.createdAt;
  }
  const matches = `${p.id || ''} ${p.trxId || ''}`.match(/(\d{10,14})/g);
  if (matches && matches.length > 0) {
    const nums = matches.map((m) => parseInt(m, 10)).filter((n) => !isNaN(n) && n > 1600000000000);
    if (nums.length > 0) {
      return Math.max(...nums);
    }
  }
  return 0;
}

/**
 * Sorts payment receipts newest-first (الإيصالات الأخيرة أولاً)
 * while filtering out invalid records and deduplicating by (circleId + trxId)
 * so the same receipt can never be approved or counted twice.
 */
export function sortPaymentsNewestFirst(list: PaymentSubmission[]): PaymentSubmission[] {
  const validList = (list || []).filter(isValidPaymentSubmission);

  // Deduplicate by circleId + trxId (preferring approved/rejected status over under_review)
  const dedupMap = new Map<string, PaymentSubmission>();
  for (const item of validList) {
    const trxKey = (item.trxId || item.id).trim().toUpperCase();
    const key = `${item.circleId}__${trxKey}`;
    const existing = dedupMap.get(key);
    if (!existing) {
      dedupMap.set(key, item);
    } else {
      const existingReviewed = existing.status === 'approved' || existing.status === 'rejected';
      const itemReviewed = item.status === 'approved' || item.status === 'rejected';
      if (itemReviewed && !existingReviewed) {
        dedupMap.set(key, item);
      } else if (itemReviewed === existingReviewed) {
        if (getPaymentTimestamp(item) > getPaymentTimestamp(existing)) {
          dedupMap.set(key, item);
        }
      }
    }
  }

  return Array.from(dedupMap.values()).sort((a, b) => {
    const timeDiff = getPaymentTimestamp(b) - getPaymentTimestamp(a);
    if (timeDiff !== 0) return timeDiff;
    return (b.id || '').localeCompare(a.id || '');
  });
}

export interface AppNotification {
  id: string;
  userId?: string;
  userEmail?: string;
  targetRole?: 'organizer' | 'member' | 'all';
  senderId?: string;
  title: string;
  message: string;
  time: string;
  type: 'due_reminder' | 'payment_approved' | 'turn_alert' | 'lottery_draw' | 'system';
  isRead: boolean;
  circleId?: string;
  createdAt?: number;
}

/**
 * Validates whether an in-app notification should be shown to the currently authenticated user.
 * Ensures strict separation between Organizer and Member notifications so they never cross.
 */
export function isNotificationForUser(
  notif: AppNotification,
  userUid?: string | null,
  userEmail?: string | null,
  managedCircleIds?: Set<string>
): boolean {
  if (!notif || !userUid) return false;
  // An explicit recipient is authoritative. Never fall through to a broad role match.
  if (notif.userId) return notif.userId === userUid;
  if (notif.userEmail) return Boolean(userEmail && notif.userEmail.trim().toLowerCase() === userEmail.trim().toLowerCase());
  // Legacy organizer-only records can be scoped to an owned circle. Member/all
  // records without an explicit recipient must not enter another user's inbox.
  return notif.targetRole === 'organizer' && Boolean(notif.circleId && managedCircleIds?.has(notif.circleId));
}

export type ActiveView = 
  | 'home' 
  | 'create-circle' 
  | 'join-circle' 
  | 'payment' 
  | 'circle-detail' 
  | 'profile' 
  | 'notifications' 
  | 'my-circles'
  | 'admin-approvals'
  | 'super-admin';

export interface MemberInstallmentProgress {
  member: Member | null;
  sharesCount: number;
  totalRequiredInstallments: number;
  paidInstallmentsCount: number;
  remainingInstallmentsCount: number;
  totalRequiredAmount: number;
  totalPaidAmount: number;
  isCompleted: boolean;
  percent: number;
  approvedPayments: PaymentSubmission[];
}

/**
 * Strictly checks if a payment belongs to a specific member.
 * Prioritizes exact UID match so two members or circles never collide.
 */
export function isPaymentForMember(
  p: PaymentSubmission,
  member?: Member | null,
  userId?: string | null,
  userEmail?: string | null
): boolean {
  if (!p) return false;
  const targetId = userId || member?.id;
  if (targetId && p.payerId && p.payerId !== 'member' && p.payerId !== 'payer') {
    return p.payerId === targetId;
  }
  const cleanEmail = (userEmail || member?.email || '').trim().toLowerCase();
  if (cleanEmail && p.payerEmail) {
    return p.payerEmail.trim().toLowerCase() === cleanEmail;
  }
  if (member?.name && p.payerName) {
    return p.payerName.trim() === member.name.trim();
  }
  return false;
}

/**
 * Recomputes a circle's members' paidMonthsCount and totalPaidAmount deterministically
 * from the deduplicated approved payments of that exact circle.
 */
export function computeCircleMembersWithApprovedPayments(
  circle: SavingsCircle,
  allPayments: PaymentSubmission[]
): { updatedMembers: Member[]; paidMembersThisMonthCount: number } {
  const validApprovedForCircle = sortPaymentsNewestFirst(allPayments || []).filter(
    (p) => p.circleId === circle.id && p.status === 'approved'
  );

  const totalReq = circle.totalMonths || circle.sharesCount || 10;

  const updatedMembers = (circle.members || []).map((m) => {
    const memberApproved = validApprovedForCircle.filter((p) =>
      isPaymentForMember(p, m, m.id, m.email)
    );
    const exactPaidMonths = Math.min(
      totalReq,
      memberApproved.reduce((sum, p) => sum + Math.max(1, Number(p.advanceMonths) || 1), 0)
    );
    const exactTotalPaidAmount = memberApproved.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );
    return {
      ...m,
      isPaidThisMonth: exactPaidMonths > 0,
      paidMonthsCount: exactPaidMonths,
      totalPaidAmount: exactTotalPaidAmount,
    };
  });

  const paidMembersThisMonthCount = updatedMembers.filter((m) => m.isPaidThisMonth).length;

  return { updatedMembers, paidMembersThisMonthCount };
}

/**
 * Computes exact installment progress and stats for a member in a specific circle.
 * Strictly counts deduplicated approved payments for THIS circle so 1 paid installment = 1 installment.
 */
export function getMemberInstallmentProgress(
  circle?: SavingsCircle | null,
  userId?: string | null,
  userEmail?: string | null,
  payments?: PaymentSubmission[]
): MemberInstallmentProgress {
  if (!circle) {
    return {
      member: null,
      sharesCount: 1,
      totalRequiredInstallments: 0,
      paidInstallmentsCount: 0,
      remainingInstallmentsCount: 0,
      totalRequiredAmount: 0,
      totalPaidAmount: 0,
      isCompleted: false,
      percent: 0,
      approvedPayments: [],
    };
  }

  const cleanEmail = userEmail?.trim().toLowerCase();
  const members = circle.members || [];
  const member =
    members.find(
      (m) =>
        (userId && m.id === userId) ||
        (cleanEmail && m.email && m.email.trim().toLowerCase() === cleanEmail) ||
        m.isCurrentUser
    ) || null;

  const sharesCount = member?.sharesCount || circle.mySharesCount || 1;
  // A savings circle runs for circle.totalMonths (e.g. 6 months).
  // In each month, the member pays 1 monthly installment covering their shares.
  // Total installments in the circle is equal to totalMonths (e.g. 6 installments).
  const totalMonths = circle.totalMonths || circle.sharesCount || 10;
  const totalRequiredInstallments = totalMonths;
  const sharePrice = circle.sharePrice || circle.monthlyShare || 1000;
  const singleMonthDue = sharePrice * sharesCount;
  const totalRequiredAmount = totalRequiredInstallments * singleMonthDue;

  // Filter approved payments strictly for this user in THIS circle (deduplicated & sorted newest first)
  const circleApprovedPayments = sortPaymentsNewestFirst(payments || []).filter(
    (p) =>
      p.circleId === circle.id &&
      p.status === 'approved' &&
      isPaymentForMember(p, member, userId, cleanEmail)
  );

  const paymentsInstallmentsCount = circleApprovedPayments.reduce(
    (sum, p) => sum + Math.max(1, Number(p.advanceMonths) || 1),
    0
  );

  // When payments array is provided, use the exact deduplicated approved receipts count
  // so 1 approved receipt of 1 installment ALWAYS equals 1 installment.
  const rawPaidInstallmentsCount =
    payments !== undefined
      ? paymentsInstallmentsCount
      : Math.max(0, member?.paidMonthsCount || 0);

  const paidInstallmentsCount = Math.min(
    totalRequiredInstallments,
    rawPaidInstallmentsCount
  );

  const totalPaidAmount =
    circleApprovedPayments.length > 0
      ? circleApprovedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      : paidInstallmentsCount * singleMonthDue;

  const remainingInstallmentsCount = Math.max(0, totalRequiredInstallments - paidInstallmentsCount);
  const isCompleted = totalRequiredInstallments > 0 && paidInstallmentsCount >= totalRequiredInstallments;
  const percent =
    totalRequiredInstallments > 0
      ? Math.min(100, Math.round((paidInstallmentsCount / totalRequiredInstallments) * 100))
      : 0;

  return {
    member,
    sharesCount,
    totalRequiredInstallments,
    paidInstallmentsCount,
    remainingInstallmentsCount,
    totalRequiredAmount,
    totalPaidAmount,
    isCompleted,
    percent,
    approvedPayments: circleApprovedPayments,
  };
}



