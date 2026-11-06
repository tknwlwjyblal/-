import React from 'react';
import { ActiveView, UserProfile, isSuperAdminEmail, isUserProfileComplete } from '../types';
import { auth } from '../firebase';

interface Props {
  currentView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  userProfile: UserProfile;
  onOpenSearch: () => void;
  title?: string;
}

export const Header: React.FC<Props> = ({
  currentView,
  onNavigate,
  userProfile,
  onOpenSearch,
  title,
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
              className="w-10 h-10 flex items-center justify-center rounded-full text-[#1c1c18] hover:bg-[#ebe8e2] active:scale-95 transition-all -mr-2 cursor-pointer"
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
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            onClick={() => onNavigate('profile')}
            className="relative active:scale-95 transition-transform"
            aria-label="الإعدادات والحساب"
          >
            <img
              src={userProfile.avatar}
              alt={userProfile.fullName}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-[#714a23]/25 shadow-sm"
            />
            <span className="absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-2 ring-white"></span>
          </button>
          <div className="flex flex-col text-right min-w-0">
            <span className="text-[10px] font-bold text-[#50453b] flex items-center gap-1">
              مرحباً بعودتك <span className="text-xs">✨</span>
            </span>
            <h1 className="truncate text-base font-black text-[#1c1c18] leading-tight">
              {userProfile.fullName.split(' ').slice(0, 2).join(' ')}
            </h1>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => onNavigate('home')}
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#714a23] hover:bg-[#ebe8e2] active:scale-95 transition-all"
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
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#f6f3ed] text-[#50453b] hover:text-[#714a23] active:scale-95 transition-all shadow-xs border border-[#d4c3b7]/20"
          >
            <span className="material-symbols-outlined text-xl">search</span>
          </button>

          <button
            onClick={() => onNavigate('notifications')}
            aria-label="الإشعارات"
            className="relative w-10 h-10 rounded-xl bg-[#ebe8e2] flex items-center justify-center text-[#714a23] active:scale-95 transition-all shadow-xs border border-[#d4c3b7]/20"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ba1a1a] ring-2 ring-white" />
          </button>

          <div className="w-10 h-10 rounded-xl bg-[#ebe8e2] flex items-center justify-center p-1 shadow-xs border border-[#d4c3b7]/20">
            <img
              src="/assets/aistudio/image_94928b82.png"
              alt="شعار هيا نجمعها الرسمي"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}

    </header>
  );
};

