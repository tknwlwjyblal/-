import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Currency, CircleType, SavingsCircle, ActiveView, UserProfile } from '../types';
import { auth } from '../firebase';
import { getMonthNameForTurn, getDaysLeftUntil30th } from '../utils/lotteryUtils';

interface Props {
  onCircleCreated: (newCircle: SavingsCircle) => void;
  onNavigate: (view: ActiveView) => void;
  userProfile?: UserProfile;
}

export const CreateCircleView: React.FC<Props> = ({ onCircleCreated, onNavigate, userProfile }) => {
  const [circleType, setCircleType] = useState<CircleType>('collective');
  const [circleName, setCircleName] = useState('جمعية الأهل والأصدقاء');
  const [currency, setCurrency] = useState<Currency>('YER');
  const [sharePrice, setSharePrice] = useState<number>(1000);
  const [sharesCount, setSharesCount] = useState<number>(30);
  const [mySharesCount, setMySharesCount] = useState<number>(1);
  const [generatedCode, setGeneratedCode] = useState<string>('HYA-7821-YE');
  const [isCreated, setIsCreated] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const currencySymbols: Record<Currency, string> = {
    YER: 'ر.ي',
    SAR: 'ر.س',
    USD: '$',
  };

  const currSymbol = currencySymbols[currency];
  
  // Rule: Duration in months is locked to equal the total number of shares
  // because the circle is cyclical and monthly: exactly one share/person receives payout each month!
  const monthsCount = sharesCount;

  // Monthly payout received by each recipient = Share Price * Total Shares (e.g. 1,000 * 30 = 30,000)
  const monthlyPayout = sharePrice * sharesCount;

  // Creator's monthly installment = Share Price * Creator's Shares
  const myMonthlyInstallment = sharePrice * mySharesCount;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreate = () => {
    if (!circleName.trim()) {
      showToast('يرجى كتابة اسم الجمعية أولاً');
      return;
    }

    if (sharePrice <= 0) {
      showToast('يرجى إدخال قيمة صحيحة لسعر السهم');
      return;
    }

    if (sharesCount < 2) {
      showToast('أقل عدد أسهم للجمعية هو سهمان');
      return;
    }

    // Generate unique code if not exists
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const newCode = `HYA-${randNum}-${currency}`;
    setGeneratedCode(newCode);
    setIsCreated(true);

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#714a23', '#c89d58', '#2D6A4F', '#ffffff'],
      });
    } catch {
      // ignore
    }

    const cleanOrganizerName =
      userProfile?.fullName?.replace(/\(أنت\)|\(المنظم\)/g, '').trim() ||
      auth.currentUser?.displayName ||
      'المنظم المعتمد';
    const creatorId = auth.currentUser?.uid || userProfile?.id || `creator-${Date.now()}`;
    const creatorEmail = auth.currentUser?.email || userProfile?.email || '';

    const newCircle: SavingsCircle = {
      id: `circle-${Date.now()}`,
      creatorId,
      creatorEmail,
      title: circleName,
      type: circleType,
      currency,
      currencySymbol: currSymbol,
      sharePrice,
      sharesCount,
      monthlyPayout,
      mySharesCount,
      monthlyShare: myMonthlyInstallment,
      totalPool: monthlyPayout,
      totalMonths: monthsCount,
      completedMonths: 0,
      membersCount: 1,
      paidMembersThisMonthCount: 0,
      myTurnNumber: 1,
      myTurnMonth: 'بانتظار تعميد المنظم',
      myPaymentStatus: 'pending',
      code: newCode,
      organizer: {
        name: cleanOrganizerName,
        avatar: userProfile?.avatar || auth.currentUser?.photoURL || '/assets/aistudio/image_94928b82.png',
        trustScore: 100,
        managedCirclesCount: 1,
        creatorId,
      },
      nextPayoutMonth: getMonthNameForTurn(1),
      currentRecipientName: cleanOrganizerName,
      status: 'active',
      isConfirmedByAdmin: false,
      turnsAssigned: false,
      cashierBankAccounts: {
        kuraimiAccount: userProfile?.accountNumber || '300482910',
        jeebWallet: userProfile?.phone ? userProfile.phone.replace('+967', '').trim() : '771234567',
      },
      daysLeftForPayment: getDaysLeftUntil30th(),
      members: [
        {
          id: creatorId,
          name: cleanOrganizerName,
          avatar: userProfile?.avatar || auth.currentUser?.photoURL || '/assets/aistudio/image_94928b82.png',
          turnNumber: 1,
          payoutMonth: 'بانتظار تعميد المنظم',
          isPaidThisMonth: false,
          sharesCount: mySharesCount,
        },
      ],
    };

    onCircleCreated(newCircle);
    showToast('تم تأكيد وحفظ الجمعية بنجاح!');

    // Smooth scroll to invite section
    setTimeout(() => {
      const inviteSec = document.getElementById('inviteSection');
      inviteSec?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  };

  const copyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(generatedCode);
    }
    setCopyState('copied');
    showToast(`تم نسخ الكود ${generatedCode} بنجاح`);
    setTimeout(() => setCopyState('idle'), 2500);
  };

  const inviteMessage = `🌟 انضم إلى جمعيتي (${circleName})!
ادخل لتطبيق "هيا نجمعها" واضغط على "الانضمام لجمعية"، ثم أدخل الكود التالي: [ ${generatedCode} ] وحدد كم سهم ترغب بالمشاركة به.

💰 قسط السهم الواحد: ${sharePrice.toLocaleString('ar-YE')} ${currSymbol} شهرياً
👥 إجمالي عدد الأسهم: ${sharesCount} سهم
🗓️ مدة الجمعية: ${monthsCount} شهر (كل شهر يستلم واحد)
🎁 استلام المستفيد شهرياً: ${monthlyPayout.toLocaleString('ar-YE')} ${currSymbol}

معًا.. نكمّل الخير 🤝`;

  const shareInvite = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `دعوة للانضمام إلى جمعية ادخار - ${circleName}`,
          text: inviteMessage,
        })
        .catch(() => {});
    } else {
      copyCode();
      showToast('تم نسخ نص الدعوة بالكامل لمشاركته على واتساب');
    }
  };

  return (
    <div className="flex flex-col w-full pb-28 pt-2 px-4 selection:bg-[#ffdcbf] text-right" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#31312d] text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined text-sm text-[#ffdeae]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Heritage Banner Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-[#8c6239] via-[#714a23] to-[#5b3816] text-white p-5 shadow-md mb-4">
        {/* Sana'ani Geometric Pattern Background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg height="100%" width="100%">
            <defs>
              <pattern id="qamariyah-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M20 0 L40 20 L20 40 L0 20 Z" fill="none" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="20" cy="20" r="7" fill="none" stroke="#ffffff" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#qamariyah-pattern)" />
          </svg>
        </div>

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 max-w-[82%]">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md self-start">
              <span className="material-symbols-outlined text-sm text-[#ffdeae]">stars</span>
              <span className="text-[10px] text-[#ffe8d7] font-bold tracking-wide">الجمعيات المالية الموثوقة</span>
            </div>
            <h2 className="text-xl font-black text-white leading-tight">ابدأ دائرة ادخار موثوقة</h2>
            <p className="text-xs text-[#ffe8d7] leading-relaxed">
              نظّم جمعيتك مع الأهل أو الأصدقاء بكل سهولة وشفافية، مع حسابات آلية دقيقة وضمان للعدالة التامة بين الجميع.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 text-[#ffdeae] shadow-inner">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              assured_workload
            </span>
          </div>
        </div>
      </section>

      {/* Circle Type Selection */}
      <section className="flex flex-col gap-2 mb-4">
        <label className="text-sm font-bold text-[#1c1c18] flex items-center gap-1.5">
          <span className="material-symbols-outlined text-lg text-[#714a23]">category</span>
          <span>نوع الجمعية</span>
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Collective Circle */}
          <button
            type="button"
            onClick={() => setCircleType('collective')}
            className={`relative flex flex-col items-start p-3.5 rounded-2xl text-right transition-all shadow-xs border ${
              circleType === 'collective'
                ? 'bg-white border-[#8c6239] ring-2 ring-[#8c6239]/20'
                : 'bg-[#f6f3ed] border-[#e5e2dc] opacity-80'
            }`}
          >
            <div className="w-full flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-[#ffdcbf] flex items-center justify-center text-[#714a23]">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  groups
                </span>
              </div>
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${
                  circleType === 'collective' ? 'bg-[#714a23]' : 'bg-[#e5e2dc] opacity-0'
                }`}
              >
                <span className="material-symbols-outlined text-xs">check</span>
              </span>
            </div>
            <span className="text-xs font-bold text-[#714a23]">جمعية جماعية</span>
            <span className="text-[10px] text-[#50453b] mt-0.5">مع الأهل، المعارف، أو الزملاء</span>
          </button>

          {/* Solo Circle */}
          <button
            type="button"
            onClick={() => setCircleType('solo')}
            className={`relative flex flex-col items-start p-3.5 rounded-2xl text-right transition-all shadow-xs border ${
              circleType === 'solo'
                ? 'bg-white border-[#8c6239] ring-2 ring-[#8c6239]/20'
                : 'bg-[#f6f3ed] border-[#e5e2dc] opacity-80'
            }`}
          >
            <div className="w-full flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-[#ebe8e2] flex items-center justify-center text-[#50453b]">
                <span className="material-symbols-outlined text-xl">person</span>
              </div>
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${
                  circleType === 'solo' ? 'bg-[#714a23]' : 'bg-[#e5e2dc] opacity-0'
                }`}
              >
                <span className="material-symbols-outlined text-xs">check</span>
              </span>
            </div>
            <span className="text-xs font-bold text-[#1c1c18]">ادخار شخصي</span>
            <span className="text-[10px] text-[#50453b] mt-0.5">صندوق ادخار فردي لهدف محدد</span>
          </button>
        </div>
      </section>

      {/* Form Fields */}
      <section className="flex flex-col gap-3.5 mb-4">
        {/* Name Field */}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1 justify-between items-center">
            <label className="text-xs font-bold text-[#1c1c18] flex items-center gap-1.5" htmlFor="circleName">
              <span className="material-symbols-outlined text-base text-[#714a23]">edit_note</span>
              <span>اسم الجمعية</span>
            </label>
            <span className="text-[10px] text-[#50453b]">اسم مألوف للأعضاء</span>
          </div>
          <div className="relative flex items-center">
            <input
              id="circleName"
              type="text"
              value={circleName}
              onChange={(e) => setCircleName(e.target.value)}
              placeholder="مثال: جمعية الأهل والأحباب"
              className="w-full h-12 pr-10 pl-4 bg-white text-[#1c1c18] text-sm font-medium rounded-xl shadow-xs border border-[#e5e2dc] focus:outline-none focus:ring-2 focus:ring-[#8c6239] transition-all"
            />
            <span className="absolute right-3.5 text-[#50453b] material-symbols-outlined text-lg">badge</span>
          </div>
        </div>

        {/* Currency Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[#1c1c18] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-[#714a23]">payments</span>
            <span>عملة الجمعية</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['SAR', 'YER', 'USD'] as Currency[]).map((c) => {
              const label = c === 'SAR' ? 'ريال سعودي' : c === 'YER' ? 'ريال يمني' : 'دولار أمريكي';
              const sym = currencySymbols[c];
              const isSelected = currency === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-all active:scale-95 border ${
                    isSelected
                      ? 'bg-[#714a23] text-white border-[#714a23]'
                      : 'bg-white text-[#1c1c18] border-[#e5e2dc] hover:bg-[#f6f3ed]'
                  }`}
                >
                  <span>{label}</span>
                  <span className="text-[10px] opacity-75">({sym})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Share Price Input (سعر السهم الشهري) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1 justify-between items-center">
            <label className="text-xs font-bold text-[#1c1c18] flex items-center gap-1.5" htmlFor="sharePrice">
              <span className="material-symbols-outlined text-base text-[#714a23]">payments</span>
              <span>سعر السهم (قسط السهم الواحد شهرياً)</span>
            </label>
            <span className="text-[10px] text-[#714a23] font-bold">يحدد قيمة الجمعية</span>
          </div>
          <div className="relative flex items-center">
            <input
              id="sharePrice"
              type="number"
              step="100"
              min="100"
              value={sharePrice}
              onChange={(e) => setSharePrice(Math.max(1, parseFloat(e.target.value) || 0))}
              placeholder="مثال: 1000"
              className="w-full h-12 pr-4 pl-16 bg-white text-[#1c1c18] text-base font-black rounded-xl shadow-xs border border-[#e5e2dc] focus:outline-none focus:ring-2 focus:ring-[#8c6239] transition-all font-sans"
            />
            <div className="absolute left-3 px-2 py-1 bg-[#f0eee8] rounded-lg text-[#714a23] font-bold text-xs">
              {currSymbol}
            </div>
          </div>
          {/* Quick preset chips */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1 pb-0.5">
            <span className="text-[10px] text-[#50453b] shrink-0">اقتراحات:</span>
            {[1000, 2000, 5000, 10000, 20000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setSharePrice(amt)}
                className={`min-h-9 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                  sharePrice === amt
                    ? 'bg-[#714a23] text-white'
                    : 'bg-[#f0eee8] text-[#50453b] hover:bg-[#e5e2dc]'
                }`}
              >
                {amt.toLocaleString('ar-YE')} {currSymbol}
              </button>
            ))}
          </div>
        </div>

        {/* Steppers: Total Shares and Locked Months */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Total Shares Stepper */}
          <div className="flex flex-col gap-1 p-3 bg-white rounded-xl shadow-xs border border-[#e5e2dc]">
            <span className="text-[11px] text-[#50453b] font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-[#714a23]">pie_chart</span>
              <span>إجمالي عدد الأسهم</span>
            </span>
            <div className="flex items-center justify-between mt-1">
              <button
                type="button"
                onClick={() => setSharesCount((m) => Math.max(2, m - 1))}
                className="w-8 h-8 rounded-lg bg-[#f0eee8] hover:bg-[#e5e2dc] flex items-center justify-center text-[#1c1c18] active:scale-95 transition-transform cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">remove</span>
              </button>
              <div className="flex items-baseline gap-1 font-bold">
                <span className="text-lg text-[#1c1c18] font-sans">{sharesCount}</span>
                <span className="text-xs text-[#50453b]">أسهم</span>
              </div>
              <button
                type="button"
                onClick={() => setSharesCount((m) => Math.min(100, m + 1))}
                className="w-8 h-8 rounded-lg bg-[#ffdcbf] text-[#714a23] flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
            </div>
            <div className="flex items-center justify-center gap-1 mt-1 pt-1 border-t border-[#e5e2dc]/60">
              {[10, 12, 20, 30].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSharesCount(s)}
                  className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer ${
                    sharesCount === s ? 'bg-[#714a23] text-white font-bold' : 'text-[#50453b] hover:bg-[#f0eee8]'
                  }`}
                >
                  {s} سهم
                </button>
              ))}
            </div>
          </div>

          {/* Locked Months (مغلق تلقائياً بعدد الأسهم) */}
          <div className="flex flex-col justify-between p-3 bg-[#f6f3ed] rounded-xl shadow-xs border border-[#d4c3b7]/60">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#50453b] font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#714a23]">calendar_month</span>
                  <span>مدة الجمعية</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[#e5e2dc] text-[#50453b] text-[9px] font-bold flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[10px]">lock</span>
                  <span>مغلق</span>
                </span>
              </div>
              <div className="flex items-baseline gap-1 font-bold mt-2">
                <span className="text-xl text-[#714a23] font-black font-sans">{monthsCount}</span>
                <span className="text-xs text-[#714a23] font-bold">أشهر</span>
              </div>
            </div>
            <p className="text-[9px] text-[#50453b] mt-1 pt-1 border-t border-[#d4c3b7]/40 leading-snug">
              = {sharesCount} سهم لأن كل شهر يستلم شخص واحد
            </p>
          </div>
        </div>

        {/* Creator's Own Shares in the circle */}
        <div className="flex items-center justify-between p-3 bg-white rounded-xl shadow-xs border border-[#e5e2dc]">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#1c1c18] flex items-center gap-1">
              <span className="material-symbols-outlined text-base text-[#714a23]">person</span>
              <span>كم سهماً ستشارك به أنت كمنظم؟</span>
            </span>
            <span className="text-[10px] text-[#50453b]">
              قسطك الشهري: <strong>{myMonthlyInstallment.toLocaleString('ar-YE')} {currSymbol}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setMySharesCount(num)}
                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mySharesCount === num
                    ? 'bg-[#714a23] text-white shadow-xs'
                    : 'bg-[#f0eee8] text-[#50453b] hover:bg-[#e5e2dc]'
                }`}
              >
                {num} {num === 1 ? 'سهم' : 'أسهم'}
              </button>
            ))}
          </div>
        </div>

        {/* Automatic Calculation Card (آلي 100%) */}
        <div className="rounded-2xl p-4 bg-gradient-to-r from-[#f6f3ed] via-[#ffdeae]/25 to-[#f6f3ed] border border-[#edbf76]/50 shadow-xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-[#714a23] text-white flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-sm">calculate</span>
              </div>
              <span className="text-xs font-bold text-[#6d4c0d]">حساب الجمعية التلقائي بسعر السهم</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#ffdeae] text-[#6d4c0d] text-[10px] font-bold">
              آلي 100%
            </span>
          </div>

          {/* Share price row */}
          <div className="flex items-baseline justify-between pt-1 border-t border-[#714a23]/10">
            <span className="text-xs text-[#50453b]">قسط السهم الواحد شهرياً:</span>
            <div className="flex items-baseline gap-1 text-[#1c1c18] font-bold">
              <span className="text-sm font-sans font-black">{sharePrice.toLocaleString('ar-YE')}</span>
              <span className="text-[10px] text-[#50453b]">{currSymbol} / سهم</span>
            </div>
          </div>

          {/* Payout per month */}
          <div className="flex items-baseline justify-between pt-1 border-t border-[#714a23]/10">
            <span className="text-xs text-[#1c1c18] font-black">يستلم كل شهر واحد:</span>
            <div className="flex items-baseline gap-1 text-[#714a23]">
              <span className="text-2xl font-black font-sans">
                {monthlyPayout.toLocaleString('ar-YE')}
              </span>
              <span className="text-xs text-[#714a23] font-bold">{currSymbol} كل شهر</span>
            </div>
          </div>

          {/* Explanation badge */}
          <div className="flex flex-col gap-1 pt-2 border-t border-[#714a23]/10 text-[11px] text-[#50453b] bg-white/60 p-2.5 rounded-xl border border-[#e5e2dc]/60">
            <div className="flex items-center gap-1.5 font-bold text-[#714a23]">
              <span className="material-symbols-outlined text-sm">info</span>
              <span>
                {sharePrice.toLocaleString('ar-YE')} {currSymbol} (القسط) × {sharesCount} سهم = يستلم كل شهر واحد <strong>{monthlyPayout.toLocaleString('ar-YE')} {currSymbol}</strong>
              </span>
            </div>
            <p className="text-[10px] text-[#50453b] leading-relaxed">
              الجمعية دورية وشهرية، مدتها {monthsCount} شهراً بعدد الأسهم بالضبط، وكل مشترك يحدد كم سهم يدخل فيه.
            </p>
          </div>
        </div>
      </section>

      {/* Fairness & Automated Lottery Transparency Shield */}
      <section className="rounded-2xl p-4 bg-[#d7e5e5]/40 text-[#1c1c18] shadow-xs border border-[#bbc9c9]/60 mb-4 flex flex-col gap-2.5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#536161] flex items-center justify-center text-white shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-2xl">verified_user</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-[#1c1c18]">
                آلية تحديد الأدوار (قرعة تلقائية عادلة 100%)
              </h3>
              <span className="px-1.5 py-0.5 rounded bg-[#714a23] text-white text-[9px] font-bold">
                حيادية تامة
              </span>
            </div>
            <p className="text-[11px] text-[#50453b] leading-relaxed">
              تحديد الأدوار يكون <strong className="text-[#1c1c18]">تلقائياً فور انضمام واكتمال جميع الأسهم ({sharesCount}/{sharesCount})</strong>. ستظهر رسالة للمنظم «اكتملت الأسهم.. اضغط لتحديد الأدوار»، ويصل إشعار فوري لكافة الأعضاء بأن الأدوار حُددت بنظام القرعة الإلكترونية الموثقة دون أي تدخل يدوي، لترسيخ الأمان والاطمئنان بين الجميع.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1 text-[#3c4949] text-[10px] font-bold border-t border-[#bbc9c9]/40">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-[#536161]">lock</span>
            <span>تشفير مالي آمن</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-[#536161]">casino</span>
            <span>خوارزمية قرعة محايدة</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-[#536161]">notifications_active</span>
            <span>إشعار مباشر للأعضاء</span>
          </div>
        </div>
      </section>

      {/* Primary Action Button */}
      <div className="flex flex-col gap-2 mb-4">
        <button
          type="button"
          onClick={handleCreate}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#8c6239] to-[#714a23] text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-[#714a23]/25 active:scale-[0.98] transition-all hover:brightness-105"
        >
          <span className="material-symbols-outlined text-2xl">add_circle</span>
          <span>حفظ وإنشاء الجمعية</span>
        </button>
        <p className="text-[11px] text-center text-[#50453b]">
          بالضغط على إنشاء، سيتم تفعيل رمز الدعوة الخاص بجمعيتك لمشاركته مباشرة
        </p>
      </div>

      {/* Generated Circle Code & Share Showcase Section (Auto-revealed) */}
      {isCreated && (
        <section
          id="inviteSection"
          className="flex flex-col gap-3.5 p-4 rounded-2xl bg-white border border-[#edbf76] shadow-md relative overflow-hidden animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#f0eee8]">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
                <span className="material-symbols-outlined text-xl">check_circle</span>
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-[#1c1c18]">تم توليد رمز الجمعية بنجاح!</h3>
                <p className="text-[10px] text-[#50453b]">جاهز للاستخدام ومشاركة الأعضاء فوراً</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-black border border-emerald-200">
              نشط ومعتمد
            </span>
          </div>

          {/* Code Display Box */}
          <div className="p-3.5 rounded-xl bg-[#f6f3ed] flex items-center justify-between gap-3 border border-[#e5e2dc]">
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-[#50453b] font-medium">رمز الانضمام للجمعية</span>
              <span className="text-lg font-black tracking-wider text-[#714a23] font-mono" dir="ltr">
                {generatedCode}
              </span>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="h-10 px-3.5 rounded-xl bg-white hover:bg-[#e5e2dc] text-[#714a23] font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all border border-[#d4c3b7]/30 shadow-xs"
            >
              <span className="material-symbols-outlined text-base">
                {copyState === 'copied' ? 'check' : 'content_copy'}
              </span>
              <span>{copyState === 'copied' ? 'تم النسخ!' : 'نسخ الكود'}</span>
            </button>
          </div>

          {/* Invitation Message Preview */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1c1c18] flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-[#714a23]">chat</span>
                <span>معاينة رسالة الدعوة المجهزة</span>
              </span>
              <span className="text-[10px] text-[#50453b]">مجهزة للواتساب ومواقع التواصل</span>
            </div>
            <div className="p-3 rounded-xl bg-[#f0eee8] text-[#1c1c18] text-xs leading-relaxed whitespace-pre-line font-medium border border-[#e5e2dc]">
              {inviteMessage}
            </div>
          </div>

          {/* Share Action */}
          <button
            type="button"
            onClick={shareInvite}
            className="w-full h-12 rounded-xl bg-[#714a23] hover:bg-[#8c6239] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#714a23]/20 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-lg">share</span>
            <span>مشاركة كود ورسالة الدعوة (واتساب)</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="w-full py-2.5 rounded-xl bg-[#f0eee8] text-[#50453b] hover:text-[#1c1c18] font-bold text-xs transition-colors"
          >
            العودة للرئيسية ومتابعة الجمعيات
          </button>
        </section>
      )}
    </div>
  );
};
