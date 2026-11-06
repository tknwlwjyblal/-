import React, { useState, useRef } from 'react';
import {
  Currency,
  SavingsCircle,
  UserProfile,
  ActiveView,
  PaymentSubmission,
  canUserSeeCircle,
  getMemberInstallmentProgress,
} from '../types';
import { auth } from '../firebase';

interface Props {
  circles: SavingsCircle[];
  pendingConfirmationCount?: number;
  payments?: PaymentSubmission[];
  userProfile: UserProfile;
  onNavigate: (view: ActiveView) => void;
  onSelectCircle: (circle: SavingsCircle) => void;
  onPayDue: (circle: SavingsCircle) => void;
  onOpenAdminApprovals?: (circle?: SavingsCircle) => void;
  selectedCurrency: Currency | 'ALL';
  onSelectCurrency: (c: Currency | 'ALL') => void;
  toastMessage?: string | null;
  onDismissToast?: () => void;
}

export const HomeView: React.FC<Props> = ({
  circles: rawCircles,
  pendingConfirmationCount = 0,
  payments = [],
  userProfile,
  onNavigate,
  onSelectCircle,
  onPayDue,
  onOpenAdminApprovals,
  selectedCurrency,
  onSelectCurrency,
  toastMessage,
  onDismissToast,
}) => {
  const currentUid = userProfile?.id || auth.currentUser?.uid;
  const currentEmail = userProfile?.email || auth.currentUser?.email;

  // Strictly show ONLY circles where the user is the Organizer OR joined via code AND was confirmed
  const circles = rawCircles.filter((c) => canUserSeeCircle(c, currentUid, currentEmail));

  // Circles where current user is the organizer
  const myAdminCircleIds = new Set(
    circles
      .filter(
        (c) =>
          (currentUid && (c.creatorId === currentUid || c.organizer?.creatorId === currentUid)) ||
          (currentEmail && c.creatorEmail === currentEmail)
      )
      .map((c) => c.id)
  );

  // Receipts uploaded by members for circles organized by the current user
  const uploadedAdminReceipts = payments.filter((p) => myAdminCircleIds.has(p.circleId));
  const pendingAdminReceipts = uploadedAdminReceipts.filter((p) => p.status === 'under_review');
  const [filterTab, setFilterTab] = useState<'active' | 'completed'>('active');
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  // Swipe / Drag handling state
  const sliderRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const dragStartX = useRef<number>(0);

  // Filter circles by currency
  const yerCircles = circles.filter((c) => c.currency === 'YER');
  const sarCircles = circles.filter((c) => c.currency === 'SAR');
  const usdCircles = circles.filter((c) => c.currency === 'USD');

  // Compute real dynamic totals from Firestore circles based on user's shares and monthly payout
  const totalYER = yerCircles
    .filter((c) => c.status === 'active')
    .reduce(
      (sum, c) =>
        sum +
        (c.myTurnReceived
          ? 0
          : (c.mySharesCount || 1) * (c.monthlyPayout || c.totalPool)),
      0
    );

  const totalSAR = sarCircles
    .filter((c) => c.status === 'active')
    .reduce(
      (sum, c) =>
        sum +
        (c.myTurnReceived
          ? 0
          : (c.mySharesCount || 1) * (c.monthlyPayout || c.totalPool)),
      0
    );

  const totalUSD = usdCircles
    .filter((c) => c.status === 'active')
    .reduce(
      (sum, c) =>
        sum +
        (c.myTurnReceived
          ? 0
          : (c.mySharesCount || 1) * (c.monthlyPayout || c.totalPool)),
      0
    );

  // Real next payouts based on circles
  const nextPayoutYER =
    yerCircles.find((c) => !c.myTurnReceived)?.myTurnMonth || (yerCircles.length > 0 ? 'مكتملة' : 'لا توجد أدوار نشطة');
  const nextPayoutSAR =
    sarCircles.find((c) => !c.myTurnReceived)?.myTurnMonth || (sarCircles.length > 0 ? 'مكتملة' : 'لا توجد أدوار نشطة');
  const nextPayoutUSD =
    usdCircles.find((c) => !c.myTurnReceived)?.myTurnMonth || (usdCircles.length > 0 ? 'مكتملة' : 'لا توجد أدوار نشطة');

  // Currency Cards definition
  const currencyCards = [
    {
      id: 'yer',
      currency: 'YER' as Currency,
      title: 'إجمالي المدخرات بالريال اليمني',
      amountFormatted:
        totalYER > 0 ? totalYER.toLocaleString('ar-YE') : '٠',
      symbol: 'ريال يمني',
      badge: `🇾🇪 جمعيات اليمن (${yerCircles.length})`,
      badgeColor: 'bg-emerald-400',
      nextPayout: nextPayoutYER,
      gradient: 'from-[#784b28] via-[#8c6239] to-[#543419]',
      count: yerCircles.length,
    },
    {
      id: 'sar',
      currency: 'SAR' as Currency,
      title: 'إجمالي المدخرات بالريال السعودي',
      amountFormatted:
        totalSAR > 0 ? totalSAR.toLocaleString('ar-SA') : '٠',
      symbol: 'ر.س',
      badge: `🇸🇦 جمعيات السعودية (${sarCircles.length})`,
      badgeColor: 'bg-amber-400',
      nextPayout: nextPayoutSAR,
      gradient: 'from-[#6e4c2b] via-[#7d5632] to-[#4a3b32]',
      count: sarCircles.length,
    },
    {
      id: 'usd',
      currency: 'USD' as Currency,
      title: 'إجمالي المدخرات بالدولار الأمريكي',
      amountFormatted:
        totalUSD > 0 ? `$${totalUSD.toLocaleString('en-US')}` : '$0',
      symbol: 'دولار أمريكي',
      badge: `🇺🇸 جمعيات المغتربين (${usdCircles.length})`,
      badgeColor: 'bg-emerald-400',
      nextPayout: nextPayoutUSD,
      gradient: 'from-[#4a3b32] via-[#5c4a3f] to-[#2f2520]',
      count: usdCircles.length,
    },
  ];

  // Scroll to active card smoothly
  const scrollToCard = (index: number) => {
    const nextIndex = Math.max(0, Math.min(currencyCards.length - 1, index));
    setActiveCardIndex(nextIndex);
    if (sliderRef.current) {
      const cardWidth = sliderRef.current.offsetWidth * 0.88;
      // In RTL languages, we scroll using positive or negative offset depending on layout
      const isRTL = document.dir === 'rtl' || true;
      const scrollPos = isRTL ? -nextIndex * (cardWidth + 12) : nextIndex * (cardWidth + 12);
      sliderRef.current.scrollTo({
        left: scrollPos,
        behavior: 'smooth',
      });
    }
  };

  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX.current;
    const diffY = touchEndY - touchStartY.current;

    // Check if horizontal swipe
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 35) {
      // In RTL: swipe right (diffX > 0) goes to NEXT card; swipe left (diffX < 0) goes to PREV card
      if (diffX > 0) {
        if (activeCardIndex > 0) {
          scrollToCard(activeCardIndex - 1);
        }
      } else {
        if (activeCardIndex < currencyCards.length - 1) {
          scrollToCard(activeCardIndex + 1);
        }
      }
    }
  };

  // Mouse drag handlers for desktop/laptop preview
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diffX = e.clientX - dragStartX.current;
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        if (activeCardIndex > 0) scrollToCard(activeCardIndex - 1);
      } else {
        if (activeCardIndex < currencyCards.length - 1) scrollToCard(activeCardIndex + 1);
      }
    }
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
  };

  // Filter circles list
  const filteredCircles = circles.filter((c) => {
    const matchesTab = filterTab === 'active' ? c.status === 'active' : c.status === 'completed';
    const matchesCurrency = selectedCurrency === 'ALL' || c.currency === selectedCurrency;
    return matchesTab && matchesCurrency;
  });

  return (
    <div className="flex flex-col w-full pb-28 pt-2 px-4 selection:bg-[#ffdcbf] text-right" dir="rtl">
      {/* Toast Notification if triggered */}
      {toastMessage && (
        <div className="w-full mb-3.5 p-3 rounded-2xl bg-white shadow-md border border-[#2D6A4F]/30 flex items-center justify-between transition-all duration-300 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[#2D6A4F] shrink-0">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-[#1c1c18]">{toastMessage}</span>
              <span className="text-[10px] text-[#50453b]">تم تحديث سجلات صندوق الجمعية وقاعدة البيانات بأمان</span>
            </div>
          </div>
          {onDismissToast && (
            <button
              onClick={onDismissToast}
              className="w-7 h-7 flex items-center justify-center text-[#50453b] hover:text-[#1c1c18] active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      )}

      {/* Primary Financial Summary Carousel (Swipeable, Dragable, Multi-Currency) */}
      <section className="mb-4 flex flex-col gap-2 relative">
        <div className="flex items-center justify-between px-1 mb-0.5">
          <span className="text-xs font-bold text-[#50453b] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-[#714a23]">swipe</span>
            <span>اسحب للتنقل بين بطاقات العملات</span>
          </span>

          {/* Quick Prev / Next Arrows */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollToCard(activeCardIndex - 1)}
              disabled={activeCardIndex === 0}
              className="w-7 h-7 rounded-full bg-[#f0eee8] hover:bg-[#e5e2dc] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-[#714a23] transition-all active:scale-90"
              aria-label="البطاقة السابقة"
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
            <button
              type="button"
              onClick={() => scrollToCard(activeCardIndex + 1)}
              disabled={activeCardIndex === currencyCards.length - 1}
              className="w-7 h-7 rounded-full bg-[#f0eee8] hover:bg-[#e5e2dc] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-[#714a23] transition-all active:scale-90"
              aria-label="البطاقة التالية"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
          </div>
        </div>

        {/* Carousel Container */}
        <div
          ref={sliderRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 -mx-4 px-4 scroll-smooth select-none cursor-grab active:cursor-grabbing"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {currencyCards.map((card, idx) => {
            const isSelected = selectedCurrency === card.currency;
            const isActive = activeCardIndex === idx;

            return (
              <div
                key={card.id}
                onClick={() => {
                  setActiveCardIndex(idx);
                  onSelectCurrency(isSelected ? 'ALL' : card.currency);
                }}
                className={`snap-center shrink-0 w-[88%] relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} text-white p-5 shadow-lg flex flex-col justify-between min-h-[195px] cursor-pointer transition-all duration-300 ${
                  isActive ? 'scale-[1.01] shadow-xl' : 'opacity-85 scale-[0.98]'
                } border ${
                  isSelected ? 'ring-3 ring-[#ffdeae] ring-offset-2 ring-offset-[#fcf9f3]' : 'border-white/10'
                }`}
              >
                {/* Traditional Qamariyah Sana'ani Geometric Pattern Accent */}
                <svg
                  className="absolute -left-6 -bottom-8 w-44 h-44 text-white/5 pointer-events-none"
                  fill="currentColor"
                  viewBox="0 0 100 100"
                >
                  <path d="M50 0 C22.4 0 0 22.4 0 50 C0 77.6 22.4 100 50 100 C77.6 100 100 77.6 100 50 C100 22.4 77.6 0 50 0 Z M50 10 C72.1 10 90 27.9 90 50 C90 72.1 72.1 90 50 90 C27.9 90 10 72.1 10 50 C10 27.9 27.9 10 50 10 Z" />
                  <circle cx="50" cy="50" fill="none" r="28" stroke="currentColor" strokeWidth="4" />
                  <path d="M50 20 L58 42 L80 50 L58 58 L50 80 L42 58 L20 50 L42 42 Z" opacity="0.6" />
                </svg>

                <div className="relative z-10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/90 font-medium">{card.title}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-[11px] text-white font-bold flex items-center gap-1.5 shadow-xs">
                      <span className={`w-1.5 h-1.5 rounded-full ${card.badgeColor} animate-pulse`} />
                      {card.badge}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-white tracking-tight font-sans">
                      {card.amountFormatted}
                    </span>
                    <span className="text-xs text-[#ffdeae] font-bold">{card.symbol}</span>
                  </div>
                </div>

                <div className="relative z-10 pt-2.5 flex items-center justify-between text-white/90 border-t border-white/15 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-[#ffdeae]">
                      verified_user
                    </span>
                    <span>
                      الاستلام القادم: <strong className="text-white font-bold">{card.nextPayout}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[#ffdeae] font-bold text-xs hover:underline">
                    <span>سجل السدادات</span>
                    <span className="material-symbols-outlined text-xs">arrow_back</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Carousel Pagination Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-1" aria-label="مؤشر البطاقات">
          {currencyCards.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToCard(i)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                activeCardIndex === i ? 'w-7 bg-[#714a23]' : 'w-2 bg-[#d4c3b7] hover:bg-[#8c6239]'
              }`}
              aria-label={`الانتقال إلى بطاقة عملة ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Primary CTAs: Create Circle & Join Circle */}
      <section className="flex flex-col gap-2.5 mb-4">
        {/* Create Circle */}
        <div className="rounded-2xl bg-[#f6f3ed] p-3.5 flex items-center justify-between gap-3 shadow-xs border border-[#d4c3b7]/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#714a23]/15 text-[#714a23] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">groups</span>
            </div>
            <div className="flex flex-col min-w-0 text-right">
              <h3 className="font-bold text-sm text-[#1c1c18] truncate">إنشاء جمعية جديدة</h3>
              <p className="text-xs text-[#50453b] truncate">ابدأ جمعية مع الأهل أو الأصدقاء بسهولة وشفافية</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('create-circle')}
            className="shrink-0 h-10 px-3.5 rounded-xl bg-[#714a23] hover:bg-[#8c6239] text-white font-bold text-xs shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>إنشاء</span>
          </button>
        </div>

        {/* Join Circle */}
        <div className="rounded-2xl bg-[#f6f3ed] p-3.5 flex items-center justify-between gap-3 shadow-xs border border-[#d4c3b7]/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#d4e3e2]/60 text-[#714a23] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">pin</span>
            </div>
            <div className="flex flex-col min-w-0 text-right">
              <h3 className="font-bold text-sm text-[#1c1c18] truncate">الانضمام لجمعية</h3>
              <p className="text-xs text-[#50453b] truncate">انضم عبر رمز الدعوة لاختيار دورك ومقعد الاستلام</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('join-circle')}
            className="shrink-0 h-10 px-3.5 rounded-xl bg-[#ebe8e2] hover:bg-[#e5e2dc] text-[#714a23] font-bold text-xs shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">login</span>
            <span>انضمام</span>
          </button>
        </div>

        {/* Admin Approvals CTA: Appears to the Circle Organizer ONLY when members upload receipts */}
        {uploadedAdminReceipts.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-l from-[#ffdeae]/50 via-[#fcf9f3] to-[#ffdeae]/30 p-3.5 flex items-center justify-between gap-3 border-2 border-[#edbf76] shadow-sm animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-11 h-11 rounded-xl bg-[#714a23] text-white flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-2xl">receipt_long</span>
                {pendingAdminReceipts.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white animate-bounce">
                    {pendingAdminReceipts.length}
                  </span>
                )}
              </div>
              <div className="flex flex-col min-w-0 text-right">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-xs text-[#1c1c18] truncate">
                    لوحة تعميد الإيصالات المرفوعة 👑
                  </h3>
                </div>
                <p className="text-[11px] text-[#604101] font-medium truncate">
                  {pendingAdminReceipts.length > 0
                    ? `لديك (${pendingAdminReceipts.length}) إيصال مرفوع من الأعضاء بانتظار التعميد`
                    : `تم رفع (${uploadedAdminReceipts.length}) إيصالات سداد — اضغط للمراجعة`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onOpenAdminApprovals ? onOpenAdminApprovals() : onNavigate('admin-approvals')
              }
              className="shrink-0 h-10 px-3.5 rounded-xl bg-[#2D6A4F] hover:bg-[#23533e] text-white font-bold text-xs shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">fact_check</span>
              <span>مراجعة وتعميد</span>
            </button>
          </div>
        )}
      </section>

      {/* Circles Segment Header & Filter Tabs */}
      <section className="flex flex-col gap-2 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-base text-[#1c1c18]">جمعياتي المشترك فيها</h3>
            {selectedCurrency !== 'ALL' && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#ffdcbf] text-[#714a23] text-[10px] font-bold">
                عملة {selectedCurrency}
              </span>
            )}
          </div>
          <span className="text-xs text-[#50453b] font-medium">الكل: {circles.length}</span>
        </div>

        {/* Minimal Filter Tabs */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-[#ebe8e2]/70 p-1 rounded-xl w-fit">
            <button
              onClick={() => setFilterTab('active')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterTab === 'active'
                  ? 'bg-white text-[#714a23] shadow-xs'
                  : 'text-[#50453b] hover:text-[#1c1c18]'
              }`}
            >
              النشطة ({circles.filter((c) => c.status === 'active').length})
            </button>
            <button
              onClick={() => setFilterTab('completed')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterTab === 'completed'
                  ? 'bg-white text-[#714a23] shadow-xs'
                  : 'text-[#50453b] hover:text-[#1c1c18]'
              }`}
            >
              المكتملة ({circles.filter((c) => c.status === 'completed').length})
            </button>
          </div>

          {selectedCurrency !== 'ALL' && (
            <button
              onClick={() => onSelectCurrency('ALL')}
              className="text-xs text-[#714a23] font-bold underline hover:opacity-80 cursor-pointer"
            >
              إلغاء تصفية العملة
            </button>
          )}
        </div>
      </section>

      {/* List of Circle Cards */}
      <section className="flex flex-col gap-3 mt-1">
        {pendingConfirmationCount > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-right">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">hourglass_top</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black text-amber-950">
                لديك ({pendingConfirmationCount}) جمعية منضم إليها بالكود بانتظار التعميد
              </span>
              <span className="text-[11px] text-amber-800">
                ستظهر الجمعية في قائمتك تلقائياً فور قيام منظم الجمعية بتعميد انضمامك أو تعميد الجمعية.
              </span>
            </div>
          </div>
        )}

        {filteredCircles.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-dashed border-[#d4c3b7] text-center flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-4xl text-[#8c6239]">savings</span>
            <p className="text-xs font-bold text-[#1c1c18]">لا توجد جمعيات معتمدة في حسابك حالياً</p>
            <p className="text-[11px] text-[#50453b]">
              الجمعيات لا تظهر للجميع — تظهر فقط لمن انضم إليها بواسطة الكود وتم تعميده من المنظم، أو الجمعيات التي أنشأتها بنفسك
            </p>
            <button
              onClick={() => onNavigate('create-circle')}
              className="mt-1 px-4 py-2 bg-[#714a23] text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-xs"
            >
              إنشاء جمعية الآن
            </button>
          </div>
        ) : (
          filteredCircles.map((circle) => {
            const circleUserProgress = getMemberInstallmentProgress(circle, currentUid, currentEmail, payments);
            const isPendingPayment = circle.myPaymentStatus === 'pending';
            const isUnderReview = circle.myPaymentStatus === 'under_review';
            const isPaid = circle.myPaymentStatus === 'paid' || circleUserProgress.isCompleted;
            const progressPercent = Math.round((circle.completedMonths / circle.totalMonths) * 100);

            const myMemberObj = (circle.members || []).find(
              (m) =>
                (currentUid && m.id === currentUid) ||
                (currentEmail && m.email && m.email.trim().toLowerCase() === currentEmail.trim().toLowerCase()) ||
                m.isCurrentUser
            );
            const userShares = myMemberObj?.sharesCount || circle.mySharesCount || 1;
            const singleSharePrice = circle.sharePrice || circle.monthlyShare || 1000;
            const memberMonthlyTotal = singleSharePrice * userShares;

            const myAssignments = (circle.shareTurnAssignments || []).filter(
              (a) => (currentUid && a.memberId === currentUid) || (myMemberObj && a.memberName === myMemberObj.name)
            );
            const myTurnText = circle.isConfirmedByAdmin
              ? (myAssignments.length > 0
                  ? myAssignments.map((a) => a.monthName).join(' و ')
                  : (myMemberObj?.payoutMonth || circle.myTurnMonth || 'محدد بالقرعة'))
              : 'بعد تعميد الجمعية';

            return (
              <div
                key={circle.id}
                className="w-full rounded-2xl bg-white p-4 shadow-sm border border-[#e5e2dc] flex flex-col gap-3 hover:shadow-md transition-shadow relative overflow-hidden"
              >
                {/* Card Top Title & Status Chip */}
                <div className="flex items-start justify-between gap-2 text-right">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {isPaid ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-600" />
                          <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                            تم دفع قسط هذا الشهر
                          </span>
                        </>
                      ) : isUnderReview ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-[#896425] animate-ping" />
                          <span className="text-[10px] text-[#6d4c0d] font-bold bg-[#ffdeae]/40 px-2 py-0.5 rounded-md">
                            إيصالك قيد المراجعة ⏳
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                          <span className="text-[10px] text-amber-900 font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                            متبقي {circle.daysLeftForPayment || 4} أيام للسداد ⏳
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-extrabold text-sm text-[#1c1c18] truncate">{circle.title}</h4>
                      {Boolean(
                        (circle.creatorId && circle.creatorId === (userProfile?.id || auth.currentUser?.uid)) ||
                        (circle.organizer?.creatorId && circle.organizer.creatorId === (userProfile?.id || auth.currentUser?.uid)) ||
                        (circle.creatorEmail && circle.creatorEmail === (userProfile?.email || auth.currentUser?.email))
                      ) && (
                        <span className="text-[9px] font-bold bg-[#ffdeae] text-[#714a23] px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[10px]">shield_person</span>
                          <span>أنت المنشئ</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[10px] text-[#50453b]">قسطك الشهري</span>
                    <span className="text-sm font-black text-[#714a23]">
                      {memberMonthlyTotal.toLocaleString('ar-YE')} {circle.currencySymbol}
                    </span>
                    <span className="text-[9px] text-[#50453b]">
                      ({userShares} {userShares === 1 ? 'سهم' : 'أسهم'})
                    </span>
                  </div>
                </div>

                {/* Middle Details Bar & Progress */}
                <div className="p-3 rounded-xl bg-[#f6f3ed] flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-[#50453b]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-[#714a23]">
                        {circle.myTurnReceived ? 'check_circle' : 'event_upcoming'}
                      </span>
                      <span>
                        دورك: <strong className="text-[#1c1c18] font-bold">{myTurnText}</strong>
                      </span>
                    </div>
                    <span>
                      يستلم كل شهر:{' '}
                      <strong className="text-[#714a23] font-bold">
                        {(circle.monthlyPayout || (singleSharePrice * (circle.totalMonths || circle.sharesCount || 6))).toLocaleString('ar-YE')} {circle.currencySymbol}
                      </strong>
                    </span>
                  </div>

                  {/* Track Progress Bar */}
                  <div className="w-full bg-[#e5e2dc] h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-[#714a23] h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-[#50453b]">
                    <span>{circle.completedMonths} أشهر مكتملة</span>
                    <span>إجمالي {circle.totalMonths} أشهر</span>
                  </div>
                </div>

                {/* Member Installment Progress Mini-Badge on Circle Card */}
                <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 bg-[#f6f3ed] rounded-xl border border-[#e5e2dc]/80">
                  <span className="text-[#50453b] flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-[#714a23]">payments</span>
                    <span>أقساطك المسددة:</span>
                  </span>
                  {circleUserProgress.isCompleted ? (
                    <span className="font-bold text-emerald-700 flex items-center gap-1 font-sans">
                      <span className="material-symbols-outlined text-xs">verified</span>
                      <span>مكتمل {circleUserProgress.paidInstallmentsCount}/{circleUserProgress.totalRequiredInstallments} (١٠٠%)</span>
                    </span>
                  ) : (
                    <span className="font-bold text-[#714a23] font-sans">
                      {circleUserProgress.paidInstallmentsCount} من {circleUserProgress.totalRequiredInstallments} أقساط ({circleUserProgress.percent}%)
                    </span>
                  )}
                </div>

                {/* Organizer Uploaded Receipts Banner on Circle Card (Only when receipts are uploaded for this circle) */}
                {myAdminCircleIds.has(circle.id) &&
                  payments.some((p) => p.circleId === circle.id) && (
                    <div className="p-2.5 rounded-xl bg-[#ffdeae]/35 border border-[#edbf76] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-[#604101] font-bold min-w-0">
                        <span className="material-symbols-outlined text-base text-[#714a23] shrink-0">
                          receipt_long
                        </span>
                        <span className="truncate">
                          {payments.filter((p) => p.circleId === circle.id && p.status === 'under_review').length > 0
                            ? `إيصالات مرفوعة بانتظار التعميد (${payments.filter((p) => p.circleId === circle.id && p.status === 'under_review').length})`
                            : `سجل الإيصالات المرفوعة (${payments.filter((p) => p.circleId === circle.id).length})`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAdminApprovals
                            ? onOpenAdminApprovals(circle)
                            : onNavigate('admin-approvals')
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#2D6A4F] hover:bg-[#23533e] text-white text-[11px] font-bold shrink-0 cursor-pointer transition-all"
                      >
                        لوحة التعميد 👑
                      </button>
                    </div>
                  )}

                {/* Bottom Actions & Members */}
                <div className="flex items-center justify-between pt-1 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] text-[#50453b] truncate">
                      المستلم: <strong className="text-[#1c1c18]">{circle.currentRecipientName}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectCircle(circle)}
                      className="h-8 px-2.5 rounded-xl bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#50453b] text-xs font-bold transition-all cursor-pointer"
                    >
                      التفاصيل
                    </button>

                    {circleUserProgress.isCompleted ? (
                      <button
                        type="button"
                        onClick={() => onSelectCircle(circle)}
                        className="h-8 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs">verified</span>
                        <span>مكتمل ١٠٠%</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onPayDue(circle)}
                        className="h-8 px-3 rounded-xl bg-[#714a23] hover:bg-[#8c6239] text-white text-xs font-bold shadow-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">payment</span>
                        <span>
                          {isPaid ? 'قسط مقدّم' : isUnderReview ? 'متابعة الإيصال' : 'دفع القسط'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Traditional Yemeni Cultural Wisdom Footer */}
      <footer className="mt-6 mb-2 text-center flex flex-col items-center justify-center gap-1 opacity-80 select-none">
        <div className="flex items-center gap-2 text-[#714a23] font-bold">
          <span className="w-6 h-0.5 bg-[#714a23]/30 rounded-full" />
          <span className="text-xs tracking-wide">معًا .. نكمل الخير</span>
          <span className="w-6 h-0.5 bg-[#714a23]/30 rounded-full" />
        </div>
        <span className="text-[11px] text-[#50453b]">
          تطبيق هيا نجمعها للجمعيات والادخار بين الأهل والأصدقاء
        </span>
      </footer>
    </div>
  );
};
