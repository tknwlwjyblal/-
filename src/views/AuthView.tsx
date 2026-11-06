import React, { useState } from 'react';
import { UserProfile } from '../types';
import { loginWithGoogle, auth } from '../firebase';

interface Props {
  userProfile: UserProfile;
  onLoginSuccess: (customProfile?: Partial<UserProfile>) => void;
}

export const AuthView: React.FC<Props> = ({ userProfile, onLoginSuccess }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);

    try {
      const result = await loginWithGoogle();
      const fbUser = result.user;

      if (fbUser) {
        onLoginSuccess({
          id: fbUser.uid,
          fullName: fbUser.displayName || 'مشترك هيا نجمعها',
          email: fbUser.email || '',
          avatar: fbUser.photoURL || '/assets/aistudio/image_94928b82.png',
        });
      }
    } catch (err: unknown) {
      console.error('Google Sign-in error:', err);
      const errorStr = String(err);

      if (errorStr.includes('android-auth-not-configured')) {
        setErrorMessage('تسجيل الدخول غير مفعّل في هذه النسخة التجريبية. يلزم إعداد Google لتطبيق Android من قِبل مطوّر التطبيق.');
      } else if (errorStr.includes('popup-closed-by-user')) {
        setErrorMessage('تم إغلاق نافذة تسجيل الدخول من قِبل المستخدم. يرجى المحاولة مجددًا.');
      } else if (errorStr.includes('cancelled-popup-request') || errorStr.includes('popup-blocked')) {
        setErrorMessage('تم حظر النافذة المنبثقة من المتصفح، يرجى السماح بالنوافذ المنبثقة لـ Google.');
      } else {
        // If popup is blocked by iframe constraints, fallback to current Firebase auth user if present
        if (auth.currentUser) {
          onLoginSuccess({
            id: auth.currentUser.uid,
            fullName: auth.currentUser.displayName || userProfile.fullName,
            email: auth.currentUser.email || userProfile.email,
            avatar: auth.currentUser.photoURL || userProfile.avatar,
          });
        } else {
          setErrorMessage('تعذر إكمال تسجيل الدخول عبر Google. تأكد من اتصالك بالإنترنت والمحاولة مجدداً.');
        }
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex flex-col relative w-full flex-1 bg-[#fcf9f3] px-4 min-h-0 pb-8 text-right selection:bg-[#ffdcbf]" dir="rtl">
      {/* Subtle Heritage Qamariyah Ambient Glow */}
      <div className="absolute -top-12 -right-16 w-64 h-64 pointer-events-none opacity-20 -z-10">
        <svg className="w-full h-full text-[#896425]" fill="none" stroke="currentColor" viewBox="0 0 200 200">
          <path d="M100 10 C150 10 190 50 190 100 C190 150 150 190 100 190 C50 190 10 150 10 100 C10 50 50 10 100 10 Z" strokeWidth="1.2" />
          <path d="M100 25 C142 25 175 58 175 100 C175 142 142 175 100 175 C58 175 25 142 25 100 C25 58 58 25 100 25 Z" strokeDasharray="3,3" strokeWidth="0.8" />
          <path d="M100 35 L120 70 L160 70 L130 95 L142 135 L100 115 L58 135 L70 95 L40 70 L80 70 Z" strokeWidth="1" />
          <circle cx="100" cy="100" r="18" strokeWidth="1.2" />
        </svg>
      </div>

      <div className="absolute top-1/3 -left-20 w-56 h-56 pointer-events-none opacity-15 -z-10">
        <svg className="w-full h-full text-[#714a23]" fill="currentColor" viewBox="0 0 100 100">
          <polygon opacity="0.12" points="50,5 61,38 95,38 68,59 78,92 50,72 22,92 32,59 5,38 39,38" />
          <circle cx="50" cy="50" fill="none" r="30" stroke="currentColor" strokeDasharray="2 4" strokeWidth="1" />
        </svg>
      </div>

      {/* Top Decorative Header Bar */}
      <div className="w-full flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-1.5 bg-[#ebe8e2] px-3 py-1.5 rounded-full shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#6d4c0d] animate-pulse" />
          <span className="text-[11px] font-bold text-[#50453b]">محمي وموثوق بنكيًا</span>
        </div>

        {/* Country Badge */}
        <div className="flex items-center gap-1.5 bg-[#f6f3ed] px-2.5 py-1 rounded-full text-[#536161] border border-[#e5e2dc]">
          <span className="material-symbols-outlined text-[16px]">account_balance</span>
          <span className="text-[10px] font-black text-[#111e1e]">اليمن 🇾🇪</span>
        </div>
      </div>

      {/* Official App Logo Showcase - Hero Section */}
      <div className="w-full flex flex-col items-center text-center mt-3 mb-4">
        <div className="relative auth-logo shrink-0 rounded-3xl p-3 bg-gradient-to-b from-white via-[#f6f3ed] to-[#e5e2dc] shadow-xl border border-[#d4c3b7]/30 flex items-center justify-center">
          <img
            alt="شعار هيا نجمعها الرسمي"
            className="w-full h-full object-contain rounded-2xl drop-shadow-md"
            src="/assets/aistudio/image_94928b82.png"
          />
        </div>

        <div className="mt-4 px-2">
          <h1 className="text-xl sm:text-2xl font-black text-[#1c1c18] tracking-tight">هَيَّا نَجْمَعْهَا</h1>
          <p className="text-xs text-[#50453b] font-medium mt-1">
            إدارة الجمعيات الروتينية والادخار العائلي بأمان وثقة
          </p>
        </div>
      </div>

      {/* Trust & Value Proposition Bento Section */}
      <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-[#e5e2dc] mb-4 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#ffdcbf] flex items-center justify-center text-[#714a23]">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
          <div className="text-right">
            <h2 className="text-xs font-black text-[#1c1c18]">ضمان الشفافية والأدوار</h2>
            <p className="text-[10px] text-[#50453b]">تنظيم دور الاستلام وتأكيد الحوالات بضغطة واحدة</p>
          </div>
        </div>

        {/* Quick Micro Benefits */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-[#f6f3ed] p-2 rounded-xl flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-[#714a23] text-[22px] mb-1">alarm_on</span>
            <span className="text-[10px] text-[#1c1c18] font-bold">تذكير تلقائي</span>
            <span className="text-[9px] text-[#50453b]">قبل موعد قسطك</span>
          </div>

          <div className="bg-[#f6f3ed] p-2 rounded-xl flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-[#6d4c0d] text-[22px] mb-1">
              published_with_changes
            </span>
            <span className="text-[10px] text-[#1c1c18] font-bold">جدولة واضحة</span>
            <span className="text-[9px] text-[#50453b]">ترتيب أدوار عادل</span>
          </div>

          <div className="bg-[#f6f3ed] p-2 rounded-xl flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-[#714a23] text-[22px] mb-1">
              shield_with_heart
            </span>
            <span className="text-[10px] text-[#1c1c18] font-bold">أمان اجتماعي</span>
            <span className="text-[9px] text-[#50453b]">سندات إلكترونية</span>
          </div>
        </div>
      </div>

      {/* Real Google Sign-In Card (Strictly Real Google Auth - No Demo, No Phone) */}
      <div className="w-full bg-white rounded-2xl p-5 shadow-md border border-[#d4c3b7]/30 flex flex-col gap-4 relative">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0eee8]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
            </div>
            <span className="text-sm font-bold text-[#1c1c18]">المصادقة الرسمية المعتمدة</span>
          </div>
          <span className="text-[11px] text-[#2D6A4F] bg-emerald-50 border border-[#2D6A4F]/20 px-2.5 py-0.5 rounded-full font-bold">
            Google Secure Auth
          </span>
        </div>

        <p className="text-xs text-[#50453b] text-right leading-relaxed">
          سجّل الدخول بحسابك في Google لربط جمعياتك وحفظ سجلات الأقساط بأمان وسرية تامة.
        </p>

        {/* Hero Google Auth Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoggingIn}
          className="w-full h-14 bg-white hover:bg-[#f6f3ed] active:scale-[0.98] text-[#1c1c18] font-bold text-sm rounded-xl flex items-center justify-center gap-3 shadow-md border-2 border-[#8c6239]/30 hover:border-[#8c6239] transition-all cursor-pointer disabled:opacity-85"
          type="button"
        >
          {isLoggingIn ? (
            <div className="flex items-center gap-2 text-[#714a23]">
              <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
              <span>جاري فتح مصادقة Google الآمنة...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span className="font-extrabold text-[#1c1c18]">تسجيل الدخول عبر حساب Google</span>
            </div>
          )}
        </button>

        {/* Error Feedback if any */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold text-center leading-relaxed">
            {errorMessage}
          </div>
        )}

        {/* Security badge note */}
        <div className="flex items-center justify-center gap-1.5 pt-1 text-[#50453b]">
          <span className="material-symbols-outlined text-[16px] text-[#2D6A4F]" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified_user
          </span>
          <span className="text-[11px]">مصادقة مشفرة وآمنة 100% بنظام Google OAuth 2.0</span>
        </div>
      </div>

      {/* Traditional Yemeni Shibami Silhouette Footer Accent */}
      <div className="w-full mt-8 pt-4 flex flex-col items-center">
        <div className="w-full max-w-xs flex justify-center items-end gap-1.5 opacity-20 mb-2 text-[#714a23]">
          <div className="w-5 h-8 bg-current rounded-t-sm" />
          <div className="w-6 h-12 bg-current rounded-t-sm" />
          <div className="w-4 h-6 bg-current rounded-t-sm" />
          <div className="w-7 h-16 bg-current rounded-t-md" />
          <div className="w-5 h-10 bg-current rounded-t-sm" />
          <div className="w-6 h-14 bg-current rounded-t-md" />
          <div className="w-5 h-7 bg-current rounded-t-sm" />
        </div>

        {/* Security & Privacy Footer Notes */}
        <div className="text-center px-4">
          <p className="text-[11px] text-[#50453b] leading-relaxed">
            بالتسجيل والمتابعة، فإنك توافق على{' '}
            <span className="text-[#714a23] font-bold underline decoration-[#ffdcbf]">
              شروط الاستخدام
            </span>{' '}
            و{' '}
            <span className="text-[#714a23] font-bold underline decoration-[#ffdcbf]">
              ميثاق حماية البيانات المالية
            </span>.
          </p>
          <p className="text-[10px] text-[#50453b] opacity-75 mt-0.5">
            جميع المعاملات تتم بالاتفاق المتبادل وبتوثيق دوري متوافق مع العادات اليمنية الأصيلة
          </p>
        </div>
      </div>
    </div>
  );
};
