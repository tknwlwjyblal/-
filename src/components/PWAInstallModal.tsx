import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultPlatform?: 'ios' | 'android';
}

export const PWAInstallModal: React.FC<Props> = ({ isOpen, onClose, defaultPlatform = 'ios' }) => {
  const { isInstallable, install, isInstalled } = usePWAInstall();
  const [activePlatform, setActivePlatform] = useState<'ios' | 'android'>(defaultPlatform);
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    try {
      const res = await install();
      if (res) {
        setInstallStatus('تم تثبيت التطبيق بنجاح على جهازك!');
        setTimeout(() => onClose(), 2000);
      }
    } catch {
      setInstallStatus('يرجى اتباع الخطوات الموضحة بالأسفل لتثبيت التطبيق.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" dir="rtl">
      <div className="w-full max-w-md bg-[#fcf9f3] rounded-3xl shadow-2xl border border-[#d4c3b7]/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header with Yemeni Heritage branding */}
        <div className="bg-gradient-to-r from-[#714a23] via-[#8c6239] to-[#5b3816] text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute left-4 top-4 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all text-white active:scale-95"
            aria-label="إغلاق"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md p-1 border border-white/20 flex items-center justify-center shadow-inner">
              <img
                src="/assets/aistudio/Image_22_58724122.png"
                alt="شعار هيا نجمعها"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-[11px] font-bold text-[#ffdeae] tracking-wider uppercase flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                تطبيق أصيل يعمل بدون متجر (PWA)
              </span>
              <h2 className="text-xl font-black text-white">تثبيت تطبيق هيا نجمعها</h2>
            </div>
          </div>
        </div>

        {/* Platform Selector Tabs */}
        <div className="p-4 border-b border-[#e5e2dc] bg-[#f0eee8]">
          <div className="grid grid-cols-2 p-1 bg-[#e5e2dc] rounded-2xl gap-1">
            <button
              onClick={() => setActivePlatform('ios')}
              className={`py-2.5 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                activePlatform === 'ios'
                  ? 'bg-white text-[#714a23] shadow-sm'
                  : 'text-[#50453b] hover:text-[#1c1c18]'
              }`}
            >
              <span className="material-symbols-outlined text-lg">phone_iphone</span>
              <span>لأجهزة الآيفون (iOS)</span>
            </button>
            <button
              onClick={() => setActivePlatform('android')}
              className={`py-2.5 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                activePlatform === 'android'
                  ? 'bg-white text-[#714a23] shadow-sm'
                  : 'text-[#50453b] hover:text-[#1c1c18]'
              }`}
            >
              <span className="material-symbols-outlined text-lg">phone_android</span>
              <span>لأجهزة الأندرويد (Android)</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {installStatus && (
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold text-center border border-emerald-300">
              {installStatus}
            </div>
          )}

          {isInstalled && (
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              التطبيق مثبت ومفتوح حالياً بصيغة الشاشة الكاملة على هاتفك!
            </div>
          )}

          {activePlatform === 'ios' ? (
            <div className="space-y-3.5">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#e5e2dc] space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#ffdcbf] text-[#714a23] font-black flex items-center justify-center shrink-0">
                    ١
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#1c1c18]">افتح متصفح سفاري (Safari)</h4>
                    <p className="text-xs text-[#50453b] mt-0.5">
                      تأكد أنك تفتح هذا الرابط في متصفح Safari على جهاز الآيفون أو الآيباد الخاص بك.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-[#f0eee8]">
                  <div className="w-8 h-8 rounded-full bg-[#ffdcbf] text-[#714a23] font-black flex items-center justify-center shrink-0">
                    ٢
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#1c1c18] flex items-center gap-1.5">
                      اضغط على زر المشاركة
                      <span className="w-6 h-6 rounded-md bg-[#e5e2dc] flex items-center justify-center text-[#714a23]">
                        <span className="material-symbols-outlined text-sm">ios_share</span>
                      </span>
                    </h4>
                    <p className="text-xs text-[#50453b] mt-0.5">
                      ستجد زر المشاركة في الشريط السفلي لشاشة هاتف الآيفون (مربع يخرج منه سهم للأعلى).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-[#f0eee8]">
                  <div className="w-8 h-8 rounded-full bg-[#ffdcbf] text-[#714a23] font-black flex items-center justify-center shrink-0">
                    ٣
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#1c1c18] flex items-center gap-1.5">
                      اختر «إضافة إلى الشاشة الرئيسية»
                      <span className="w-6 h-6 rounded-md bg-[#e5e2dc] flex items-center justify-center text-[#714a23]">
                        <span className="material-symbols-outlined text-sm">add_box</span>
                      </span>
                    </h4>
                    <p className="text-xs text-[#50453b] mt-0.5">
                      انزل لأسفل القائمة واضغط على <strong className="text-[#714a23]">"إضافة إلى الصفحة الرئيسية" (Add to Home Screen)</strong> ثم اضغط <strong className="text-[#714a23]">"إضافة" (Add)</strong> في أعلى الزاوية.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#ffdeae]/30 border border-[#edbf76]/50 flex items-center gap-3">
                <span className="material-symbols-outlined text-[#6d4c0d] text-2xl">offline_pin</span>
                <p className="text-xs text-[#604101] leading-relaxed">
                  سيظهر التطبيق كأيقونة مستقلة كاملة الشاشة تماماً مثل تطبيقات App Store، ويعمل بسرعة فائقة وبدون أشرطة المتصفح!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {isInstallable && (
                <button
                  onClick={handleNativeInstall}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#714a23] to-[#8c6239] text-white font-bold text-base shadow-lg shadow-[#8c6239]/20 flex items-center justify-center gap-2 hover:brightness-105 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-2xl">download</span>
                  <span>تثبيت فوري على أندرويد الآن</span>
                </button>
              )}

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#e5e2dc] space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#ffdcbf] text-[#714a23] font-black flex items-center justify-center shrink-0">
                    ١
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#1c1c18]">افتح متصفح كروم (Google Chrome)</h4>
                    <p className="text-xs text-[#50453b] mt-0.5">
                      أو متصفح سامسونج أو فايرفوكس على هاتفك الأندرويد.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-[#f0eee8]">
                  <div className="w-8 h-8 rounded-full bg-[#ffdcbf] text-[#714a23] font-black flex items-center justify-center shrink-0">
                    ٢
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#1c1c18] flex items-center gap-1.5">
                      اضغط على خيارات القائمة
                      <span className="w-6 h-6 rounded-md bg-[#e5e2dc] flex items-center justify-center text-[#714a23]">
                        <span className="material-symbols-outlined text-sm">more_vert</span>
                      </span>
                    </h4>
                    <p className="text-xs text-[#50453b] mt-0.5">
                      اضغط على النقاط الثلاث في أعلى يسار أو يمين المتصفح.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-[#f0eee8]">
                  <div className="w-8 h-8 rounded-full bg-[#ffdcbf] text-[#714a23] font-black flex items-center justify-center shrink-0">
                    ٣
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#1c1c18] flex items-center gap-1.5">
                      اختر «تثبيت التطبيق» أو «إضافة للشاشة الرئيسية»
                      <span className="w-6 h-6 rounded-md bg-[#e5e2dc] flex items-center justify-center text-[#714a23]">
                        <span className="material-symbols-outlined text-sm">install_mobile</span>
                      </span>
                    </h4>
                    <p className="text-xs text-[#50453b] mt-0.5">
                      اضغط على <strong className="text-[#714a23]">"Install App"</strong> أو <strong className="text-[#714a23]">"إضافة إلى الشاشة الرئيسية"</strong> لتثبيت التطبيق على جهازك.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-700 text-2xl">verified</span>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  تطبيق معتمد متوافق مع نظام أندرويد (APK / PWA) مع دعم كامل للإشعارات الفورية عند حلول موعد القسط أو استلام الدور.
                </p>
              </div>
            </div>
          )}

          {/* Quick Share Link Feature */}
          <div className="bg-[#f0eee8] rounded-2xl p-4 text-center space-y-2">
            <span className="text-xs text-[#50453b] font-medium block">
              تريد فتحه وتثبيته مباشرة على جوالك الآن؟
            </span>
            <button
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  alert('تم نسخ رابط التطبيق! أرسله لواتساب جوالك وافتحه هناك مباشرة.');
                }
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-[#e5e2dc] text-[#714a23] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs border border-[#d4c3b7]/30"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              <span>نسخ رابط التطبيق لفتحه على الهاتف</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e5e2dc] bg-white flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#e5e2dc] hover:bg-[#dcdad4] text-[#1c1c18] font-bold text-sm transition-all"
          >
            حسناً، فهمت
          </button>
        </div>
      </div>
    </div>
  );
};
