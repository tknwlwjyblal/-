import React, { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  SavingsCircle,
  ActiveView,
  UserProfile,
  AppNotification,
  PaymentSubmission,
  canUserSeeCircle,
  isSuperAdminEmail,
  getMemberInstallmentProgress,
  sortPaymentsNewestFirst,
  computeCircleMembersWithApprovedPayments,
  isPaymentForMember,
} from '../types';
import { auth, db } from '../firebase';
import { doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { EditCircleModal } from '../components/EditCircleModal';
import { assignCircleTurnsAutomatically } from '../utils/lotteryUtils';

interface Props {
  circle?: SavingsCircle | null;
  payments?: PaymentSubmission[];
  userProfile?: UserProfile;
  onNavigate: (view: ActiveView) => void;
  onPayDue: (circle: SavingsCircle) => void;
  onUpdateCircle?: (updated: SavingsCircle) => void;
  onDeleteCircle?: (circleId: string) => void;
}

export const CircleDetailView: React.FC<Props> = ({
  circle,
  payments = [],
  userProfile,
  onNavigate,
  onPayDue,
  onUpdateCircle,
  onDeleteCircle,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCapSharesModalOpen, setIsCapSharesModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCapping, setIsCapping] = useState(false);
  const [approvingPaymentId, setApprovingPaymentId] = useState<string | null>(null);
  const [previewPayment, setPreviewPayment] = useState<PaymentSubmission | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const processedReceiptKeysRef = useRef<Set<string>>(new Set());

  if (!circle) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-[#50453b] my-12" dir="rtl">
        <div className="w-16 h-16 rounded-full bg-[#f0eee8] flex items-center justify-center text-[#714a23] mb-4 shadow-inner">
          <span className="material-symbols-outlined text-3xl">savings</span>
        </div>
        <h3 className="text-base font-bold text-[#1c1c18] mb-1">لم يتم العثور على الجمعية المطلوبة</h3>
        <p className="text-xs text-[#50453b] max-w-xs mb-5">
          قد تكون الجمعية قد حُذفت أو لم يتم اختيار جمعية محددة بعد.
        </p>
        <button
          onClick={() => onNavigate('home')}
          className="px-5 py-2.5 bg-[#714a23] hover:bg-[#8c6239] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  const totalShares = circle.sharesCount || circle.totalMonths || 30;
  const sharePrice = circle.sharePrice || circle.monthlyShare || 1000;
  const monthlyPayout = circle.monthlyPayout || sharePrice * totalShares;

  const membersList = circle.members || [];
  const allocatedShares = membersList.reduce(
    (sum, m) => sum + (m.sharesCount || 1),
    0
  );
  const remainingShares = Math.max(0, totalShares - allocatedShares);
  const isFull = allocatedShares >= totalShares;

  const progressPercent = Math.min(
    100,
    Math.round((circle.completedMonths / (circle.totalMonths || 1)) * 100)
  );

  // Strict organizer validation: ONLY creator/organizer can edit, delete, or confirm
  const currentUid = auth.currentUser?.uid || userProfile?.id;
  const currentEmail = auth.currentUser?.email || userProfile?.email;

  const isCreator = Boolean(
    (currentUid && (
      (circle.creatorId && circle.creatorId === currentUid) ||
      (circle.organizer?.creatorId && circle.organizer.creatorId === currentUid)
    )) ||
    (currentEmail && Boolean(
      circle.creatorEmail && circle.creatorEmail === currentEmail
    ))
  );

  // Strict privacy guard: Circle is ONLY visible to its Organizer or members who joined via code AND were confirmed
  if (!canUserSeeCircle(circle, currentUid, currentEmail) && !isSuperAdminEmail(currentEmail)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-[#50453b] my-12" dir="rtl">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-[#714a23] mb-4 shadow-inner">
          <span className="material-symbols-outlined text-3xl">lock</span>
        </div>
        <h3 className="text-base font-black text-[#1c1c18] mb-1">
          هذه الجمعية خاصة ولا تظهر إلا للمنضمين عبر الكود والمعتمدين
        </h3>
        <p className="text-xs text-[#50453b] max-w-xs mb-5 leading-relaxed">
          إذا كنت قد انضممت لهذه الجمعية بواسطة الكود، فستظهر لك فور قيام منظم الجمعية بتعميد انضمامك أو تعميد الجمعية.
        </p>
        <button
          onClick={() => onNavigate('home')}
          className="px-5 py-2.5 bg-[#714a23] hover:bg-[#8c6239] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  const cleanOrganizerName = (circle.organizer?.name || 'المنظم المعتمد')
    .replace(/\(أنت\)|\(المنظم\)/g, '')
    .trim();

  // Find current user's membership details
  const myMemberObj = membersList.find(
    (m) => (currentUid && m.id === currentUid) || (currentEmail && m.id === currentEmail)
  );
  const mySharesCount = myMemberObj?.sharesCount || (isCreator ? (circle.mySharesCount || 1) : (membersList.length > 0 ? 0 : 1));
  const myMonthlyInstallment = mySharesCount * sharePrice;

  // Turn description
  const myAssignments = (circle.shareTurnAssignments || []).filter(
    (a) => (currentUid && a.memberId === currentUid) || (myMemberObj && a.memberName === myMemberObj.name)
  );
  const myTurnDisplay = circle.isConfirmedByAdmin
    ? (myAssignments.length > 0
        ? myAssignments.map((a) => a.monthName).join(' و ')
        : (myMemberObj?.payoutMonth || circle.myTurnMonth || 'محدد بالقرعة'))
    : 'بعد تعميد الجمعية';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  const copyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(circle.code);
    }
    setCopied(true);
    showToast(`تم نسخ رمز الجمعية [ ${circle.code} ]`);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `🌟 انضم إلى جمعيتي (${circle.title})!\nرمز الجمعية في تطبيق "هيا نجمعها": [ ${circle.code} ]\nقسط السهم الواحد: ${sharePrice.toLocaleString('ar-YE')} ${circle.currencySymbol}\nاستلام المستفيد شهرياً: ${monthlyPayout.toLocaleString('ar-YE')} ${circle.currencySymbol}\n\nمعًا.. نكمّل الخير!`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // 1. Confirm and Approve circle by Organizer: Strictly forbidden for non-creators
  const handleConfirmCircle = async () => {
    if (!isCreator) {
      showToast('عذراً، تعميد واعتماد الجمعية محصور بمنظم الجمعية فقط.');
      return;
    }
    setIsConfirming(true);

    try {
      // Step A: Ensure lottery turns are computed and assigned
      let finalCircle: SavingsCircle = circle;
      if (!circle.turnsAssigned || !circle.shareTurnAssignments || circle.shareTurnAssignments.length === 0) {
        finalCircle = assignCircleTurnsAutomatically(circle);
      }

      const confirmedMembers = (finalCircle.members || []).map((m) => ({
        ...m,
        isConfirmed: true,
      }));

      finalCircle = {
        ...finalCircle,
        members: confirmedMembers,
        isConfirmedByAdmin: true,
        status: 'active',
        turnsAssigned: true,
      };

      // Step B: Save to Firestore
      await updateDoc(doc(db, 'circles', circle.id), {
        isConfirmedByAdmin: true,
        status: 'active',
        turnsAssigned: true,
        shareTurnAssignments: finalCircle.shareTurnAssignments || [],
        members: confirmedMembers,
        nextPayoutMonth: finalCircle.nextPayoutMonth || '',
        currentRecipientName: finalCircle.currentRecipientName || '',
      });

      // Step C: Send detailed in-app notification to EACH member (excluding the organizer)
      const organizerUid = circle.creatorId || circle.organizer?.creatorId || currentUid;
      const organizerEmail = circle.creatorEmail || currentEmail;

      const nonOrganizerMembers = finalCircle.members.filter((member) => {
        const isOrganizer =
          (organizerUid && member.id === organizerUid) ||
          (organizerEmail && member.email && member.email.toLowerCase() === organizerEmail.toLowerCase()) ||
          (currentUid && member.id === currentUid);
        return !isOrganizer;
      });

      const notificationPromises = nonOrganizerMembers.map(async (member) => {
        // Find turns and months for this member
        const memberAssignments = (finalCircle.shareTurnAssignments || []).filter(
          (a) => a.memberId === member.id || a.memberName === member.name
        );

        const turnsList = memberAssignments.length > 0
          ? memberAssignments
              .map((a) => `سهم رقم ${a.shareIndex} (دور ${a.turnNumber} - يستلم شهر ${a.monthName})`)
              .join('، ')
          : 'تم تحديد دورك واستلامك بنجاح';

        const notifDoc: AppNotification = {
          id: `notif-confirm-${circle.id}-${member.id}-${Date.now()}`,
          userId: member.id,
          userEmail: member.email,
          senderId: currentUid,
          targetRole: 'member',
          title: `تم تعميد جمعية (${circle.title}) وتحديد قرعة أسهمك! 🎉`,
          message: `اعتمد منظم الجمعية انطلاقها رسمياً بعد مراجعة الأعضاء. قرعة أسهمك المعتمدة: [ ${turnsList} ]. الحصيلة الشهرية للاستلام: ${monthlyPayout.toLocaleString('ar-YE')} ${circle.currencySymbol}. مبارك لك!`,
          time: 'الآن',
          type: 'lottery_draw',
          isRead: false,
          circleId: circle.id,
          createdAt: Date.now(),
        };

        try {
          const cleanNotif = Object.fromEntries(
            Object.entries(notifDoc).filter(([_, v]) => v !== undefined)
          );
          await setDoc(doc(db, 'notifications', notifDoc.id), cleanNotif);
        } catch (notifErr) {
          console.warn('Failed to save notification for member:', member.id, notifErr);
        }
      });

      // Notification specifically for the Organizer:
      if (currentUid) {
        const orgNotif: AppNotification = {
          id: `notif-org-confirm-${circle.id}-${Date.now()}`,
          userId: currentUid,
          senderId: currentUid,
          targetRole: 'organizer',
          title: `تم تعميد جمعية (${circle.title}) بنجاح 👑`,
          message: `تم اعتماد انطلاق الجمعية وإجراء القرعة وتوزيع الأدوار، وتم إشعار جميع الأعضاء المشتركين بمواعيد استلامهم.`,
          time: 'الآن',
          type: 'lottery_draw',
          isRead: false,
          circleId: circle.id,
          createdAt: Date.now(),
        };
        try {
          const cleanOrg = Object.fromEntries(
            Object.entries(orgNotif).filter(([_, v]) => v !== undefined)
          );
          await setDoc(doc(db, 'notifications', orgNotif.id), cleanOrg);
        } catch (e) {
          console.warn('Failed to save organizer confirm summary:', e);
        }
      }

      await Promise.allSettled(notificationPromises);

      // Step D: Update local app state
      if (onUpdateCircle) {
        onUpdateCircle(finalCircle);
      }

      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#714a23', '#2D6A4F', '#edbf76', '#ffffff'],
        });
      } catch {}

      showToast(`تم تعميد جمعية (${circle.title}) وتحديد القرعة وإشعار جميع الأعضاء بنجاح! 🎉`);
    } catch (err) {
      console.error('Error confirming circle:', err);
      showToast('حدث خطأ أثناء تعميد الجمعية، يرجى المحاولة ثانية.');
    } finally {
      setIsConfirming(false);
    }
  };

  // Confirm an individual member who joined via code so the circle appears in their account
  const handleConfirmMember = async (memberId: string) => {
    if (!isCreator) return;
    const targetMember = (circle.members || []).find((m) => m.id === memberId);
    if (!targetMember) return;

    const updatedMembers = (circle.members || []).map((m) =>
      m.id === memberId ? { ...m, isConfirmed: true } : m
    );

    const updatedCircle: SavingsCircle = {
      ...circle,
      members: updatedMembers,
    };

    try {
      await updateDoc(doc(db, 'circles', circle.id), {
        members: updatedMembers,
      });

      const notifDoc: AppNotification = {
        id: `notif-member-confirm-${circle.id}-${memberId}-${Date.now()}`,
        userId: memberId,
        userEmail: targetMember.email,
        senderId: currentUid,
        targetRole: 'member',
        title: `تم تعميد انضمامك في جمعية (${circle.title}) ✅`,
        message: `قام منظم الجمعية بتعميد انضمامك عبر الكود (${targetMember.sharesCount || 1} سهم). أصبحت الجمعية ظاهرة في قائمتك الآن!`,
        time: 'الآن',
        type: 'system',
        isRead: false,
        circleId: circle.id,
        createdAt: Date.now(),
      };
      const cleanNotif = Object.fromEntries(
        Object.entries(notifDoc).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'notifications', notifDoc.id), cleanNotif);

      if (onUpdateCircle) {
        onUpdateCircle(updatedCircle);
      }
      showToast(`تم تعميد العضو "${targetMember.name}" بنجاح وأصبحت الجمعية ظاهرة لديه ✓`);
    } catch (err) {
      console.error('Error confirming member:', err);
      showToast('حدث خطأ أثناء تعميد العضو');
    }
  };

  // 2. Cap at current allocated shares if not fully booked
  const handleCapCurrentShares = async () => {
    if (!isCreator) {
      showToast('عذراً، هذه الصلاحية خاصة بمنظم الجمعية فقط.');
      return;
    }
    if (allocatedShares <= 0) return;
    setIsCapping(true);

    const newTotalShares = allocatedShares;
    const newMonthlyPayout = sharePrice * newTotalShares;
    const newTotalPool = newTotalShares * newMonthlyPayout;

    let updatedCircle: SavingsCircle = {
      ...circle,
      sharesCount: newTotalShares,
      totalMonths: newTotalShares,
      monthlyPayout: newMonthlyPayout,
      totalPool: newTotalPool,
    };

    // Run fair lottery on the new set of shares
    updatedCircle = assignCircleTurnsAutomatically(updatedCircle);

    try {
      await updateDoc(doc(db, 'circles', circle.id), {
        sharesCount: newTotalShares,
        totalMonths: newTotalShares,
        monthlyPayout: newMonthlyPayout,
        totalPool: newTotalPool,
        turnsAssigned: true,
        shareTurnAssignments: updatedCircle.shareTurnAssignments || [],
        members: updatedCircle.members,
        nextPayoutMonth: updatedCircle.nextPayoutMonth || '',
        currentRecipientName: updatedCircle.currentRecipientName || '',
        myTurnNumber: updatedCircle.myTurnNumber || 1,
        myTurnMonth: updatedCircle.myTurnMonth || '',
      });
    } catch (err) {
      console.warn('Firestore cap shares error:', err);
    }

    if (onUpdateCircle) {
      onUpdateCircle(updatedCircle);
    }

    setIsCapping(false);
    setIsCapSharesModalOpen(false);

    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#714a23', '#c89d58', '#2D6A4F'],
      });
    } catch {}

    showToast(`تم الاكتفاء بـ (${newTotalShares}) سهم وتعديل مدة وحصيلة الجمعية بنجاح!`);
  };

  // 3. Delete circle (Organizer only, and strictly before confirmation)
  const handleDeleteCircle = async () => {
    if (!isCreator) {
      showToast('عذراً، حذف الجمعية محصور بمنظم الجمعية فقط.');
      return;
    }
    if (circle.isConfirmedByAdmin) {
      showToast('لا يمكن حذف الجمعية بعد تعميدها لضمان حقوق المشتركين.');
      setIsDeleteModalOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'circles', circle.id));
    } catch (err) {
      console.warn('Firestore circle delete warning:', err);
    }

    setIsDeleting(false);
    setIsDeleteModalOpen(false);

    if (onDeleteCircle) {
      onDeleteCircle(circle.id);
    } else {
      showToast('تم حذف الجمعية بنجاح من قاعدة البيانات.');
      onNavigate('home');
    }
  };

  // 4. Automated Fair Lottery Draw & Turn Assignment (Organizer only)
  const handleRunLottery = async () => {
    if (!isCreator) {
      showToast('عذراً، إجراء القرعة محصور بمنظم الجمعية فقط.');
      return;
    }
    const updated = assignCircleTurnsAutomatically(circle);

    try {
      await updateDoc(doc(db, 'circles', circle.id), {
        turnsAssigned: true,
        shareTurnAssignments: updated.shareTurnAssignments || [],
        members: updated.members,
        nextPayoutMonth: updated.nextPayoutMonth || '',
        currentRecipientName: updated.currentRecipientName || '',
      });
    } catch (err) {
      console.warn('Firestore lottery save warning:', err);
    }

    if (onUpdateCircle) {
      onUpdateCircle(updated);
    }

    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#714a23', '#c89d58', '#2D6A4F', '#ffffff'],
      });
    } catch {}

    showToast('🎉 تم إجراء القرعة وتوزيع أدوار الأسهم آلياً بنجاح!');
  };

  const handleSaveCircleEdit = (updated: SavingsCircle) => {
    if (!isCreator) {
      showToast('عذراً، تعديل الجمعية محصور بمنظم الجمعية فقط.');
      return;
    }
    if (onUpdateCircle) {
      onUpdateCircle(updated);
    }
    showToast('تم حفظ وتحديث معلومات الجمعية بنجاح ✓');
  };

  // All payment receipts uploaded by members for THIS circle (sorted newest-first)
  const circlePayments = sortPaymentsNewestFirst(
    payments.filter((p) => p.circleId === circle.id)
  );
  const pendingCirclePayments = circlePayments.filter((p) => p.status === 'under_review');

  // Member's installment progress and certified payments in this circle
  const userProgress = getMemberInstallmentProgress(
    circle,
    currentUid,
    currentEmail,
    payments
  );

  // 5. Organizer: Approve a member's uploaded payment receipt directly (Strictly isolated to THIS circle & once only)
  const handleApproveReceipt = async (payment: PaymentSubmission) => {
    if (!isCreator) return;
    if (!payment || payment.circleId !== circle.id) {
      showToast('هذا الإيصال لا يتبع هذه الجمعية.');
      return;
    }

    const trxLockKey = `${circle.id}__${(payment.trxId || payment.id).trim().toUpperCase()}`;
    if (
      payment.status !== 'under_review' ||
      approvingPaymentId !== null ||
      processedReceiptKeysRef.current.has(payment.id) ||
      processedReceiptKeysRef.current.has(trxLockKey)
    ) {
      showToast('تم تعميد هذا الإيصال مسبقاً ولا يمكن تعميده أكثر من مرة ✓');
      return;
    }

    processedReceiptKeysRef.current.add(payment.id);
    processedReceiptKeysRef.current.add(trxLockKey);
    setApprovingPaymentId(payment.id);

    const nowStr = 'اليوم، ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });
    const exactAdvanceMonths = Math.max(1, Number(payment.advanceMonths) || 1);

    const nextPaymentsList = payments.map((p) => {
      const pKey = `${p.circleId}__${(p.trxId || p.id).trim().toUpperCase()}`;
      if (p.id === payment.id || pKey === trxLockKey) {
        return {
          ...p,
          status: 'approved' as const,
          advanceMonths: exactAdvanceMonths,
          reviewedAt: nowStr,
        };
      }
      return p;
    });

    try {
      await updateDoc(doc(db, 'payments', payment.id), {
        status: 'approved',
        advanceMonths: exactAdvanceMonths,
        reviewedAt: nowStr,
      });

      const { updatedMembers, paidMembersThisMonthCount } =
        computeCircleMembersWithApprovedPayments(circle, nextPaymentsList);

      const updatedCircle: SavingsCircle = {
        ...circle,
        paidMembersThisMonthCount,
        members: updatedMembers,
      };

      await updateDoc(doc(db, 'circles', circle.id), {
        paidMembersThisMonthCount,
        members: updatedMembers,
      });

      if (onUpdateCircle) {
        onUpdateCircle(updatedCircle);
      }

      const targetMember = circle.members.find((m) =>
        isPaymentForMember(payment, m, m.id, m.email)
      );
      const recipientUid =
        targetMember?.id && targetMember.id !== currentUid
          ? targetMember.id
          : payment.payerId && payment.payerId !== currentUid
          ? payment.payerId
          : undefined;
      const recipientEmail = targetMember?.email || payment.payerEmail;

      if (recipientUid || recipientEmail) {
        const advanceNotice =
          exactAdvanceMonths > 1
            ? ` (${exactAdvanceMonths} أقساط مقدّمة: ${payment.coveredMonths?.join('، ')})`
            : ' (قسط واحد)';
        const notif: AppNotification = {
          id: `notif-approved-${payment.id}-${Date.now()}`,
          userId: recipientUid,
          userEmail: recipientEmail,
          senderId: currentUid,
          targetRole: 'member',
          title: `تم تعميد قسطك في جمعية "${circle.title}" 🎉`,
          message: `اعتمد منظم جمعية "${circle.title}" إيصال سدادك بقيمة ${payment.amount.toLocaleString('ar-YE')} ${payment.currencySymbol}${advanceNotice} (سند: ${payment.trxId}).`,
          time: 'الآن',
          type: 'payment_approved',
          isRead: false,
          circleId: circle.id,
          createdAt: Date.now(),
        };
        try {
          const cleanApproveNotif = Object.fromEntries(
            Object.entries(notif).filter(([_, v]) => v !== undefined)
          );
          await setDoc(doc(db, 'notifications', notif.id), cleanApproveNotif);
        } catch (e) {
          console.warn('Approval notification warning:', e);
        }
      }

      try {
        confetti({
          particleCount: 80,
          spread: 65,
          origin: { y: 0.6 },
          colors: ['#2D6A4F', '#714a23', '#ffdeae', '#ffffff'],
        });
      } catch {}

      showToast(
        `تم تعميد (${exactAdvanceMonths === 1 ? 'قسط واحد' : `${exactAdvanceMonths} أقساط`}) للمشترك (${payment.payerName || 'العضو'}) في جمعية "${circle.title}" بنجاح! ✓`
      );
    } catch (err) {
      console.error('Approve receipt error:', err);
      processedReceiptKeysRef.current.delete(payment.id);
      processedReceiptKeysRef.current.delete(trxLockKey);
      showToast('حدث خطأ أثناء تعميد الإيصال.');
    } finally {
      setApprovingPaymentId(null);
    }
  };

  // 6. Organizer: Reject a member's uploaded payment receipt
  const handleRejectReceipt = async (payment: PaymentSubmission) => {
    if (!isCreator || !payment || payment.status !== 'under_review') return;
    const trxLockKey = `${circle.id}__${(payment.trxId || payment.id).trim().toUpperCase()}`;
    if (approvingPaymentId !== null || processedReceiptKeysRef.current.has(payment.id)) return;

    processedReceiptKeysRef.current.add(payment.id);
    processedReceiptKeysRef.current.add(trxLockKey);
    setApprovingPaymentId(payment.id);

    try {
      const nowStr = 'اليوم، ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });
      await updateDoc(doc(db, 'payments', payment.id), {
        status: 'rejected',
        reviewedAt: nowStr,
        reviewNote: 'تعذر اعتماد الإيصال من قِبل المنظم، يرجى إعادة التأكد ورفع الإيصال الصحيح',
      });

      const notifForMember: AppNotification = {
        id: `notif-rejected-${payment.id}-${Date.now()}`,
        userId: payment.payerId,
        userEmail: payment.payerEmail,
        targetRole: 'member',
        title: 'تعذر اعتماد إيصال القسط ❌',
        message: `أفاد منظم جمعية "${circle.title}" بتعذر اعتماد إيصالك برقم (${payment.trxId}). تم فتح إمكانية إعادة رفع الإيصال الصحيح.`,
        time: 'الآن',
        type: 'due_reminder',
        isRead: false,
        circleId: circle.id,
        createdAt: Date.now(),
      };
      const cleanRejectNotif = Object.fromEntries(
        Object.entries(notifForMember).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'notifications', notifForMember.id), cleanRejectNotif);
      showToast('تم رفض الإيصال وإشعار المشترك لإعادة رفع الإيصال الصحيح.');
    } catch (err) {
      processedReceiptKeysRef.current.delete(payment.id);
      processedReceiptKeysRef.current.delete(trxLockKey);
      console.warn('Reject receipt error:', err);
      showToast('حدث خطأ أثناء رفض الإيصال.');
    } finally {
      setApprovingPaymentId(null);
    }
  };

  return (
    <div className="flex flex-col w-full pb-28 pt-2 px-4 selection:bg-[#ffdcbf] text-right" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1c1c18] text-[#fcf9f3] px-4 py-2.5 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 border border-[#8c6239]/40 animate-fade-in max-w-sm text-center">
          <span className="material-symbols-outlined text-sm text-[#edbf76]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Admin / Organizer Control Card - STRICTLY visible only to isCreator */}
      {isCreator && (
        <div className="flex flex-col gap-3 p-4 mb-4 rounded-2xl bg-gradient-to-r from-[#ffdeae]/40 via-[#f6f3ed] to-[#ffdeae]/20 border border-[#edbf76]/70 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#714a23] text-white flex items-center justify-center shadow-xs shrink-0">
                <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
              </div>
              <div>
                <h4 className="text-xs font-black text-[#1c1c18]">لوحة تحكم منشئ الجمعية (المنظم)</h4>
                <p className="text-[10px] text-[#50453b]">
                  {circle.isConfirmedByAdmin
                    ? 'الجمعية معمدة رسمياً ومقفلة ضد الحذف'
                    : 'بانتظار تعميدك واعتماد انطلاق الجمعية'}
                </p>
              </div>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                circle.isConfirmedByAdmin
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              {circle.isConfirmedByAdmin ? 'معمدة وموثقة ✓' : 'غير معمدة بعد ⚠️'}
            </span>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#714a23]/10">
            {!circle.isConfirmedByAdmin ? (
              <button
                type="button"
                disabled={isConfirming}
                onClick={handleConfirmCircle}
                className="flex-1 min-w-[150px] h-9 rounded-xl bg-[#2D6A4F] hover:bg-[#204e3a] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-60"
              >
                {isConfirming ? (
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-base">verified</span>
                )}
                <span>تعميد واعتماد الجمعية</span>
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                <span className="material-symbols-outlined text-sm">lock</span>
                <span>معمدة رسمياً ومحمية من الحذف</span>
              </div>
            )}

            {/* Organizer Edit Button */}
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 h-9 rounded-xl bg-white text-[#714a23] border border-[#714a23] text-xs font-bold flex items-center gap-1 hover:bg-[#ffdeae]/20 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              <span>تعديل</span>
            </button>

            {/* Delete button: strictly allowed ONLY BEFORE confirmation */}
            {!circle.isConfirmedByAdmin ? (
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-3 h-9 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                <span>حذف الجمعية</span>
              </button>
            ) : null}
          </div>

          {/* Quick Option to Cap Shares if not full and not confirmed */}
          {!circle.isConfirmedByAdmin && allocatedShares > 0 && allocatedShares < totalShares && (
            <div className="mt-1 p-2.5 rounded-xl bg-white border border-[#edbf76] flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-[#50453b]">
                <span className="material-symbols-outlined text-base text-[#714a23]">tune</span>
                <span className="text-[11px]">
                  محجوز <strong>{allocatedShares}</strong> من أصل <strong>{totalShares}</strong> سهم
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCapSharesModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-[#714a23] hover:bg-[#8c6239] text-white text-[11px] font-bold transition-all active:scale-95 cursor-pointer shrink-0"
              >
                الاكتفاء بالأسهم الحالية وبدء الجمعية
              </button>
            </div>
          )}
        </div>
      )}

      {/* Top Pool Overview Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#714a23] to-[#543419] text-white p-5 shadow-lg mb-4">
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-[#ffdeae] text-[10px] font-bold">
                {circle.currency} • {totalShares} أسهم • مدة {totalShares} شهراً
              </span>
              {/* Only Organizer can see Edit button */}
              {isCreator && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">edit</span>
                  <span>تعديل</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/80">
              <span className="material-symbols-outlined text-sm">schedule</span>
              <span>الدفعة {circle.completedMonths + 1} من {totalShares}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-black text-white">{circle.title}</h2>
              {circle.isConfirmedByAdmin ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold shrink-0">
                  معمدة ✓
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/30 text-[10px] font-bold shrink-0">
                  بانتظار التعميد
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black font-sans text-white">
                {monthlyPayout.toLocaleString('ar-YE')}
              </span>
              <span className="text-xs text-[#ffdeae] font-bold">
                {circle.currencySymbol} يستلمها كل شهر واحد
              </span>
            </div>
          </div>

          {/* Quick Metric Tiles */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-xs">
            <div className="flex flex-col bg-white/10 p-2 rounded-xl">
              <span className="text-[9px] text-white/70">سعر السهم</span>
              <span className="font-bold text-white text-xs mt-0.5 font-sans">
                {sharePrice.toLocaleString('ar-YE')} {circle.currencySymbol}
              </span>
            </div>

            <div className="flex flex-col bg-white/10 p-2 rounded-xl">
              <span className="text-[9px] text-white/70">قسطك الشهري</span>
              <span className="font-bold text-white text-xs mt-0.5 font-sans">
                {myMonthlyInstallment > 0
                  ? myMonthlyInstallment.toLocaleString('ar-YE')
                  : sharePrice.toLocaleString('ar-YE')}{' '}
                {circle.currencySymbol}
                <span className="text-[9px] text-white/70 block">
                  ({mySharesCount > 0 ? mySharesCount : 1} سهم)
                </span>
              </span>
            </div>

            <div className="flex flex-col bg-white/10 p-2 rounded-xl">
              <span className="text-[9px] text-white/70">دورك للاستلام</span>
              <span className="font-bold text-[#ffdeae] text-xs mt-0.5 truncate">
                {myTurnDisplay}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex flex-col gap-1 pt-1">
            <div className="flex justify-between items-center text-[10px] text-white/80">
              <span>دورات وسدادات الجمعية</span>
              <span className="font-bold text-[#ffdeae]">{progressPercent}%</span>
            </div>
            <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-l from-emerald-400 to-[#ffdeae] h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Circle Code & Organizer Bar */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {/* Real Code Box */}
        <div className="p-3 bg-white rounded-2xl shadow-xs border border-[#e5e2dc] flex flex-col justify-between">
          <span className="text-[10px] text-[#50453b]">كود الانضمام الموثق</span>
          <div className="flex items-center justify-between mt-1">
            <span className="font-mono font-black text-xs text-[#714a23]" dir="ltr">
              {circle.code}
            </span>
            <button
              onClick={copyCode}
              className="text-[#714a23] hover:text-[#8c6239] active:scale-95 text-xs font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">
                {copied ? 'done' : 'content_copy'}
              </span>
            </button>
          </div>
        </div>

        {/* Organizer Box */}
        <div className="p-3 bg-white rounded-2xl shadow-xs border border-[#e5e2dc] flex items-center gap-2">
          <img
            src={circle.organizer.avatar}
            alt={cleanOrganizerName}
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-[#50453b]">المنظم المعتمد</span>
            <span className="text-xs font-bold text-[#1c1c18] truncate">
              {cleanOrganizerName} {isCreator && <span className="text-[#714a23] font-bold text-[10px]">(أنت)</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Capacity & Fullness Status */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-xs border border-[#e5e2dc] flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#1c1c18]">حالة حجز مقاعد الأسهم</span>
          <span className="font-black text-[#714a23]">
            {allocatedShares} من {totalShares} سهم
            {remainingShares > 0 ? ` (متبقي ${remainingShares} أسهم)` : ' (مكتملة بالكامل 🎉)'}
          </span>
        </div>
        <div className="w-full bg-[#e5e2dc] h-2.5 rounded-full overflow-hidden flex">
          <div
            className="bg-[#714a23] h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round((allocatedShares / totalShares) * 100))}%` }}
          />
        </div>

        {/* Organizer Action: If shares aren't full yet, offer capping at current shares */}
        {isCreator && !circle.isConfirmedByAdmin && remainingShares > 0 && allocatedShares > 0 && (
          <div className="mt-1 p-3 rounded-xl bg-[#f6f3ed] border border-[#8c6239]/20 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-[#50453b] text-xs">
              <span className="material-symbols-outlined text-xl text-[#714a23]">
                tune
              </span>
              <span>
                هل ترغب ببدء الجمعية الآن؟ يمكنك <strong>الاكتفاء بـ ({allocatedShares} سهم)</strong> المحجوزة حالياً دون انتظار باقي الأسهم.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsCapSharesModalOpen(true)}
              className="px-3.5 py-2 bg-[#714a23] hover:bg-[#8c6239] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              الاكتفاء بالأسهم الحالية ({allocatedShares})
            </button>
          </div>
        )}

        {/* Action if full and turns not assigned (Organizer view) */}
        {isCreator && isFull && !circle.turnsAssigned && (
          <div className="mt-1 p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-amber-900 text-xs">
              <span className="material-symbols-outlined text-xl text-amber-700 animate-bounce">
                casino
              </span>
              <span>
                <strong>اكتملت جميع الأسهم!</strong> البرنامج جاهز لإجراء القرعة وتحديد الأدوار والشهور تلقائياً.
              </span>
            </div>
            <button
              type="button"
              onClick={handleRunLottery}
              className="px-4 py-2 bg-[#714a23] hover:bg-[#8c6239] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              إجراء القرعة وتوزيع الأدوار آلياً
            </button>
          </div>
        )}

        {isCreator && isFull && circle.turnsAssigned && !circle.isConfirmedByAdmin && (
          <div className="flex items-center justify-between pt-1 text-xs text-[#50453b]">
            <span className="flex items-center gap-1 text-emerald-700 font-bold">
              <span className="material-symbols-outlined text-sm">verified</span>
              <span>تم توزيع الأدوار بالقرعة - بانتظار تعميدك النهائي</span>
            </span>
            <button
              type="button"
              onClick={handleRunLottery}
              className="text-[11px] text-[#714a23] font-bold underline hover:opacity-80 cursor-pointer"
            >
              إعادة إجراء القرعة
            </button>
          </div>
        )}
      </div>

      {/* MEMBER'S CERTIFIED INSTALLMENT PROGRESS & RECEIPTS:
          Shows how many installments the user has paid inside this circle,
          percentage completed, remaining installments, and certified receipts */}
      <section className="rounded-2xl bg-white p-4 shadow-sm border border-[#e5e2dc] mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#f0eee8]">
          <div className="flex items-center gap-2">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs ${
                userProgress.isCompleted ? 'bg-emerald-600 text-white' : 'bg-[#ebe8e2] text-[#714a23]'
              }`}
            >
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                {userProgress.isCompleted ? 'verified' : 'account_balance_wallet'}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-black text-[#1c1c18] flex items-center gap-1.5">
                <span>سجل وسداد أقساطي في الجمعية</span>
                {userProgress.isCompleted && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black">
                    مكتمل ١٠٠% 🏆
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-[#50453b]">
                متابعة الأقساط المعمدة والمتبقية والإيصالات الموثقة
              </p>
            </div>
          </div>

          <span className="font-sans font-black text-sm text-[#714a23]">
            {userProgress.percent}%
          </span>
        </div>

        {/* Progress Bar & Counters */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#50453b]">الأقساط المسددة والمعمدة:</span>
            <span className="font-black text-[#1c1c18] font-sans">
              <span className="text-[#714a23] font-bold text-sm">{userProgress.paidInstallmentsCount}</span> من أصل <span className="font-bold">{userProgress.totalRequiredInstallments}</span> قسط
            </span>
          </div>
          <div className="w-full bg-[#f0eee8] h-3 rounded-full overflow-hidden p-0.5 border border-[#e5e2dc]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                userProgress.isCompleted
                  ? 'bg-gradient-to-l from-emerald-500 to-emerald-600'
                  : 'bg-gradient-to-l from-[#714a23] to-[#996b3f]'
              }`}
              style={{ width: `${userProgress.percent}%` }}
            />
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-[#f6f3ed] border border-[#e5e2dc]/60 flex flex-col items-center">
            <span className="text-[10px] text-[#50453b]">المسدد والمعمد</span>
            <span className="font-black text-emerald-800 text-xs mt-0.5 font-sans">
              {userProgress.totalPaidAmount.toLocaleString('ar-YE')}
            </span>
            <span className="text-[9px] text-[#50453b]">{circle.currencySymbol}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#f6f3ed] border border-[#e5e2dc]/60 flex flex-col items-center">
            <span className="text-[10px] text-[#50453b]">الأقساط المتبقية</span>
            <span className="font-black text-[#714a23] text-xs mt-0.5 font-sans">
              {userProgress.remainingInstallmentsCount}
            </span>
            <span className="text-[9px] text-[#50453b]">
              {userProgress.remainingInstallmentsCount === 0 ? 'مكتمل' : 'قسط متبقي'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#f6f3ed] border border-[#e5e2dc]/60 flex flex-col items-center">
            <span className="text-[10px] text-[#50453b]">إجمالي المطلوب</span>
            <span className="font-black text-[#1c1c18] text-xs mt-0.5 font-sans">
              {userProgress.totalRequiredAmount.toLocaleString('ar-YE')}
            </span>
            <span className="text-[9px] text-[#50453b]">{circle.currencySymbol}</span>
          </div>
        </div>

        {/* Status Alert */}
        {userProgress.isCompleted ? (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-emerald-700 shrink-0">check_circle</span>
            <span className="text-[11px] font-medium leading-relaxed">
              <strong>تم إتمام سداد كامل أقساطك المحددة في الجمعية بنجاح!</strong> لا توجد أي أقساط متأخرة أو متبقية، وتم قفل رفع إيصالات جديدة.
            </span>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-[#ffdeae]/20 border border-[#ffdeae]/60 text-[#604101] text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#714a23]">info</span>
              <span className="text-[11px]">متبقي عليك <strong>{userProgress.remainingInstallmentsCount} أقساط</strong> لإكمال الجمعية بالكامل</span>
            </div>
            <button
              type="button"
              onClick={() => onPayDue(circle)}
              className="px-2.5 py-1 bg-[#714a23] hover:bg-[#8c6239] text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer"
            >
              دفع قسط
            </button>
          </div>
        )}

        {/* User's Approved & Submitted Receipts List */}
        {userProgress.approvedPayments.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-[#f0eee8]">
            <span className="text-xs font-bold text-[#1c1c18] flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-[#2D6A4F]">verified</span>
              <span>الإيصالات المعمدة رسمياً من قِبل المنظم ({userProgress.approvedPayments.length}):</span>
            </span>

            <div className="flex flex-col gap-1.5">
              {userProgress.approvedPayments.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl bg-[#fcf9f3] border border-[#edbf76]/50 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-emerald-700 text-base shrink-0">
                      receipt
                    </span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#1c1c18] truncate font-sans">
                          {p.amount.toLocaleString('ar-YE')} {p.currencySymbol}
                        </span>
                        <span className="text-[10px] text-[#50453b]">
                          ({p.advanceMonths && p.advanceMonths > 1 ? `${p.advanceMonths} أقساط` : 'قسط شهر'})
                        </span>
                      </div>
                      <span className="text-[10px] text-[#50453b] font-mono">
                        سند: {p.trxId} • {p.submittedAt}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-xs">done_all</span>
                      <span>معمد ✓</span>
                    </span>
                    {(p.receiptImageData || p.receiptFileName) && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewPayment(p);
                          setZoomLevel(1);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-white border border-[#714a23]/30 text-[#714a23] hover:bg-[#ffdeae]/20 text-[10px] font-bold cursor-pointer"
                      >
                        معاينة
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ORGANIZER RECEIPT APPROVAL PANEL:
          Appears ONLY to the Circle Organizer AND ONLY when members have uploaded payment receipts!
          ("لوحة التعميد تظهر لمنظم الجمعية عندما يرفع الاعضاء الايصالات")
      */}
      {isCreator && circlePayments.length > 0 && (
        <section className="rounded-2xl bg-gradient-to-b from-[#ffdeae]/35 to-white p-4 shadow-md border-2 border-[#edbf76] mb-4 flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#edbf76]/50">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#714a23] text-white flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-xl">fact_check</span>
              </div>
              <div>
                <h3 className="text-xs font-black text-[#1c1c18] flex items-center gap-1.5">
                  <span>لوحة تعميد إيصالات الأعضاء المرفوعة 👑</span>
                  {pendingCirclePayments.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black animate-pulse">
                      {pendingCirclePayments.length} جديد
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-[#604101]">
                  قام الأعضاء برفع إيصالات السداد — يمكنك معاينة الإيصال كصورة أو PDF وتعميده فوراً
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('admin-approvals')}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#f6f3ed] text-[#714a23] border border-[#714a23]/30 text-[10px] font-bold shadow-xs cursor-pointer shrink-0"
            >
              عرض الكل ({circlePayments.length})
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            {circlePayments.map((payment) => {
              const isPending = payment.status === 'under_review';
              const isApproved = payment.status === 'approved';
              const isPdf =
                payment.receiptFileType === 'pdf' ||
                payment.receiptFileName?.toLowerCase().endsWith('.pdf');

              return (
                <div
                  key={payment.id}
                  className="p-3 rounded-xl bg-white border border-[#e5e2dc] shadow-xs flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#714a23] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {(payment.payerName || 'ع').charAt(0)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-[#1c1c18] truncate">
                          {payment.payerName || 'مشترك الجمعية'}
                        </span>
                        <span className="text-[10px] text-[#50453b]">
                          المبلغ:{' '}
                          <strong className="text-[#714a23] font-sans">
                            {payment.amount.toLocaleString('ar-YE')} {payment.currencySymbol}
                          </strong>{' '}
                          •{' '}
                          {(payment.advanceMonths || 1) > 1
                            ? `${payment.advanceMonths} أقساط (${payment.coveredMonths?.join('، ')})`
                            : `قسط شهر واحد (${payment.coveredMonths?.[0] || 'الحالي'})`}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                        isPending
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : isApproved
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-red-100 text-red-900 border border-red-300'
                      }`}
                    >
                      {isPending ? 'بانتظار التعميد ⏳' : isApproved ? 'معمد ✓' : 'مرفوض ✕'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#f0eee8]">
                    <button
                      type="button"
                      onClick={() => {
                        setZoomLevel(1);
                        setPreviewPayment(payment);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#f6f3ed] hover:bg-[#ffdeae]/40 text-[#714a23] text-xs font-bold border border-[#714a23]/25 flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {isPdf ? 'picture_as_pdf' : 'image'}
                      </span>
                      <span>عرض الإيصال ({isPdf ? 'PDF' : 'صورة'})</span>
                    </button>

                    {isPending && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={approvingPaymentId !== null}
                          onClick={() => handleApproveReceipt(payment)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#2D6A4F] hover:bg-[#23533e] text-white text-xs font-bold shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {approvingPaymentId === payment.id ? (
                            <span className="material-symbols-outlined text-sm animate-spin">
                              progress_activity
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-sm">verified</span>
                          )}
                          <span>تعميد القسط ✓</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* LOTTERY & TURN ASSIGNMENTS SECTION:
          Requirement 3: "آلية تحديد القرعة ما تظهر للأعضاء إلا بعد تعميد منظم الجمعية"
      */}
      {!isCreator && !circle.isConfirmedByAdmin ? (
        /* Member View Before Organizer Confirmation: Waiting Banner */
        <section className="bg-white rounded-2xl p-6 shadow-xs border border-[#e5e2dc] mb-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <span className="material-symbols-outlined text-3xl animate-pulse">hourglass_top</span>
          </div>
          <h3 className="text-sm font-black text-[#1c1c18] mb-1">
            بانتظار تعميد المنظم واعتماد جدول الأدوار
          </h3>
          <p className="text-xs text-[#50453b] leading-relaxed max-w-sm mx-auto mb-4">
            يقوم منظم الجمعية حالياً بمتابعة اكتمال الأسهم وحجز المقاعد ({allocatedShares} من أصل {totalShares} سهم محجوزة). سيتم كشف جدول الأدوار وتحديد قرعة أسهمك رسمياً وإرسال إشعار فوري لك بمجرد أن يعمد المنظم الجمعية.
          </p>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-100/70 text-amber-900 text-[11px] font-bold border border-amber-200">
            <span className="material-symbols-outlined text-sm text-amber-700">notifications_active</span>
            <span>ستصلك تنبيهات فورية فور اعتماد جدول القرعة والشهور</span>
          </div>
        </section>
      ) : (circle.shareTurnAssignments && circle.shareTurnAssignments.length > 0 && (circle.isConfirmedByAdmin || isCreator)) ? (
        /* Visible to Organizer ALWAYS, and visible to Members ONLY AFTER circle.isConfirmedByAdmin === true */
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[#e5e2dc] mb-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#f0eee8] mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-[#714a23]">casino</span>
              <h3 className="text-xs font-black text-[#1c1c18]">
                جدول الأدوار والأسهم المعتمد بالقرعة (سهم ورقم وشهر الاستلام)
              </h3>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
              {circle.isConfirmedByAdmin ? 'معتمد رسمياً ✓' : 'معاينة المنظم'}
            </span>
          </div>

          <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
            {circle.shareTurnAssignments.map((assignment) => {
              const isCurrentUser = assignment.memberId === (userProfile?.id || auth.currentUser?.uid);
              return (
                <div
                  key={assignment.turnNumber}
                  className={`p-3 rounded-xl flex items-center justify-between border transition-all ${
                    isCurrentUser
                      ? 'bg-[#ffdeae]/30 border-[#edbf76] shadow-xs ring-1 ring-[#edbf76]'
                      : 'bg-[#fcf9f3] border-[#e5e2dc]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#714a23] text-white flex flex-col items-center justify-center font-black text-[11px] shrink-0 font-sans shadow-xs">
                      <span>{assignment.turnNumber}</span>
                    </div>

                    <div className="flex flex-col text-right">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#1c1c18]">
                          {assignment.memberName}
                        </span>
                        {isCurrentUser && (
                          <span className="px-1.5 py-0.2 rounded bg-[#714a23] text-white text-[9px] font-bold">
                            سهمك أنت
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#714a23] font-bold mt-0.5">
                        سهم رقم ({assignment.shareIndex}) • يستلم في: {assignment.monthName}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-xs font-black text-[#714a23] font-sans">
                      {assignment.payoutAmount.toLocaleString('ar-YE')} {circle.currencySymbol}
                    </span>
                    <span className="text-[9px] text-[#50453b]">الحصيلة الكاملة</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Members Roster & Organizer Member Confirmation Panel */}
      {(isCreator || (!circle.shareTurnAssignments || circle.shareTurnAssignments.length === 0)) && (
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-[#e5e2dc] mb-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#f0eee8] mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-[#714a23]">groups</span>
              <h3 className="text-xs font-black text-[#1c1c18]">
                {isCreator
                  ? 'الأعضاء المنضمون عبر الكود وتعميدهم'
                  : 'قائمة الأعضاء والأسهم المشتركة'}
              </h3>
            </div>
            <span className="text-[10px] text-[#50453b]">
              {circle.members.length} أعضاء ({allocatedShares} أسهم)
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {circle.members.map((member) => {
              const isMe = member.isCurrentUser || member.id === auth.currentUser?.uid;
              const isMemberConfirmed = Boolean(
                circle.isConfirmedByAdmin || member.isConfirmed || (isCreator && isMe)
              );

              return (
                <div
                  key={member.id}
                  className={`p-3 rounded-xl flex items-center justify-between border transition-all ${
                    isMe ? 'bg-[#f6f3ed] border-[#8c6239]/40' : 'bg-white border-[#f0eee8]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={member.avatar || '/assets/aistudio/image_94928b82.png'}
                      alt={member.name}
                      className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-[#e5e2dc]"
                    />
                    <div className="flex flex-col text-right min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#1c1c18] truncate">
                          {member.name} {isMe && <span className="text-[#714a23] font-bold">(أنت)</span>}
                        </span>
                        {isMemberConfirmed && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold shrink-0">
                            معمد ✓
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#50453b]">
                        عدد الأسهم: <strong>{member.sharesCount || 1} {member.sharesCount === 1 ? 'سهم' : 'أسهم'}</strong> • القسط: {((member.sharesCount || 1) * sharePrice).toLocaleString('ar-YE')} {circle.currencySymbol}
                      </span>
                    </div>
                  </div>

                  {isCreator && !isMemberConfirmed ? (
                    <button
                      type="button"
                      onClick={() => handleConfirmMember(member.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#2D6A4F] hover:bg-[#23533e] text-white text-[10px] font-bold shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <span className="material-symbols-outlined text-xs">verified</span>
                      <span>تعميد العضو</span>
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-[#f0eee8] text-[#50453b] text-[10px] font-bold shrink-0">
                      {circle.isConfirmedByAdmin
                        ? member.payoutMonth || 'محدد بالقرعة'
                        : isMemberConfirmed
                        ? 'معمد عبر الكود ✓'
                        : 'بانتظار تعميد المنظم'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        {/* Pay Installment Button */}
        {userProgress.isCompleted ? (
          <button
            type="button"
            onClick={() =>
              showToast(
                `تهانينا! لقد أتممت سداد كامل الأقساط المقررة في جمعية "${circle.title}" بنجاح (${userProgress.totalRequiredInstallments} من ${userProgress.totalRequiredInstallments} قسط). لا توجد أقساط متبقية عليك.`
              )
            }
            className="w-full h-12 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified
            </span>
            <span>تم إكمال سداد كامل الأقساط المقررة (١٠٠% مكتمل ومعمد) 🏆</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onPayDue(circle)}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#2D6A4F] to-[#1e4735] hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#2D6A4F]/25 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">payments</span>
            <span>
              {circle.myPaymentStatus === 'under_review'
                ? 'متابعة إيصال السداد أو دفع قسط مقدّم ⏳'
                : circle.myPaymentStatus === 'paid'
                ? 'تم سداد قسط هذا الشهر (دفع قسط مقدّم إضافي)'
                : 'دفع القسط الشهري الآن (سداد عادي أو مقدّم)'}
            </span>
          </button>
        )}

        <button
          onClick={shareWhatsApp}
          className="w-full h-12 rounded-2xl bg-[#714a23] hover:bg-[#8c6239] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#714a23]/20 active:scale-95 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">share</span>
          <span>مشاركة كود الجمعية ({circle.code}) عبر واتساب</span>
        </button>

        {/* Admin Installment Approval Page Button: Appears ONLY to Organizer AND ONLY when receipts are uploaded */}
        {isCreator && circlePayments.length > 0 && (
          <button
            type="button"
            onClick={() => onNavigate('admin-approvals')}
            className="w-full h-12 rounded-2xl bg-[#ffdeae]/50 hover:bg-[#ffdeae]/80 border border-[#edbf76] text-[#714a23] font-black text-xs flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified_user
            </span>
            <span>
              فتح لوحة تعميد الأقساط الكاملة ({circlePayments.length} إيصال مرفوع) 👑
            </span>
          </button>
        )}

        {/* Edit Button: Strictly visible ONLY to Organizer/Creator */}
        {isCreator && (
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="w-full h-11 rounded-2xl bg-white border border-[#714a23] text-[#714a23] hover:bg-[#ffdeae]/20 font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">edit_note</span>
            <span>تعديل معلومات وتفاصيل الجمعية</span>
          </button>
        )}

        <button
          onClick={() => onNavigate('home')}
          className="w-full h-11 rounded-xl bg-[#ebe8e2] text-[#50453b] hover:text-[#1c1c18] font-bold text-xs transition-colors cursor-pointer"
        >
          العودة للرئيسية
        </button>
      </div>

      {/* Edit Circle Modal for Organizer / Creator */}
      {isCreator && (
        <EditCircleModal
          circle={circle}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveCircleEdit}
        />
      )}

      {/* Delete Confirmation Modal for Organizer (Only before confirmation) */}
      {isDeleteModalOpen && isCreator && !circle.isConfirmedByAdmin && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-red-200 flex flex-col gap-3.5 text-right animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>

            <div className="text-center">
              <h3 className="text-sm font-black text-[#1c1c18]">تأكيد حذف الجمعية نهائياً؟</h3>
              <p className="text-xs text-[#50453b] mt-1 leading-relaxed">
                هل أنت متأكد من حذف جمعية &quot;{circle.title}&quot;؟ سيتم إزالة الجمعية بالكامل من قاعدة البيانات ولن يتمكن أي مشترك من الوصول إليها.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#f0eee8]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteCircle}
                className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? (
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-base">delete</span>
                )}
                <span>نعم، حذف الجمعية</span>
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 h-11 bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#50453b] rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cap at Current Shares */}
      {isCapSharesModalOpen && isCreator && !circle.isConfirmedByAdmin && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-[#edbf76] flex flex-col gap-3.5 text-right animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-[#ffdeae] text-[#714a23] flex items-center justify-center mx-auto shadow-inner">
              <span className="material-symbols-outlined text-2xl">tune</span>
            </div>

            <div className="text-center">
              <h3 className="text-sm font-black text-[#1c1c18]">
                تأكيد الاكتفاء بالأسهم الحالية ({allocatedShares} سهم)؟
              </h3>
              <p className="text-xs text-[#50453b] mt-1.5 leading-relaxed">
                سيتم ضبط إجمالي أسهم وشهور الجمعية لتكون <strong>{allocatedShares} شهراً</strong> بدلاً من {totalShares} شهراً، وتصبح حصيلة الاستلام الشهري <strong>{(allocatedShares * sharePrice).toLocaleString('ar-YE')} {circle.currencySymbol}</strong>. وسيتم إجراء القرعة وتوزيع الأدوار فوراً.
              </p>
            </div>

            <div className="p-3 bg-[#f6f3ed] rounded-xl text-xs space-y-1.5 border border-[#8c6239]/20">
              <div className="flex justify-between">
                <span className="text-[#50453b]">عدد الأسهم الجديد:</span>
                <span className="font-bold text-[#1c1c18]">{allocatedShares} سهم</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#50453b]">مدة الجمعية:</span>
                <span className="font-bold text-[#1c1c18]">{allocatedShares} أشهر</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#50453b]">استلام المستفيد شهرياً:</span>
                <span className="font-bold text-[#714a23]">{(allocatedShares * sharePrice).toLocaleString('ar-YE')} {circle.currencySymbol}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#f0eee8]">
              <button
                type="button"
                disabled={isCapping}
                onClick={handleCapCurrentShares}
                className="flex-1 h-11 bg-[#714a23] hover:bg-[#8c6239] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
              >
                {isCapping ? (
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-base">check</span>
                )}
                <span>تأكيد واعتماد الأسهم</span>
              </button>

              <button
                type="button"
                disabled={isCapping}
                onClick={() => setIsCapSharesModalOpen(false)}
                className="px-4 h-11 bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#50453b] rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Preview Uploaded Receipt as Image or PDF directly inside CircleDetailView */}
      {previewPayment && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 text-right"
          dir="rtl"
          onClick={() => setPreviewPayment(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#e5e2dc] flex flex-col max-h-[92vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-[#fcf9f3] border-b border-[#e5e2dc] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#ffdeae] text-[#714a23] flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">receipt_long</span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#1c1c18]">
                    معاينة إيصال: {previewPayment.payerName}
                  </h3>
                  <span className="text-[10px] text-[#50453b] font-mono" dir="ltr">
                    {previewPayment.trxId}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewPayment.receiptFileType !== 'pdf' &&
                  !previewPayment.receiptFileName?.toLowerCase().endsWith('.pdf') && (
                    <div className="flex items-center bg-[#f0eee8] rounded-xl p-1 gap-1">
                      <button
                        type="button"
                        onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                        className="w-7 h-7 rounded-lg bg-white text-[#714a23] text-xs font-bold flex items-center justify-center hover:bg-[#ffdeae]/40 cursor-pointer shadow-xs"
                      >
                        +
                      </button>
                      <span className="text-[10px] font-sans font-bold px-1 text-[#50453b]">
                        {Math.round(zoomLevel * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                        className="w-7 h-7 rounded-lg bg-white text-[#714a23] text-xs font-bold flex items-center justify-center hover:bg-[#ffdeae]/40 cursor-pointer shadow-xs"
                      >
                        -
                      </button>
                    </div>
                  )}

                <button
                  type="button"
                  onClick={() => setPreviewPayment(null)}
                  className="w-8 h-8 rounded-full bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#50453b] flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {/* Body: Image or PDF Viewer */}
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center bg-[#f6f3ed]/60 min-h-[280px]">
              {previewPayment.receiptFileType === 'pdf' ||
              previewPayment.receiptFileName?.toLowerCase().endsWith('.pdf') ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <div className="w-full bg-white rounded-2xl overflow-hidden border border-[#e5e2dc] shadow-sm">
                    {previewPayment.receiptImageData ? (
                      <iframe
                        src={previewPayment.receiptImageData}
                        title="مستند الإيصال PDF"
                        className="w-full h-[380px] border-0"
                      />
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-red-600">picture_as_pdf</span>
                        <p className="text-xs font-bold text-[#1c1c18]">{previewPayment.receiptFileName}</p>
                        <p className="text-[11px] text-[#50453b]">{previewPayment.receiptFileSize}</p>
                      </div>
                    )}
                  </div>
                  {previewPayment.receiptImageData && (
                    <a
                      href={previewPayment.receiptImageData}
                      download={previewPayment.receiptFileName || 'receipt.pdf'}
                      className="px-4 py-2 rounded-xl bg-[#714a23] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 hover:bg-[#8c6239]"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      <span>تحميل مستند PDF</span>
                    </a>
                  )}
                </div>
              ) : previewPayment.receiptImageData ? (
                <div className="w-full flex justify-center overflow-auto p-2">
                  <img
                    src={previewPayment.receiptImageData}
                    alt="صورة إيصال السداد"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                    className="max-h-[400px] max-w-full rounded-2xl object-contain border border-[#e5e2dc] shadow-md transition-transform duration-200"
                  />
                </div>
              ) : (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-dashed border-[#d4c3b7]">
                  <span className="material-symbols-outlined text-4xl text-[#8c6239]">receipt</span>
                  <p className="text-xs font-bold text-[#1c1c18]">{previewPayment.receiptFileName}</p>
                  <p className="text-[11px] text-[#50453b]">{previewPayment.receiptFileSize}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-[#e5e2dc] flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs bg-[#f6f3ed] p-2.5 rounded-xl">
                <span>
                  المبلغ: <strong className="text-[#714a23] font-sans">{previewPayment.amount.toLocaleString('ar-YE')} {previewPayment.currencySymbol}</strong>
                </span>
                <span>
                  عدد الأقساط: <strong>{previewPayment.advanceMonths || 1} شهر</strong>
                </span>
              </div>

              {previewPayment.status === 'under_review' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={approvingPaymentId !== null}
                    onClick={() => {
                      const paymentToApprove = previewPayment;
                      setPreviewPayment(null);
                      handleApproveReceipt(paymentToApprove);
                    }}
                    className="flex-1 h-11 rounded-xl bg-[#2D6A4F] hover:bg-[#23533e] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">verified</span>
                    <span>تعميد هذا القسط واعتماده فوراً ✓</span>
                  </button>

                  <button
                    type="button"
                    disabled={approvingPaymentId !== null}
                    onClick={() => {
                      const paymentToReject = previewPayment;
                      setPreviewPayment(null);
                      handleRejectReceipt(paymentToReject);
                    }}
                    className="px-4 h-11 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold shadow-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                    <span>رفض الإيصال</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
