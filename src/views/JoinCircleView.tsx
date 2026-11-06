import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { SavingsCircle, ActiveView, UserProfile, Member, AppNotification } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { assignCircleTurnsAutomatically } from '../utils/lotteryUtils';

interface Props {
  initialCode?: string;
  onCircleJoined: (joinedCircle: SavingsCircle, selectedTurn: number) => void;
  onNavigate: (view: ActiveView) => void;
  userProfile?: UserProfile;
  circles?: SavingsCircle[];
}

export const JoinCircleView: React.FC<Props> = ({
  initialCode = '',
  onCircleJoined,
  onNavigate,
  userProfile,
  circles = [],
}) => {
  const [code, setCode] = useState<string>(initialCode);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [foundCircle, setFoundCircle] = useState<SavingsCircle | null>(null);
  const [selectedShares, setSelectedShares] = useState<number>(1);
  const [selectedTurn, setSelectedTurn] = useState<number>(1);
  const [joiningState, setJoiningState] = useState<'idle' | 'joining' | 'success'>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const clean = text.trim().toUpperCase();
          setCode(clean);
          showToast('تم لصق الرمز بنجاح');
          handleVerify(clean);
        }
      }
    } catch {
      showToast('يرجى كتابة الرمز يدوياً');
    }
  };

  // Real Firestore query by unique circle code
  const handleVerify = async (codeToVerify?: string) => {
    const targetCode = (codeToVerify || code).trim().toUpperCase();
    if (!targetCode) {
      showToast('يرجى إدخال رمز الجمعية أولاً');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      // 1. Query Firestore circles collection where 'code' == targetCode
      const circlesRef = collection(db, 'circles');
      const q = query(circlesRef, where('code', '==', targetCode));
      const querySnapshot = await getDocs(q);

      let matchedCircle: SavingsCircle | null = null;

      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data() as SavingsCircle;
        matchedCircle = {
          ...docData,
          id: querySnapshot.docs[0].id,
        };
      } else {
        // Fallback: check locally loaded circles in case of case-insensitivity or active session
        const localMatch = circles.find(
          (c) => c.code.trim().toUpperCase() === targetCode
        );
        if (localMatch) {
          matchedCircle = localMatch;
        }
      }

      if (matchedCircle) {
        setFoundCircle(matchedCircle);
        setIsVerified(true);
        setSelectedShares(1);
        showToast('تم العثور على بيانات الجمعية بنجاح!');
      } else {
        setFoundCircle(null);
        setIsVerified(false);
        setSearchError(`لم يتم العثور على جمعية بالرمز "${targetCode}". تأكد من صحة الكود أو اطلب الرمز الصحيح من منشئ الجمعية.`);
      }
    } catch (err) {
      console.error('Error verifying circle code:', err);
      // Fallback to local check if query fails
      const localMatch = circles.find(
        (c) => c.code.trim().toUpperCase() === targetCode
      );
      if (localMatch) {
        setFoundCircle(localMatch);
        setIsVerified(true);
        showToast('تم العثور على الجمعية بنجاح!');
      } else {
        setSearchError('حدث خطأ أثناء فحص الكود. يرجى المحاولة مجدداً.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Metrics for the verified circle
  const totalShares = foundCircle?.sharesCount || foundCircle?.totalMonths || 30;
  const sharePrice = foundCircle?.sharePrice || foundCircle?.monthlyShare || 1000;
  const monthlyPayout = foundCircle?.monthlyPayout || sharePrice * totalShares;
  const currSymbol = foundCircle?.currencySymbol || 'ر.ي';

  // Calculate allocated vs remaining shares
  const allocatedShares = foundCircle
    ? foundCircle.members.reduce((acc, m) => acc + (m.sharesCount || 1), 0)
    : 0;
  const remainingShares = Math.max(0, totalShares - allocatedShares);
  const myMonthlyDue = selectedShares * sharePrice;

  // Confirm and Join real circle
  const handleConfirmJoin = async () => {
    if (!foundCircle) return;

    if (remainingShares <= 0) {
      showToast('عذراً، اكتملت جميع أسهم هذه الجمعية بالكامل!');
      return;
    }

    if (selectedShares > remainingShares) {
      showToast(`الأسهم المتبقية المتاحة هي ${remainingShares} فقط`);
      return;
    }

    setJoiningState('joining');

    const currentUid = userProfile?.id || auth.currentUser?.uid || `member-${Date.now()}`;
    const currentEmail = userProfile?.email || auth.currentUser?.email || '';
    const currentName = userProfile?.fullName || auth.currentUser?.displayName || 'مشترك جديد';
    const currentAvatar = userProfile?.avatar || auth.currentUser?.photoURL || '/assets/aistudio/image_94928b82.png';

    // Check if user is already a member
    const existingMemberIndex = foundCircle.members.findIndex(
      (m) =>
        m.id === currentUid ||
        (currentEmail && m.email && m.email.toLowerCase() === currentEmail.toLowerCase())
    );

    let updatedMembers: Member[] = [...foundCircle.members];

    if (existingMemberIndex >= 0) {
      // Increase existing member's shares
      const currentShares = updatedMembers[existingMemberIndex].sharesCount || 1;
      updatedMembers[existingMemberIndex] = {
        ...updatedMembers[existingMemberIndex],
        id: currentUid,
        email: currentEmail,
        sharesCount: currentShares + selectedShares,
        joinedViaCode: true,
      };
    } else {
      // Add new member who joined via code (unconfirmed until organizer confirms, unless circle is already confirmed)
      const newMember: Member = {
        id: currentUid,
        email: currentEmail,
        name: currentName.replace(/\(أنت\)|\(المنظم\)/g, '').trim(),
        phone: userProfile?.phone || '',
        avatar: currentAvatar,
        turnNumber: 0,
        payoutMonth: 'بانتظار تعميد المنظم',
        isPaidThisMonth: false,
        sharesCount: selectedShares,
        joinedViaCode: true,
        isConfirmed: Boolean(foundCircle.isConfirmedByAdmin),
      };
      updatedMembers.push(newMember);
    }

    const newAllocatedShares = allocatedShares + selectedShares;
    const isNowFull = newAllocatedShares >= totalShares;

    // Do NOT run lottery or assign turns here. Only the Organizer can conduct the lottery and confirm.
    let updatedCircle: SavingsCircle = {
      ...foundCircle,
      members: updatedMembers,
      membersCount: updatedMembers.length,
    };

    // Save updated circle into Firestore
    try {
      await updateDoc(doc(db, 'circles', updatedCircle.id), {
        members: updatedMembers,
        membersCount: updatedMembers.length,
      });
    } catch (err) {
      console.warn('Failed to save joined circle in Firestore:', err);
    }

    // Generate in-app notification for the circle organizer
    const organizerId = foundCircle.creatorId || foundCircle.organizer?.creatorId;
    const notifForOrganizer: AppNotification = {
      id: `notif-join-${Date.now()}`,
      userId: organizerId,
      userEmail: foundCircle.creatorEmail,
      senderId: currentUid,
      targetRole: 'organizer',
      title: `انضمام مشترك جديد بالكود في (${foundCircle.title}) 👥`,
      message: `انضم المشترك "${currentName}" عبر كود الدعوة بـ (${selectedShares} ${selectedShares === 1 ? 'سهم' : 'أسهم'}) وينتظر تعميدك له لتظهر له الجمعية. إجمالي الأسهم المحجوزة الآن: ${newAllocatedShares} من أصل ${totalShares} سهم.`,
      time: 'الآن',
      type: 'system',
      isRead: false,
      circleId: foundCircle.id,
      createdAt: Date.now(),
    };

    try {
      const cleanOrgNotif = Object.fromEntries(
        Object.entries(notifForOrganizer).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'notifications', notifForOrganizer.id), cleanOrgNotif);
    } catch (err) {
      console.warn('Failed to save join notification for organizer:', err);
    }

    // Confirmation notification for the member themselves
    const notifForMember: AppNotification = {
      id: `notif-member-join-${Date.now()}`,
      userId: currentUid,
      userEmail: currentEmail,
      senderId: currentUid,
      targetRole: 'member',
      title: `تم تسجيل حجزك بالكود في (${foundCircle.title}) 🌟`,
      message: `تم تسجيل حجزك لـ (${selectedShares} سهم). ستظهر لك الجمعية وجدول القرعة فور قيام المنظم بتعميد انضمامك.`,
      time: 'الآن',
      type: 'turn_alert',
      isRead: false,
      circleId: foundCircle.id,
      createdAt: Date.now(),
    };

    try {
      const cleanMemberNotif = Object.fromEntries(
        Object.entries(notifForMember).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'notifications', notifForMember.id), cleanMemberNotif);
    } catch (err) {
      console.warn('Failed to save member confirmation notification:', err);
    }

    setTimeout(() => {
      setJoiningState('success');
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#714a23', '#c89d58', '#2D6A4F', '#ffffff'],
        });
      } catch {
        // ignore
      }

      onCircleJoined(updatedCircle, updatedCircle.myTurnNumber || 1);

      if (foundCircle.isConfirmedByAdmin) {
        showToast(`تم انضمامك وتعميدك في الجمعية بنجاح (${selectedShares} سهم) ✓`);
      } else if (isNowFull) {
        showToast('🎉 تم تسجيل انضمامك بالكود واكتملت الأسهم! ستظهر لك الجمعية فور تعميد المنظم.');
      } else {
        showToast(`تم تسجيل انضمامك بالكود (${selectedShares} سهم) — بانتظار تعميد المنظم لتظهر لك الجمعية ✓`);
      }

      setTimeout(() => {
        onNavigate('home');
      }, 1600);
    }, 1000);
  };

  return (
    <div className="flex flex-col w-full pb-28 pt-2 px-4 selection:bg-[#ffdcbf] text-right" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#31312d] text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 border border-[#8c6239]/40 animate-fade-in">
          <span className="material-symbols-outlined text-sm text-[#ffdeae]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header Motif */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-[#714a23] via-[#8c6239] to-[#714a23] text-white p-4 mb-4 shadow-md">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-[#ffdeae] shadow-xs">
              <span className="material-symbols-outlined text-2xl">vpn_key</span>
            </div>
            <div>
              <span className="text-[10px] text-[#ffe8d7] tracking-wider block font-bold">
                فحص كود الجمعية المعتمد
              </span>
              <h2 className="text-base font-extrabold text-white">الانضمام إلى جمعية ادخار</h2>
            </div>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
            ربط مباشر
          </span>
        </div>
      </div>

      {/* Code Input Section */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-[#e5e2dc]">
        <label className="block text-xs font-bold text-[#1c1c18] mb-1.5" htmlFor="invite-code-input">
          أدخل كود الجمعية (HYA-...)
        </label>
        <p className="text-[11px] text-[#50453b] mb-3">
          ادخل الكود المكون من أحرف وأرقام (مثال: HYA-7821-YE) للبحث في قاعدة البيانات وعرض بيانات الجمعية الحقيقية.
        </p>

        <div className="relative flex items-center mb-3">
          <input
            id="invite-code-input"
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setSearchError(null);
            }}
            placeholder="مثال: HYA-7821-YE"
            className="w-full h-12 pr-10 pl-24 text-base font-black tracking-widest text-[#1c1c18] bg-[#fcf9f3] border border-[#e5e2dc] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#714a23] font-mono text-center"
            dir="ltr"
          />
          <span className="absolute right-3 text-[#50453b] material-symbols-outlined text-xl">
            qr_code_scanner
          </span>
          <button
            type="button"
            onClick={handlePaste}
            className="absolute left-2 px-2.5 py-1.5 bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#50453b] rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">content_paste</span>
            <span>لصق</span>
          </button>
        </div>

        {searchError && (
          <div className="p-3 mb-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-base text-red-600">error</span>
            <span>{searchError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => handleVerify()}
          disabled={isSearching}
          className="w-full h-11 rounded-xl bg-[#714a23] hover:bg-[#8c6239] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-60"
        >
          {isSearching ? (
            <>
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              <span>جارِ التحقق من الكود...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">search</span>
              <span>فحص الكود والتحقق من الجمعية</span>
            </>
          )}
        </button>
      </div>

      {/* Real Circle Preview Card (When verified from Firestore) */}
      {isVerified && foundCircle && (
        <div className="relative bg-white rounded-2xl overflow-hidden shadow-sm border border-[#e5e2dc] mb-4 animate-fade-in">
          {/* Verified Header Banner */}
          <div className="bg-emerald-50 px-4 py-2.5 flex items-center justify-between border-b border-emerald-200">
            <div className="flex items-center gap-1.5 text-emerald-800">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              <span className="text-xs font-bold">تم العثور على الجمعية بنجاح</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono" dir="ltr">
              {foundCircle.code}
            </span>
          </div>

          <div className="p-4">
            {/* Title & Organizer */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-black text-[#1c1c18]">{foundCircle.title}</h3>
                <p className="text-[11px] text-[#50453b] flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-sm text-[#714a23]">calendar_month</span>
                  <span>المدة: {totalShares} شهراً (مغلقة بعدد الأسهم - كل شهر يستلم شخص)</span>
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#ffdcbf] text-[#714a23] flex items-center justify-center shadow-xs shrink-0">
                <span className="material-symbols-outlined text-2xl">groups_3</span>
              </div>
            </div>

            {/* Financial Metrics Grid: Share Price & Monthly Payout */}
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              {/* Share Price */}
              <div className="bg-[#f6f3ed] rounded-xl p-2.5 flex flex-col justify-between border border-[#e5e2dc]/60">
                <span className="text-[10px] text-[#50453b] flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-xs text-[#714a23]">payments</span>
                  سعر السهم (المبلغ الدوري لكل سهم)
                </span>
                <div className="mt-1">
                  <span className="text-xl font-black text-[#714a23] font-sans">
                    {sharePrice.toLocaleString('ar-YE')}
                  </span>
                  <span className="text-[10px] text-[#50453b] mr-1">{currSymbol} / شهر</span>
                </div>
              </div>

              {/* Total Monthly Payout for Recipient */}
              <div className="bg-[#f6f3ed] rounded-xl p-2.5 flex flex-col justify-between border border-[#e5e2dc]/60">
                <span className="text-[10px] text-[#50453b] flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-xs text-[#6d4c0d]">savings</span>
                  يستلم كل شهر واحد
                </span>
                <div className="mt-1">
                  <span className="text-xl font-black text-[#6d4c0d] font-sans">
                    {monthlyPayout.toLocaleString('ar-YE')}
                  </span>
                  <span className="text-[10px] text-[#50453b] mr-1">{currSymbol} كل شهر</span>
                </div>
              </div>
            </div>

            {/* Capacity & Progress */}
            <div className="bg-[#f6f3ed] rounded-xl p-3 mb-3 border border-[#e5e2dc]/60">
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="text-[#1c1c18] font-medium">اكتمال أسهم الجمعية</span>
                <span className="text-[#714a23] font-bold">
                  {allocatedShares} من {totalShares} سهماً ({remainingShares > 0 ? `متبقي ${remainingShares} أسهم` : 'مكتملة بالكامل'})
                </span>
              </div>
              <div className="w-full bg-[#e5e2dc] h-2.5 rounded-full overflow-hidden flex">
                <div
                  className="bg-[#714a23] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((allocatedShares / totalShares) * 100))}%` }}
                />
              </div>
            </div>

            {/* User Shares Selection (كم سهم يدخل فيه) */}
            <div className="bg-gradient-to-r from-[#ffdeae]/30 via-[#f6f3ed] to-[#ffdeae]/20 rounded-2xl p-3.5 mb-3 border border-[#edbf76]/60">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-[#714a23]">pie_chart</span>
                  <span className="text-xs font-black text-[#1c1c18]">كم سهماً ترغب بالدخول فيه؟</span>
                </div>
                <span className="text-[10px] bg-[#714a23] text-white px-2 py-0.5 rounded-full font-bold">
                  {selectedShares} {selectedShares === 1 ? 'سهم واحد' : 'أسهم'}
                </span>
              </div>

              {/* Shares buttons */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[1, 2, 3].map((num) => {
                  const isAvailable = num <= remainingShares;
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setSelectedShares(num)}
                      className={`h-10 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        selectedShares === num
                          ? 'bg-[#714a23] text-white shadow-xs'
                          : isAvailable
                          ? 'bg-white text-[#50453b] border border-[#e5e2dc] hover:bg-[#f0eee8]'
                          : 'bg-[#f0eee8] text-[#50453b]/40 cursor-not-allowed border border-dashed border-[#e5e2dc]'
                      }`}
                    >
                      <span>{num}</span>
                      <span>{num === 1 ? 'سهم واحد' : 'أسهم'}</span>
                    </button>
                  );
                })}
              </div>

              {/* Installment summary */}
              <div className="flex items-center justify-between pt-2 border-t border-[#714a23]/10 text-xs">
                <span className="text-[#50453b]">قسطك الشهري المستحق:</span>
                <span className="font-black text-[#714a23] font-sans">
                  {myMonthlyDue.toLocaleString('ar-YE')} {currSymbol} / شهر
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px] text-[#50453b]">
                <span>ستستلم في أدوارك:</span>
                <span className="font-bold text-[#6d4c0d]">
                  {monthlyPayout.toLocaleString('ar-YE')} {currSymbol} ({selectedShares === 1 ? 'مرة واحدة' : `${selectedShares} مرات`})
                </span>
              </div>
            </div>

            {/* Organizer Profile Badge */}
            <div className="flex items-center justify-between p-2.5 bg-[#f6f3ed] rounded-xl mb-3 border border-[#e5e2dc]/60">
              <div className="flex items-center gap-2.5">
                <img
                  src={foundCircle.organizer.avatar || '/assets/aistudio/image_94928b82.png'}
                  alt={foundCircle.organizer.name}
                  className="w-10 h-10 rounded-full object-cover shadow-xs"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-[#1c1c18]">{foundCircle.organizer.name}</span>
                    <span className="material-symbols-outlined text-sm text-[#714a23]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified
                    </span>
                  </div>
                  <span className="text-[10px] text-[#50453b] block">منظم الجمعية المعتمد</span>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-[#ebe8e2] text-[#50453b] rounded text-[10px] font-bold">
                موثق ومعتمد
              </span>
            </div>

            {/* Automated Fair Lottery Notice */}
            <div className="rounded-xl p-3 bg-[#d7e5e5]/40 border border-[#bbc9c9]/60 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-base text-[#536161] shrink-0 mt-0.5">
                casino
              </span>
              <div className="flex flex-col gap-0.5 text-[11px] text-[#3c4949]">
                <strong className="text-[#1c1c18] font-bold">القرعة الآلية للأدوار والشهور:</strong>
                <p className="leading-relaxed">
                  عند اكتمال حجز الـ {totalShares} سهماً، يقوم البرنامج تلقائياً بإجراء القرعة وتوزيع الأدوار بعدالة وشفافية كاملة، ليحصل كل سهم على شهر استلامه بدقة (مثال: سهم رقم 1 يستلم شهر محرم، سهم رقم 2 يستلم شهر صفر...).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {isVerified && foundCircle && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={joiningState !== 'idle' || remainingShares <= 0}
            onClick={handleConfirmJoin}
            className="w-full h-13 rounded-2xl bg-[#714a23] hover:bg-[#8c6239] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-[#714a23]/20 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          >
            {joiningState === 'joining' ? (
              <>
                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                <span>جارِ تأكيد وحفظ انضمامك...</span>
              </>
            ) : joiningState === 'success' ? (
              <>
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                  task_alt
                </span>
                <span>مبارك! تم الانضمام بنجاح</span>
              </>
            ) : remainingShares <= 0 ? (
              <span>اكتملت جميع أسهم هذه الجمعية</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                <span>تأكيد والانضمام للجمعية ({selectedShares} {selectedShares === 1 ? 'سهم' : 'أسهم'})</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="w-full h-10 rounded-xl bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#50453b] font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
          >
            الرجوع إلى الرئيسية
          </button>
        </div>
      )}
    </div>
  );
};
