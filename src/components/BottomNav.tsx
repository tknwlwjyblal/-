import React from 'react';
import { ActiveView, isSuperAdminEmail } from '../types';
import { auth } from '../firebase';

interface Props {
  currentView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  unreadCount?: number;
  userEmail?: string;
}

export const BottomNav: React.FC<Props> = ({
  currentView,
  onNavigate,
  unreadCount = 2,
  userEmail,
}) => {
  const isSuperAdmin = isSuperAdminEmail(userEmail || auth.currentUser?.email);

  const tabs = [
    {
      id: 'home' as ActiveView,
      label: 'الرئيسية',
      icon: 'home',
    },
    {
      id: 'my-circles' as ActiveView,
      label: 'جمعياتي',
      icon: 'diversity_3',
    },
    {
      id: 'notifications' as ActiveView,
      label: 'الإشعارات',
      icon: 'notifications',
      badge: unreadCount,
    },
    {
      id: 'profile' as ActiveView,
      label: 'الإعدادات',
      icon: 'settings',
    },
  ];

  return (
    <nav className="app-bottom-nav fixed bottom-0 mx-auto z-40 bg-[#fcf9f3]/95 backdrop-blur-xl border-t border-[#714a23]/10 shadow-[0_-4px_24px_rgba(92,61,46,0.08)] pb-safe select-none">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const isActive =
            currentView === tab.id ||
            (tab.id === 'home' && (currentView === 'circle-detail' || currentView === 'payment' || currentView === 'admin-approvals')) ||
            (tab.id === 'my-circles' && (currentView === 'create-circle' || currentView === 'join-circle'));

          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center min-w-0 flex-1 min-h-12 transition-all duration-200 active:scale-95 ${
                isActive ? 'text-[#714a23] font-bold' : 'text-[#50453b] hover:text-[#714a23]'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[23px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {tab.icon}
                </span>
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] rounded-full bg-[#ba1a1a] text-white text-[9px] font-black flex items-center justify-center px-0.5 ring-2 ring-[#fcf9f3]">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[11px] mt-0.5 ${isActive ? 'font-extrabold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
