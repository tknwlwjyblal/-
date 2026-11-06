import { SavingsCircle, ShareTurnAssignment } from '../types';

export const GREGORIAN_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

/**
 * Calculates Gregorian month name and year starting from today's date,
 * formatted numerically as requested by the user:
 * e.g. "شهر 11 (السداد: 30 / 11)" or "شهر 12 (السداد: 30 / 12)"
 */
export function getMonthNameForTurn(turnNumber: number, baseDate: Date = new Date()): string {
  const currentDay = baseDate.getDate();
  const startOffset = currentDay > 30 ? 1 : 0;
  const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + startOffset + (turnNumber - 1), 1);
  const monthNum = targetDate.getMonth() + 1; // 1 to 12
  const year = targetDate.getFullYear();

  return `شهر ${monthNum} (السداد: 30 / ${monthNum} / ${year})`;
}

/**
 * Returns numerical Gregorian month (e.g. "شهر 11", "شهر 12", "شهر 1")
 */
export function getShortMonthForTurn(turnNumber: number, baseDate: Date = new Date()): string {
  const currentDay = baseDate.getDate();
  const startOffset = currentDay > 30 ? 1 : 0;
  const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + startOffset + (turnNumber - 1), 1);
  const monthNum = targetDate.getMonth() + 1; // 1 to 12

  return `شهر ${monthNum}`;
}

/**
 * Calculates remaining days until day 30 of the current payment cycle month.
 */
export function getDaysLeftUntil30th(baseDate: Date = new Date()): number {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const currentDay = baseDate.getDate();

  let target: Date;
  if (currentDay > 30) {
    target = new Date(year, month + 1, 30);
  } else {
    target = new Date(year, month, 30);
  }

  const diffTime = target.getTime() - baseDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Automatically draws and assigns turns to all members/shares fairly.
 * When the total allocated shares reach the circle's total shares,
 * this function generates the transparent share-by-share schedule in Gregorian dates.
 */
export function assignCircleTurnsAutomatically(circle: SavingsCircle): SavingsCircle {
  const totalShares = circle.sharesCount || circle.totalMonths || 30;
  const sharePrice = circle.sharePrice || circle.monthlyShare || 1000;
  const monthlyPayout = circle.monthlyPayout || sharePrice * totalShares;

  // Build a list of all tickets/shares from joined members
  const shareTickets: Array<{
    memberId: string;
    memberName: string;
    memberAvatar?: string;
    shareIndexForMember: number;
    totalSharesOfMember: number;
  }> = [];

  circle.members.forEach((member) => {
    const memberSharesCount = member.sharesCount || 1;
    for (let i = 1; i <= memberSharesCount; i++) {
      shareTickets.push({
        memberId: member.id,
        memberName: member.name,
        memberAvatar: member.avatar,
        shareIndexForMember: i,
        totalSharesOfMember: memberSharesCount,
      });
    }
  });

  // If there are still unfilled shares up to totalShares, fill them as pending open seats
  while (shareTickets.length < totalShares) {
    const seatNum = shareTickets.length + 1;
    shareTickets.push({
      memberId: `open-seat-${seatNum}`,
      memberName: `مقعد متاح #${seatNum}`,
      memberAvatar: '/assets/aistudio/image_94928b82.png',
      shareIndexForMember: 1,
      totalSharesOfMember: 1,
    });
  }

  // Shuffle share tickets using fair Fisher-Yates algorithm
  const shuffled = [...shareTickets];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Generate assignments
  const assignments: ShareTurnAssignment[] = [];
  const memberTurnsMap = new Map<string, number[]>();

  shuffled.forEach((ticket, idx) => {
    const turnNumber = idx + 1;
    const monthName = getMonthNameForTurn(turnNumber);

    assignments.push({
      shareIndex: turnNumber,
      turnNumber,
      monthName,
      memberId: ticket.memberId,
      memberName: ticket.memberName,
      memberAvatar: ticket.memberAvatar,
      payoutAmount: monthlyPayout,
    });

    if (!memberTurnsMap.has(ticket.memberId)) {
      memberTurnsMap.set(ticket.memberId, []);
    }
    memberTurnsMap.get(ticket.memberId)?.push(turnNumber);
  });

  // Update circle members with their assigned turns
  const updatedMembers = circle.members.map((member) => {
    const assignedTurns = memberTurnsMap.get(member.id) || [1];
    const primaryTurn = assignedTurns[0] || 1;
    const payoutMonth = getMonthNameForTurn(primaryTurn);

    return {
      ...member,
      turnNumber: primaryTurn,
      turns: assignedTurns,
      payoutMonth,
      isCurrentRecipient: primaryTurn === 1,
    };
  });

  // Determine current user's turn
  const currentUserMember = updatedMembers.find((m) => m.isCurrentUser);
  const myPrimaryTurn = currentUserMember?.turnNumber || circle.myTurnNumber || 1;
  const myTurnMonth = currentUserMember?.payoutMonth || getMonthNameForTurn(myPrimaryTurn);

  return {
    ...circle,
    turnsAssigned: true,
    shareTurnAssignments: assignments,
    members: updatedMembers,
    myTurnNumber: myPrimaryTurn,
    myTurnMonth,
    nextPayoutMonth: getMonthNameForTurn(1),
    currentRecipientName: assignments[0]?.memberName || circle.currentRecipientName,
  };
}
