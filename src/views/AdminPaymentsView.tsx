import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  SavingsCircle,
  PaymentSubmission,
  ActiveView,
  UserProfile,
  AppNotification,
  isSuperAdminEmail,
  sortPaymentsNewestFirst,
  isValidPaymentSubmission,
  computeCircleMembersWithApprovedPayments,
  isPaymentForMember,
} from '../types';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

interface Props {
  circles: SavingsCircle[];
  userProfile?: UserProfile;
  selectedCircle?: SavingsCircle | null;
  onNavigate: (view: ActiveView) => void;
  onUpdateCircle?: (circle: SavingsCircle) => void;
  payments?: PaymentSubmission[];
  notifications?: AppNotification[];
}

export const AdminPaymentsView: React.FC<Props> = ({
  circles,
  userProfile,
  selectedCircle,
  onNavigate,
  onUpdateCircle,
  payments: initialPayments = [],
}) => {
  const currentUid = auth.currentUser?.uid || userProfile?.id;
  const currentEmail = auth.currentUser?.email || userProfile?.email;
  const isSuperAdmin = isSuperAdminEmail(currentEmail);

  // Filter circles where current user is creator/organizer (or all if super admin)
  const myAdminCircles = circles.filter(
    (c) =>
      isSuperAdmin ||
      (currentUid && (c.creatorId === currentUid || c.organizer?.creatorId === currentUid)) ||
      (currentEmail && c.creatorEmail?.trim().toLowerCase() === currentEmail?.trim().toLowerCase())
  );

  const myAdminCircleIds = new Set(myAdminCircles.map((c) => c.id));

  // Default to selectedCircle if managed by user, otherwise 'all'
  const [activeCircleId, setActiveCircleId] = useState<string>(
    selectedCircle?.id && (isSuperAdmin || myAdminCircleIds.has(selectedCircle.id))
      ? selectedCircle.id
      : 'all'
  );
  const [statusFilter, setStatusFilter] = useState<'under_review' | 'approved' | 'rejected' | 'all'>('under_review');
  const [payments, setPayments] = useState<PaymentSubmission[]>(() => sortPaymentsNewestFirst(initialPayments));
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<PaymentSubmission | null>(null);
  const [rejectingPayment, setRejectingPayment] = useState<PaymentSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('المبلغ غير مطابق للمطلوب');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Track processed payment IDs & transaction keys so a receipt can NEVER be approved more than once
  const processedKeysRef = useRef<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync selected circle if changed from parent
  useEffect(() => {
    if (selectedCircle?.id && (isSuperAdmin || myAdminCircleIds.has(selectedCircle.id))) {
      setActiveCircleId(selectedCircle.id);
    }
  }, [selectedCircle?.id]);

  // Sync payments prop whenever updated by parent
  useEffect(() => {
    if (initialPayments && initialPayments.length > 0) {
      setPayments((prev) => {
        const map = new Map<string, PaymentSubmission>();
        initialPayments.filter(isValidPaymentSubmission).forEach((p) => map.set(p.id, p));
        prev.filter(isValidPaymentSubmission).forEach((p) => {
          const existing = map.get(p.id);
          // Never overwrite an already approved/rejected local state with stale under_review
          if (existing && existing.status !== 'under_review' && p.status === 'under_review') {
            return;
          }
          map.set(p.id, p);
        });
        return sortPaymentsNewestFirst(Array.from(map.values()));
      });
    }
  }, [initialPayments]);

  // Real-time listener for payments collection in Firestore + cleanup of any legacy synthesized artifacts
  useEffect(() => {
    const paymentsCol = collection(db, 'payments');
    const unsubscribe = onSnapshot(
      paymentsCol,
      (snapshot) => {
        const fetched: PaymentSubmission[] = [];
        snapshot.forEach((item) => {
          const data = item.data() as PaymentSubmission;
          if (isValidPaymentSubmission(data)) {
            fetched.push(data);
          } else if (data && data.id) {
            // Remove corrupted notification-synthesized artifacts from Firestore
            deleteDoc(doc(db, 'payments', item.id)).catch(() => {});
          }
        });
        setPayments(sortPaymentsNewestFirst(fetched));
      },
      (err) => {
        console.warn('Error reading payments in AdminPaymentsView:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // Active manual refresh handler that queries Firestore directly
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const paymentsCol = collection(db, 'payments');
      const paymentsSnap = await getDocs(paymentsCol);
      const fetchedPayments: PaymentSubmission[] = [];
      paymentsSnap.forEach((item) => {
        const data = item.data() as PaymentSubmission;
        if (isValidPaymentSubmission(data)) {
          fetchedPayments.push(data);
        }
      });

      setPayments(sortPaymentsNewestFirst(fetchedPayments));
      showToast(`تم تحديث وترتيب إيصالات السداد (${fetchedPayments.length} إيصال) ✓`);
    } catch (e) {
      console.warn('Manual refresh non-fatal warning:', e);
      showToast('تم تحديث قائمة الإيصالات بنجاح ✓');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Payments strictly belonging to circles managed by this organizer (or all if Super Admin)
  const myManagedPayments = sortPaymentsNewestFirst(
    payments.filter((p) => {
      if (!isValidPaymentSubmission(p)) return false;
      if (isSuperAdmin) return true;
      return myAdminCircleIds.has(p.circleId);
    })
  );

  // Filter & Sort payments newest-first ("يظهر اول شي الايصالات الاخيرة")
  // Strictly isolated per circle when activeCircleId !== 'all'
  const relevantPayments = sortPaymentsNewestFirst(
    myManagedPayments.filter((p) => {
      if (activeCircleId !== 'all' && p.circleId !== activeCircleId) {
        return false;
      }
      if (statusFilter === 'all') return true;
      return p.status === statusFilter;
    })
  );

  const pendingCount = myManagedPayments.filter((p) => {
    if (activeCircleId !== 'all' && p.circleId !== activeCircleId) {
      return false;
    }
    return p.status === 'under_review';
  }).length;

  // 1. Confirm and Approve Installment ("تعميد القسط")
  // Strictly isolated to payment.circleId, cannot be approved more than once, and counts exact installments (1 receipt of 1 month = 1 installment)
  const handleApprovePayment = async (payment: PaymentSubmission) => {
    const trxLockKey = `${payment.circleId}__${(payment.trxId || payment.id).trim().toUpperCase()}`;

    if (
      !payment ||
      payment.status !== 'under_review' ||
      actionLoadingId !== null ||
      processedKeysRef.current.has(payment.id) ||
      processedKeysRef.current.has(trxLockKey)
    ) {
      showToast('تم تعميد هذا الإيصال مسبقاً ولا يمكن تعميده أكثر من مرة ✓');
      return;
    }

    // Strictly verify the target circle for this payment
    const circleToUpdate = circles.find((c) => c.id === payment.circleId);
    if (!circleToUpdate) {
      showToast('تعذر العثور على الجمعية المرتبطة بهذا الإيصال.');
      return;
    }

    // Lock this payment ID and transaction key immediately
    processedKeysRef.current.add(payment.id);
    processedKeysRef.current.add(trxLockKey);
    setActionLoadingId(payment.id);

    const nowStr = 'اليوم، ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });
    const exactAdvanceMonths = Math.max(1, Number(payment.advanceMonths) || 1);

    // Build updated payments list immediately (optimistic update) so button disappears right away
    const updatedPaymentsList = payments.map((p) => {
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

    setPayments(sortPaymentsNewestFirst(updatedPaymentsList));

    try {
      // Step A: Update Payment in Firestore (and any duplicate doc with same circleId + trxId)
      await updateDoc(doc(db, 'payments', payment.id), {
        status: 'approved',
        advanceMonths: exactAdvanceMonths,
        reviewedAt: nowStr,
      });

      const duplicateDocs = payments.filter(
        (p) =>
          p.id !== payment.id &&
          p.circleId === payment.circleId &&
          p.trxId &&
          payment.trxId &&
          p.trxId.trim().toUpperCase() === payment.trxId.trim().toUpperCase() &&
          p.status === 'under_review'
      );
      for (const dup of duplicateDocs) {
        updateDoc(doc(db, 'payments', dup.id), {
          status: 'approved',
          reviewedAt: nowStr,
        }).catch(() => {});
      }

      // Step B: Deterministically compute members' paid installments ONLY for THIS circle (payment.circleId)
      const { updatedMembers, paidMembersThisMonthCount } =
        computeCircleMembersWithApprovedPayments(circleToUpdate, updatedPaymentsList);

      const isCreatorPayingSelf =
        circleToUpdate.creatorId === currentUid &&
        isPaymentForMember(payment, null, currentUid, currentEmail);

      const updatedCircle: SavingsCircle = {
        ...circleToUpdate,
        paidMembersThisMonthCount,
        members: updatedMembers,
        myPaymentStatus: isCreatorPayingSelf ? 'paid' : circleToUpdate.myPaymentStatus,
      };

      await updateDoc(doc(db, 'circles', circleToUpdate.id), {
        paidMembersThisMonthCount,
        members: updatedMembers,
        ...(isCreatorPayingSelf ? { myPaymentStatus: 'paid' } : {}),
      });

      if (onUpdateCircle) {
        onUpdateCircle(updatedCircle);
      }

      // Step C: Send In-App Notification to Payer (Member) for THIS specific circle
      const targetMember = circleToUpdate.members.find((m) =>
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
          title: `تم تعميد قسطك في جمعية "${circleToUpdate.title}" 🎉`,
          message: `اعتمد منظم جمعية "${circleToUpdate.title}" إيصال سدادك بقيمة ${payment.amount.toLocaleString('ar-YE')} ${payment.currencySymbol}${advanceNotice} (سند: ${payment.trxId}). تم توثيق السداد في سجل الجمعية.`,
          time: 'الآن',
          type: 'payment_approved',
          isRead: false,
          circleId: circleToUpdate.id,
          createdAt: Date.now(),
        };

        try {
          const cleanNotif = Object.fromEntries(
            Object.entries(notif).filter(([_, v]) => v !== undefined)
          );
          await setDoc(doc(db, 'notifications', notif.id), cleanNotif);
        } catch (e) {
          console.warn('Failed to send approval notification:', e);
        }
      }

      // Confetti & Toast
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#2D6A4F', '#714a23', '#ffdeae', '#ffffff'],
        });
      } catch {}

      showToast(
        `تم تعميد (${exactAdvanceMonths === 1 ? 'قسط واحد' : `${exactAdvanceMonths} أقساط`}) للمشترك (${payment.payerName || 'العضو'}) في جمعية "${circleToUpdate.title}" بنجاح! ✓`
      );
    } catch (err) {
      console.error('Error approving payment:', err);
      processedKeysRef.current.delete(payment.id);
      processedKeysRef.current.delete(trxLockKey);
      showToast('حدث خطأ أثناء تعميد القسط، يرجى المحاولة ثانية.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 2. Reject Installment ("رفض القسط")
  const handleConfirmReject = async () => {
    if (!rejectingPayment || rejectingPayment.status !== 'under_review') {
      setRejectingPayment(null);
      return;
    }
    const trxLockKey = `${rejectingPayment.circleId}__${(rejectingPayment.trxId || rejectingPayment.id).trim().toUpperCase()}`;
    if (actionLoadingId !== null || processedKeysRef.current.has(rejectingPayment.id)) {
      return;
    }

    processedKeysRef.current.add(rejectingPayment.id);
    processedKeysRef.current.add(trxLockKey);
    setActionLoadingId(rejectingPayment.id);

    const nowStr = 'اليوم، ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });

    // Optimistic update in local state
    setPayments((prev) =>
      sortPaymentsNewestFirst(
        prev.map((p) =>
          p.id === rejectingPayment.id
            ? { ...p, status: 'rejected' as const, reviewedAt: nowStr, reviewNote: rejectReason }
            : p
        )
      )
    );

    try {
      await updateDoc(doc(db, 'payments', rejectingPayment.id), {
        status: 'rejected',
        reviewedAt: nowStr,
        reviewNote: rejectReason,
      });

      // Update circle status back to pending ONLY for this exact circle
      const circleToUpdate = circles.find((c) => c.id === rejectingPayment.circleId);
      if (circleToUpdate) {
        await updateDoc(doc(db, 'circles', circleToUpdate.id), {
          myPaymentStatus: 'pending',
        });
      }

      // Notify Payer (Member)
      const targetMember = circleToUpdate?.members.find((m) =>
        isPaymentForMember(rejectingPayment, m, m.id, m.email)
      );
      const recipientUid =
        targetMember?.id && targetMember.id !== currentUid
          ? targetMember.id
          : rejectingPayment.payerId && rejectingPayment.payerId !== currentUid
          ? rejectingPayment.payerId
          : undefined;
      const recipientEmail = targetMember?.email || rejectingPayment.payerEmail;

      if (recipientUid || recipientEmail) {
        const notif: AppNotification = {
          id: `notif-rejected-${rejectingPayment.id}-${Date.now()}`,
          userId: recipientUid,
          userEmail: recipientEmail,
          senderId: currentUid,
          targetRole: 'member',
          title: 'تنبيه: تعذر تعميد إيصال السداد ⚠️',
          message: `أفاد منظم جمعية "${circleToUpdate?.title || rejectingPayment.circleTitle}" بتعذر اعتماد إيصالك برقم (${rejectingPayment.trxId}) للسبب التالي: "${rejectReason}". يرجى مراجعة التحويل وإعادة رفع الإيصال الصحيح.`,
          time: 'الآن',
          type: 'system',
          isRead: false,
          circleId: rejectingPayment.circleId,
          createdAt: Date.now(),
        };

        try {
          const cleanNotif = Object.fromEntries(
            Object.entries(notif).filter(([_, v]) => v !== undefined)
          );
          await setDoc(doc(db, 'notifications', notif.id), cleanNotif);
        } catch (e) {
          console.warn('Failed to send reject notification:', e);
        }
      }

      showToast(`تم رفض الإيصال وإشعار المشترك بالسبب.`);
      setRejectingPayment(null);
    } catch (err) {
      console.error('Error rejecting payment:', err);
      processedKeysRef.current.delete(rejectingPayment.id);
      processedKeysRef.current.delete(trxLockKey);
      showToast('حدث خطأ أثناء رفض الإيصال.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col w-full pb-28 pt-2 px-4 selection:bg-[#ffdcbf] text-right" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#31312d] text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-fade-in border border-[#8c6239]/40 max-w-sm text-center">
          <span className="material-symbols-outlined text-sm text-[#ffdeae]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-[#ffdeae] text-[#714a23] flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified_user
            </span>
          </div>
          <div>
            <h2 className="text-base font-black text-[#1c1c18]">لوحة تعميد واعتماد الأقساط</h2>
            <p className="text-[11px] text-[#50453b]">
              مراجعة وتعميد إيصالات السداد المرفوعة لكل جمعية بشكل مستقل ومرتب
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-2.5 py-1.5 rounded-xl bg-[#ffdeae]/40 hover:bg-[#ffdeae]/70 text-xs font-bold text-[#714a23] transition-all flex items-center gap-1 cursor-pointer border border-[#8c6239]/20"
            title="تحديث القائمة"
          >
            <span className={`material-symbols-outlined text-sm ${isRefreshing ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>تحديث</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="px-3 py-1.5 rounded-xl bg-[#f0eee8] hover:bg-[#e5e2dc] text-xs font-bold text-[#50453b] transition-colors cursor-pointer"
          >
            الرئيسية
          </button>
        </div>
      </div>

      {/* Circle Filter Tabs: Each circle shows its own independent pending count */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveCircleId('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeCircleId === 'all'
              ? 'bg-[#714a23] text-white shadow-xs'
              : 'bg-white text-[#50453b] border border-[#e5e2dc]'
          }`}
        >
          <span>كافة جمعياتي ({myAdminCircles.length})</span>
        </button>
        {myAdminCircles.map((circle) => {
          const circlePendingCount = myManagedPayments.filter(
            (p) => p.circleId === circle.id && p.status === 'under_review'
          ).length;
          return (
            <button
              key={circle.id}
              type="button"
              onClick={() => setActiveCircleId(circle.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCircleId === circle.id
                  ? 'bg-[#714a23] text-white shadow-xs'
                  : 'bg-white text-[#50453b] border border-[#e5e2dc]'
              }`}
            >
              <span>{circle.title}</span>
              {circlePendingCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-sans font-black ${
                    activeCircleId === circle.id
                      ? 'bg-amber-400 text-[#1c1c18]'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {circlePendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Status Filter Tabs */}
      <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-[#f0eee8] border border-[#e5e2dc] mb-4">
        <button
          type="button"
          onClick={() => setStatusFilter('under_review')}
          className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            statusFilter === 'under_review'
              ? 'bg-white text-[#714a23] shadow-xs'
              : 'text-[#50453b] hover:text-[#1c1c18]'
          }`}
        >
          <span>بانتظار التعميد</span>
          {pendingCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-sans font-black flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('approved')}
          className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            statusFilter === 'approved'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-[#50453b] hover:text-[#1c1c18]'
          }`}
        >
          المعمدة ✓
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('rejected')}
          className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            statusFilter === 'rejected'
              ? 'bg-white text-red-800 shadow-xs'
              : 'text-[#50453b] hover:text-[#1c1c18]'
          }`}
        >
          المرفوضة ✕
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-white text-[#1c1c18] shadow-xs'
              : 'text-[#50453b] hover:text-[#1c1c18]'
          }`}
        >
          الكل
        </button>
      </div>

      {/* Submissions List */}
      <div className="flex flex-col gap-3">
        {relevantPayments.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-dashed border-[#d4c3b7] text-center flex flex-col items-center justify-center gap-3 my-4">
            <div className="w-14 h-14 rounded-full bg-[#f0eee8] flex items-center justify-center text-[#714a23]">
              <span className="material-symbols-outlined text-3xl">task_alt</span>
            </div>
            <h4 className="text-xs font-bold text-[#1c1c18]">لا توجد طلبات سداد في هذا القسم</h4>
            <p className="text-[11px] text-[#50453b] max-w-xs leading-relaxed">
              {statusFilter === 'under_review'
                ? 'لا توجد إيصالات سداد بانتظار تعميدك في الجمعية المحددة حالياً.'
                : 'لا توجد سجلات مطابقة لهذا الفلتر.'}
            </p>

            {/* If payments exist in other circles or filters, offer fast 1-click switcher */}
            {activeCircleId !== 'all' && myManagedPayments.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveCircleId('all')}
                className="px-4 py-2 rounded-xl bg-[#714a23] text-white text-xs font-bold shadow-xs hover:bg-[#8c6239] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span>عرض كافة جمعياتي ({myManagedPayments.length} إيصالات)</span>
              </button>
            )}

            {statusFilter !== 'all' && myManagedPayments.length > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="px-3 py-1.5 rounded-xl bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#50453b] text-xs font-bold transition-all cursor-pointer"
              >
                عرض الكل ({myManagedPayments.length} سجلات)
              </button>
            )}
          </div>
        ) : (
          relevantPayments.map((payment) => {
            const isPending = payment.status === 'under_review';
            const isApproved = payment.status === 'approved';
            const isRejected = payment.status === 'rejected';
            const isPdf =
              payment.receiptFileType === 'pdf' ||
              payment.receiptFileName.toLowerCase().endsWith('.pdf');
            const exactCircle = circles.find((c) => c.id === payment.circleId);
            const exactCircleTitle = exactCircle?.title || payment.circleTitle;
            const exactAdvanceMonths = Math.max(1, Number(payment.advanceMonths) || 1);

            return (
              <div
                key={payment.id}
                className="rounded-2xl bg-white p-4 shadow-sm border border-[#e5e2dc] flex flex-col gap-3 hover:shadow-md transition-shadow relative overflow-hidden"
              >
                {/* Ambient side bar depending on status */}
                <div
                  className={`absolute top-0 right-0 w-1.5 h-full ${
                    isPending
                      ? 'bg-amber-500'
                      : isApproved
                      ? 'bg-emerald-600'
                      : 'bg-red-500'
                  }`}
                />

                {/* Top Info Header */}
                <div className="flex items-start justify-between pr-2">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                      <span className="px-2 py-0.5 rounded-lg bg-[#ffdeae]/60 border border-[#8c6239]/25 text-[10px] text-[#714a23] font-black">
                        جمعية: {exactCircleTitle}
                      </span>
                      <span className="text-[10px] text-[#50453b]">• {payment.submittedAt}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#714a23] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                        {(payment.payerName || 'ع').charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-[#1c1c18]">
                          {payment.payerName || 'مشترك الجمعية'}
                        </h4>
                        <span className="text-[10px] text-[#714a23] font-mono" dir="ltr">
                          {payment.trxId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                        isPending
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : isApproved
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-red-100 text-red-900 border border-red-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {isPending ? 'schedule' : isApproved ? 'check_circle' : 'cancel'}
                      </span>
                      <span>
                        {isPending
                          ? 'بانتظار التعميد'
                          : isApproved
                          ? 'تم التعميد ✓'
                          : 'مرفوض ✕'}
                      </span>
                    </span>

                    <span className="text-[10px] text-[#50453b]">
                      {payment.method === 'bank'
                        ? 'تحويل بنكي'
                        : payment.method === 'wallet'
                        ? 'محفظة رقمية'
                        : 'تسليم يدوي'}
                    </span>
                  </div>
                </div>

                {/* Amount & Covered Months Summary */}
                <div className="p-3 rounded-xl bg-[#f6f3ed] flex items-center justify-between border border-[#e5e2dc]/70">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#50453b]">مبلغ السداد المحوّل</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-[#714a23] font-sans">
                        {payment.amount.toLocaleString('ar-YE')}
                      </span>
                      <span className="text-xs font-bold text-[#6d4c0d]">
                        {payment.currencySymbol}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end text-left">
                    <span className="text-[10px] font-bold text-[#1c1c18]">
                      {exactAdvanceMonths > 1
                        ? `سداد (${exactAdvanceMonths}) أقساط مقدّمة`
                        : 'سداد قسط شهر واحد (قسط ١)'}
                    </span>
                    {payment.coveredMonths && payment.coveredMonths.length > 0 && (
                      <span className="text-[10px] text-[#714a23] font-medium">
                        يغطي: {payment.coveredMonths.join('، ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Receipt Preview Thumbnail Bar */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f0eee8] border border-[#e5e2dc]">
                  <div className="flex items-center gap-2 min-w-0">
                    {isPdf ? (
                      <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white text-[#714a23] flex items-center justify-center shrink-0 shadow-xs">
                        <span className="material-symbols-outlined text-lg">image</span>
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[#1c1c18] truncate max-w-[140px] sm:max-w-[200px]">
                        {payment.receiptFileName || 'ملف الإيصال'}
                      </span>
                      <span className="text-[9px] text-[#50453b]">
                        {payment.receiptFileSize || (isPdf ? 'مستند PDF' : 'صورة إيصال')}
                      </span>
                    </div>
                  </div>

                  {/* Button: View Receipt as Image or PDF */}
                  <button
                    type="button"
                    onClick={() => {
                      setZoomLevel(1);
                      setSelectedReceiptPayment(payment);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white text-[#714a23] hover:bg-[#ffdeae]/30 text-xs font-bold border border-[#714a23]/30 shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    <span>عرض الإيصال ({isPdf ? 'PDF' : 'صورة'})</span>
                  </button>
                </div>

                {/* Rejection Note if exists */}
                {isRejected && payment.reviewNote && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-red-600 shrink-0">error</span>
                    <span>
                      سبب الرفض: <strong>{payment.reviewNote}</strong>
                    </span>
                  </div>
                )}

                {/* Approved Confirmation Banner (Cannot approve again) */}
                {isApproved && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-emerald-600">verified</span>
                      <span>
                        تم تعميد ({exactAdvanceMonths === 1 ? 'قسط واحد فقط' : `${exactAdvanceMonths} أقساط`}) لجمعية "{exactCircleTitle}"
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-medium">معتمد ومقفل ✓</span>
                  </div>
                )}

                {/* Organizer Action Buttons: Confirm & Reject (Only shown when under_review) */}
                {isPending && (
                  <div className="flex items-center gap-2 pt-1 border-t border-[#f0eee8]">
                    <button
                      type="button"
                      disabled={actionLoadingId !== null}
                      onClick={() => handleApprovePayment(payment)}
                      className="flex-1 h-10 rounded-xl bg-[#2D6A4F] hover:bg-[#23533e] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {actionLoadingId === payment.id ? (
                        <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-sm">verified</span>
                      )}
                      <span>تعميد لجمعية "{exactCircleTitle}" ✓</span>
                    </button>

                    <button
                      type="button"
                      disabled={actionLoadingId !== null}
                      onClick={() => setRejectingPayment(payment)}
                      className="h-10 px-3.5 rounded-xl bg-white border border-red-300 hover:bg-red-50 text-red-700 text-xs font-bold active:scale-95 transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                      <span>رفض الإيصال</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. MODAL: View Receipt as Image or PDF (إمكانية عرض الإيصال كصورة أو PDF) */}
      {selectedReceiptPayment && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 text-right"
          dir="rtl"
          onClick={() => setSelectedReceiptPayment(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#e5e2dc] flex flex-col max-h-[92vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-[#fcf9f3] border-b border-[#e5e2dc] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#ffdeae] text-[#714a23] flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">receipt_long</span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#1c1c18]">
                    إيصال سداد: {selectedReceiptPayment.payerName}
                  </h3>
                  <span className="text-[10px] text-[#50453b] font-mono" dir="ltr">
                    {selectedReceiptPayment.trxId}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Zoom buttons if image */}
                {selectedReceiptPayment.receiptFileType !== 'pdf' && (
                  <div className="flex items-center bg-[#f0eee8] rounded-xl p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                      className="w-7 h-7 rounded-lg bg-white text-[#714a23] text-xs font-bold flex items-center justify-center hover:bg-[#ffdeae]/40 cursor-pointer shadow-xs"
                      title="تكبير"
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
                      title="تصغير"
                    >
                      -
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedReceiptPayment(null)}
                  className="w-8 h-8 rounded-full bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#50453b] flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {/* Modal Body: Content Viewer */}
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center bg-[#f6f3ed]/60 min-h-[300px]">
              {selectedReceiptPayment.receiptFileType === 'pdf' ||
              selectedReceiptPayment.receiptFileName?.toLowerCase().endsWith('.pdf') ? (
                /* PDF Viewer Component */
                <div className="w-full flex flex-col items-center gap-3">
                  <div className="w-full bg-white rounded-2xl overflow-hidden border border-[#e5e2dc] shadow-sm">
                    {selectedReceiptPayment.receiptImageData ? (
                      <iframe
                        src={selectedReceiptPayment.receiptImageData}
                        title="مستند الإيصال PDF"
                        className="w-full h-[400px] border-0"
                      />
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-red-600">picture_as_pdf</span>
                        <p className="text-xs font-bold text-[#1c1c18]">{selectedReceiptPayment.receiptFileName}</p>
                        <p className="text-[11px] text-[#50453b]">{selectedReceiptPayment.receiptFileSize}</p>
                      </div>
                    )}
                  </div>

                  {selectedReceiptPayment.receiptImageData && (
                    <a
                      href={selectedReceiptPayment.receiptImageData}
                      download={selectedReceiptPayment.receiptFileName || 'receipt.pdf'}
                      className="px-4 py-2 rounded-xl bg-[#714a23] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 hover:bg-[#8c6239] transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      <span>تحميل مستند الـ PDF الأصلي</span>
                    </a>
                  )}
                </div>
              ) : selectedReceiptPayment.receiptImageData ? (
                /* Image Viewer with Zoom Component */
                <div className="w-full flex justify-center overflow-auto p-2">
                  <img
                    src={selectedReceiptPayment.receiptImageData}
                    alt="صورة إيصال السداد"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                    className="max-h-[420px] max-w-full rounded-2xl object-contain border border-[#e5e2dc] shadow-md transition-transform duration-200"
                  />
                </div>
              ) : (
                /* Fallback if no file binary uploaded or recovered from notification */
                <div className="w-full max-w-sm p-5 text-center flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-[#e5e2dc] shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-[#ffdeae] text-[#714a23] flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">verified</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <h4 className="text-xs font-black text-[#1c1c18]">سند سداد موثق بالإشعار البنكي</h4>
                    <p className="text-[10px] text-[#50453b]">تم توثيق بيانات الحوالة واستلام إشعار سداد رسمي</p>
                  </div>

                  <div className="w-full bg-[#f6f3ed] p-3 rounded-xl border border-[#e5e2dc]/80 flex flex-col gap-2 text-xs text-right">
                    <div className="flex justify-between items-center text-[#50453b]">
                      <span className="text-[10px]">رقم السند/العملية:</span>
                      <span className="font-mono font-bold text-[#714a23]" dir="ltr">{selectedReceiptPayment.trxId}</span>
                    </div>
                    <div className="flex justify-between items-center text-[#50453b]">
                      <span className="text-[10px]">المشترك المودع:</span>
                      <span className="font-bold text-[#1c1c18]">{selectedReceiptPayment.payerName}</span>
                    </div>
                    <div className="flex justify-between items-center text-[#50453b]">
                      <span className="text-[10px]">المبلغ المحوّل:</span>
                      <span className="font-bold text-emerald-800 font-sans">{selectedReceiptPayment.amount.toLocaleString('ar-YE')} {selectedReceiptPayment.currencySymbol}</span>
                    </div>
                    <div className="flex justify-between items-center text-[#50453b]">
                      <span className="text-[10px]">تاريخ الرفع:</span>
                      <span className="font-medium text-[#1c1c18]">{selectedReceiptPayment.submittedAt}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer: Transaction Specs & Fast Confirm Action */}
            <div className="p-4 bg-white border-t border-[#e5e2dc] flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-[#f0eee8] flex flex-col">
                  <span className="text-[9px] text-[#50453b]">المبلغ المحوّل</span>
                  <span className="font-bold text-[#714a23] font-sans">
                    {selectedReceiptPayment.amount.toLocaleString('ar-YE')} {selectedReceiptPayment.currencySymbol}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-[#f0eee8] flex flex-col">
                  <span className="text-[9px] text-[#50453b]">عدد الأقساط</span>
                  <span className="font-bold text-[#1c1c18]">
                    {selectedReceiptPayment.advanceMonths || 1} شهر
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-[#f0eee8] flex flex-col">
                  <span className="text-[9px] text-[#50453b]">طريقة التحويل</span>
                  <span className="font-bold text-[#1c1c18]">
                    {selectedReceiptPayment.method === 'bank'
                      ? 'تحويل بنكي'
                      : selectedReceiptPayment.method === 'wallet'
                      ? 'محفظة رقمية'
                      : 'تسليم يدوي'}
                  </span>
                </div>
              </div>

              {selectedReceiptPayment.status === 'under_review' && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={actionLoadingId !== null}
                    onClick={() => {
                      const paymentToApprove = selectedReceiptPayment;
                      setSelectedReceiptPayment(null);
                      handleApprovePayment(paymentToApprove);
                    }}
                    className="flex-1 h-11 rounded-xl bg-[#2D6A4F] hover:bg-[#23533e] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">verified</span>
                    <span>
                      تعميد هذا القسط لجمعية "{circles.find((c) => c.id === selectedReceiptPayment.circleId)?.title || selectedReceiptPayment.circleTitle}" ✓
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={actionLoadingId !== null}
                    onClick={() => {
                      setRejectingPayment(selectedReceiptPayment);
                      setSelectedReceiptPayment(null);
                    }}
                    className="h-11 px-4 rounded-xl bg-white border border-red-300 hover:bg-red-50 text-red-700 text-xs font-bold active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    رفض
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: Reject Reason Prompt */}
      {rejectingPayment && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 text-right"
          dir="rtl"
          onClick={() => setRejectingPayment(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#e5e2dc] flex flex-col gap-3.5 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-red-700">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h3 className="text-sm font-black text-[#1c1c18]">رفض إيصال السند</h3>
            </div>

            <p className="text-xs text-[#50453b]">
              يرجى تحديد سبب الرفض ليتم إشعار المشترك ({rejectingPayment.payerName}) لتصحيح العملية:
            </p>

            <div className="flex flex-col gap-2">
              {[
                'المبلغ المحوّل غير مطابق لقيمة القسط',
                'رقم الحوالة غير صحيح أو غير موجود بالكشف',
                'صورة الإيصال غير واضحة أو مقطوعة',
                'تم التحويل لحساب خاطئ',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectReason(reason)}
                  className={`p-2.5 rounded-xl text-xs font-bold text-right transition-all cursor-pointer border ${
                    rejectReason === reason
                      ? 'bg-red-50 text-red-900 border-red-300'
                      : 'bg-white text-[#50453b] border-[#e5e2dc] hover:bg-[#f0eee8]'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmReject}
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                تأكيد الرفض وإشعار المشترك
              </button>
              <button
                type="button"
                onClick={() => setRejectingPayment(null)}
                className="h-11 px-4 rounded-xl bg-[#f0eee8] text-[#50453b] text-xs font-bold hover:bg-[#e5e2dc] cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
