import React, { useState } from 'react';
import { SavingsCircle, Currency, CircleType } from '../types';

interface Props {
  circle: SavingsCircle;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCircle: SavingsCircle) => void;
}

export const EditCircleModal: React.FC<Props> = ({ circle, isOpen, onClose, onSave }) => {
  const [title, setTitle] = useState(circle.title);
  const [type, setType] = useState<CircleType>(circle.type || 'collective');
  const [currency, setCurrency] = useState<Currency>(circle.currency);
  const [sharePrice, setSharePrice] = useState<number>(
    circle.sharePrice || circle.monthlyShare || 1000
  );
  const [sharesCount, setSharesCount] = useState<number>(
    circle.sharesCount || circle.totalMonths || circle.membersCount || 30
  );
  const [kuraimiAcc, setKuraimiAcc] = useState<string>(
    circle.cashierBankAccounts?.kuraimiAccount || ''
  );
  const [walletAcc, setWalletAcc] = useState<string>(
    circle.cashierBankAccounts?.jeebWallet || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currencySymbols: Record<Currency, string> = {
    YER: 'ر.ي',
    SAR: 'ر.س',
    USD: '$',
  };

  const currSymbol = currencySymbols[currency];

  // Duration in months is locked to equal total shares count:
  // Each month, 1 person receives the monthly pool
  const totalMonths = sharesCount;
  const monthlyPayout = sharePrice * sharesCount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || sharePrice <= 0 || sharesCount < 2) return;

    setIsSubmitting(true);

    const updatedCircle: SavingsCircle = {
      ...circle,
      title: title.trim(),
      type,
      currency,
      currencySymbol: currSymbol,
      sharePrice,
      sharesCount,
      monthlyPayout,
      totalPool: monthlyPayout,
      totalMonths,
      membersCount: sharesCount,
      monthlyShare: (circle.mySharesCount || 1) * sharePrice,
      cashierBankAccounts: {
        kuraimiAccount: kuraimiAcc.trim() || undefined,
        jeebWallet: walletAcc.trim() || undefined,
      },
    };

    setTimeout(() => {
      setIsSubmitting(false);
      onSave(updatedCircle);
      onClose();
    }, 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-[#fcf9f3] w-full max-w-lg rounded-3xl shadow-2xl border border-[#e5e2dc] overflow-hidden my-6 animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-l from-[#8c6239] via-[#714a23] to-[#5b3816] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl text-[#ffdeae]">edit_note</span>
            </div>
            <div>
              <h3 className="text-base font-black text-white">تعديل معلومات الجمعية</h3>
              <p className="text-[11px] text-[#ffdeae] opacity-90">
                أنت منشئ الجمعية والمنظم المعتمد
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-right max-h-[75vh] overflow-y-auto">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#1c1c18]" htmlFor="editCircleTitle">
              اسم الجمعية <span className="text-[#ba1a1a]">*</span>
            </label>
            <input
              id="editCircleTitle"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-11 px-3.5 bg-white text-[#1c1c18] rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#714a23]/30 border border-[#e5e2dc]"
              placeholder="مثال: جمعية الأهل والأصدقاء"
            />
          </div>

          {/* Type Toggle */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[#1c1c18]">نوع الجمعية</span>
            <div className="grid grid-cols-2 gap-2 bg-[#f0eee8] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setType('collective')}
                className={`h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  type === 'collective'
                    ? 'bg-white text-[#714a23] shadow-xs'
                    : 'text-[#50453b] hover:text-[#1c1c18]'
                }`}
              >
                <span className="material-symbols-outlined text-base">groups</span>
                <span>جمعية جماعية</span>
              </button>
              <button
                type="button"
                onClick={() => setType('solo')}
                className={`h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  type === 'solo'
                    ? 'bg-white text-[#714a23] shadow-xs'
                    : 'text-[#50453b] hover:text-[#1c1c18]'
                }`}
              >
                <span className="material-symbols-outlined text-base">person</span>
                <span>ادخار فردي</span>
              </button>
            </div>
          </div>

          {/* Currency Selection */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[#1c1c18]">العملة</span>
            <div className="grid grid-cols-3 gap-2">
              {(['SAR', 'YER', 'USD'] as Currency[]).map((c) => {
                const label = c === 'SAR' ? 'ريال سعودي' : c === 'YER' ? 'ريال يمني' : 'دولار';
                const isSelected = currency === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all border ${
                      isSelected
                        ? 'bg-[#714a23] text-white border-[#714a23]'
                        : 'bg-white text-[#1c1c18] border-[#e5e2dc] hover:bg-[#f6f3ed]'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="text-[10px] opacity-75">({currencySymbols[c]})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Share Price Input (سعر السهم) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#1c1c18]" htmlFor="editSharePrice">
              سعر السهم (قسط السهم الواحد شهرياً) <span className="text-[#ba1a1a]">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="editSharePrice"
                type="number"
                step="100"
                min="100"
                required
                value={sharePrice}
                onChange={(e) => setSharePrice(Math.max(1, parseFloat(e.target.value) || 0))}
                className="w-full h-11 pr-3 pl-14 bg-white text-[#1c1c18] rounded-xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-[#714a23]/30 border border-[#e5e2dc] font-sans"
              />
              <span className="absolute left-3 text-xs font-bold text-[#714a23] bg-[#f0eee8] px-2 py-0.5 rounded-lg">
                {currSymbol}
              </span>
            </div>
          </div>

          {/* Steppers: Total Shares and Locked Months */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Total Shares */}
            <div className="flex flex-col gap-1 p-3 bg-white rounded-xl border border-[#e5e2dc]">
              <span className="text-[11px] text-[#50453b] font-bold">إجمالي عدد الأسهم</span>
              <div className="flex items-center justify-between mt-1">
                <button
                  type="button"
                  onClick={() => setSharesCount((m) => Math.max(2, m - 1))}
                  className="w-7 h-7 rounded-lg bg-[#f0eee8] hover:bg-[#e5e2dc] flex items-center justify-center text-[#1c1c18] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">remove</span>
                </button>
                <span className="text-base font-bold font-sans text-[#1c1c18]">{sharesCount} أسهم</span>
                <button
                  type="button"
                  onClick={() => setSharesCount((m) => Math.min(100, m + 1))}
                  className="w-7 h-7 rounded-lg bg-[#ffdcbf] text-[#714a23] flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
              </div>
            </div>

            {/* Locked Months Duration */}
            <div className="flex flex-col justify-between p-3 bg-[#f6f3ed] rounded-xl border border-[#d4c3b7]/60">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#50453b] font-bold">مدة الجمعية</span>
                <span className="px-1.5 py-0.5 rounded bg-[#e5e2dc] text-[#50453b] text-[9px] font-bold flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[10px]">lock</span>
                  <span>مغلق</span>
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-black font-sans text-[#714a23]">{totalMonths}</span>
                <span className="text-xs text-[#714a23] font-bold">أشهر</span>
              </div>
              <span className="text-[9px] text-[#50453b] mt-0.5">(= {sharesCount} سهم)</span>
            </div>
          </div>

          {/* Real-time Recalculated Card */}
          <div className="rounded-xl p-3.5 bg-[#f6f3ed] border border-[#edbf76]/50 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#6d4c0d]">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">calculate</span>
                <span>الحساب التلقائي للجمعية:</span>
              </span>
              <span className="text-[10px] bg-[#ffdeae] px-2 py-0.5 rounded-full">محدث لحظياً</span>
            </div>

            <div className="flex items-baseline justify-between pt-1 border-t border-[#714a23]/10 text-xs">
              <span className="text-[#50453b]">قسط السهم الواحد شهرياً:</span>
              <span className="font-bold font-sans text-[#1c1c18]">
                {sharePrice.toLocaleString('ar-YE')} {currSymbol}
              </span>
            </div>

            <div className="flex items-baseline justify-between text-xs">
              <span className="font-bold text-[#1c1c18]">يستلم كل شهر واحد:</span>
              <span className="text-lg font-black font-sans text-[#714a23]">
                {monthlyPayout.toLocaleString('ar-YE')} {currSymbol}
              </span>
            </div>

            <div className="text-[10px] text-[#50453b] pt-1 border-t border-[#714a23]/10">
              {sharePrice.toLocaleString('ar-YE')} {currSymbol} (سعر السهم) × {sharesCount} سهم = {monthlyPayout.toLocaleString('ar-YE')} {currSymbol} حصيلة الاستلام كل شهر
            </div>
          </div>

          {/* Bank / Wallet Accounts for payment reception */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-xs font-bold text-[#1c1c18]">بيانات استلام الأقساط (اختياري)</span>
            
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-[#50453b]" htmlFor="editKuraimi">
                رقم حساب بنك الكريمي
              </label>
              <input
                id="editKuraimi"
                type="text"
                value={kuraimiAcc}
                onChange={(e) => setKuraimiAcc(e.target.value)}
                placeholder="مثال: 300482910"
                className="w-full h-10 px-3 bg-white text-[#1c1c18] rounded-lg text-xs border border-[#e5e2dc] font-mono"
                dir="ltr"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-[#50453b]" htmlFor="editWallet">
                رقم المحفظة الإلكترونية (كاش / جيب / ون كاش)
              </label>
              <input
                id="editWallet"
                type="text"
                value={walletAcc}
                onChange={(e) => setWalletAcc(e.target.value)}
                placeholder="مثال: 771234567"
                className="w-full h-10 px-3 bg-white text-[#1c1c18] rounded-lg text-xs border border-[#e5e2dc] font-mono"
                dir="ltr"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-[#e5e2dc]">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-11 bg-[#714a23] hover:bg-[#8c6239] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-base">save</span>
              )}
              <span>حفظ وتحديث معلومات الجمعية</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 h-11 bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#50453b] rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
