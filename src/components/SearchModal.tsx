import React, { useState } from 'react';
import { SavingsCircle } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  circles: SavingsCircle[];
  onSelectCircle: (circle: SavingsCircle) => void;
  onOpenJoinCircle: (code?: string) => void;
}

export const SearchModal: React.FC<Props> = ({
  isOpen,
  onClose,
  circles,
  onSelectCircle,
  onOpenJoinCircle,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filtered = circles.filter(
    (c) =>
      c.title.includes(query) ||
      c.code.toLowerCase().includes(query.toLowerCase()) ||
      c.currentRecipientName.includes(query) ||
      c.organizer.name.includes(query)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-12 animate-fade-in" dir="rtl">
      <div className="w-full max-w-md bg-[#fcf9f3] rounded-3xl shadow-2xl border border-[#d4c3b7]/40 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 bg-white border-b border-[#e5e2dc] flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <span className="material-symbols-outlined absolute right-3.5 text-[#50453b] text-xl">
              search
            </span>
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن اسم جمعية، عضو، أو رمز..."
              className="w-full h-12 pr-11 pl-4 bg-[#f6f3ed] text-[#1c1c18] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#8c6239] transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute left-3 w-6 h-6 rounded-full bg-[#dcdad4] text-[#50453b] flex items-center justify-center text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-bold text-[#714a23] hover:bg-[#f6f3ed] rounded-lg transition-all"
          >
            إلغاء
          </button>
        </div>

        {/* Results List */}
        <div className="p-4 overflow-y-auto space-y-2">
          {query.trim().length > 0 && query.toUpperCase().startsWith('HYA') && (
            <div className="p-3 rounded-xl bg-[#ffdeae]/40 border border-[#edbf76] flex items-center justify-between">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-[#714a23]">رمز دعوة جمعية مكتشف</span>
                <span className="text-sm font-mono font-bold text-[#1c1c18]">{query.toUpperCase()}</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenJoinCircle(query.toUpperCase());
                }}
                className="px-3 py-1.5 rounded-lg bg-[#714a23] text-white font-bold text-xs"
              >
                الانضمام
              </button>
            </div>
          )}

          {filtered.length > 0 ? (
            filtered.map((circle) => (
              <div
                key={circle.id}
                onClick={() => {
                  onSelectCircle(circle);
                  onClose();
                }}
                className="p-3 rounded-2xl bg-white hover:bg-[#f6f3ed] active:scale-98 transition-all border border-[#e5e2dc] shadow-xs cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#ffdcbf] text-[#714a23] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">groups</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-sm font-bold text-[#1c1c18]">{circle.title}</span>
                    <span className="text-xs text-[#50453b]">
                      السهم: {circle.monthlyShare.toLocaleString('ar-YE')} {circle.currencySymbol} • {circle.myTurnMonth}
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-sm text-[#714a23]">chevron_left</span>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-[#50453b]">
              <span className="material-symbols-outlined text-4xl text-[#d4c3b7] mb-2">search_off</span>
              <p className="text-xs font-medium">لم يتم العثور على جمعية مطابقة للبحث</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
