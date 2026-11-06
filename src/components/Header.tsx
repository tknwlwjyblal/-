import React from 'react';
import { ActiveView, UserProfile, isSuperAdminEmail, isUserProfileComplete } from '../types';
import { auth } from '../firebase';

interface Props {
  currentView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  userProfile: UserProfile;
  onOpenSearch: () => void;
  title?: string;
  unreadCount?: number;
}

export const Header: React.FC<Props> = ({
  currentView,
  onNavigate,
  userProfile,
  onOpenSearch,
  title,
  unreadCount = 0,
}) => {
  const isHome = currentView === 'home';
  const isSuperAdmin = isSuperAdminEmail(userProfile.email || auth.currentUser?.email);
  const isProfileDone = isUserProfileComplete(userProfile);

  return (
    <header className="app-header sticky w-full z-30 bg-[#fcf9f3]/90 backdrop-blur-xl border-b border-[#714a23]/10 shadow-[0_1px_12px_rgba(113,74,35,0.06)] px-3 sm:px-4 min-h-16 gap-2 py-2 flex items-center justify-between transition-all select-none">
      {currentView === 'profile' ? (
        <div className="flex items-center gap-2 min-w-0">
          {isProfileDone ? (
            <button
              onClick={() => onNavigate('home')}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[#1c1c18] hover:bg-[#ebe8e2] active:scale-95 transition-all -mr-2 cursor-pointer"
              aria-label="الرجوع"
            >
              <span className="material-symbols-outlined text-2xl">arrow_forward</span>
            </button>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#ffdcbf] text-[#714a23] flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">verified_user</span>
            </div>
          )}
          <div className="flex flex-col text-right min-w-0">
            <h1 className="truncate text-base font-extrabold text-[#1c1c18]">
              {isProfileDone ? 'الإعدادات' : 'إكمال الحساب (لأول مرة فقط)'}
            </h1>
            <span className="text-[10px] font-bold text-[#2D6A4F]">
              {isProfileDone ? 'إدارة الحساب والتفضيلات ولوحة التحكم ✓' : 'خطوة إجبارية لمرة واحدة فقط'}
            </span>
          </div>
        </div>
      ) : isHome ? (
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-[#392b1e]">هيا نجمعها</h1>
          <p className="text-[11px] text-[#8b7d6c] truncate mt-1">أهلاً، {userProfile.fullName.split(' ').slice(0, 2).join(' ')}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => onNavigate('home')}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[#714a23] hover:bg-[#ebe8e2] active:scale-95 transition-all"
            aria-label="رجوع"
          >
            <span className="material-symbols-outlined text-2xl">arrow_forward</span>
          </button>
          <div className="flex flex-col text-right min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8c6239] inline-block"></span>
              <span className="text-[10px] font-bold text-[#714a23] uppercase tracking-wide">
                هيا نجمعها
              </span>
            </div>
            <h1 className="truncate text-base font-extrabold text-[#1c1c18] truncate max-w-full">
              {title || 'التفاصيل'}
            </h1>
          </div>
        </div>
      )}

      {/* Left side actions (or Official Logo in Profile Setup) */}
      {currentView === 'profile' ? (
        <div className="flex items-center">
          <img
            src="/assets/aistudio/image_94928b82.png"
            alt="شعار هيا نجمعها"
            className="w-8 h-8 rounded-full object-contain ring-2 ring-[#8c6239]/20 shadow-xs"
          />
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenSearch}
            aria-label="البحث"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#f6f3ed] text-[#50453b] hover:text-[#714a23] active:scale-95 transition-all shadow-xs border border-[#d4c3b7]/20"
          >
            <span className="material-symbols-outlined text-xl">search</span>
          </button>

          <button
            onClick={() => onNavigate('notifications')}
            aria-label="الإشعارات"
            className="relative w-9 h-9 rounded-xl bg-[#ebe8e2] flex items-center justify-center text-[#714a23] active:scale-95 transition-all shadow-xs border border-[#d4c3b7]/20"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 text-[9px] flex items-center justify-center rounded-full bg-[#714a23] text-white ring-2 ring-[#fcf9f3]">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>


        </div>
      )}

    </header>
  );
};

