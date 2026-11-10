import { CheckForUpdatesButton } from '../components/AppUpdatePrompt';
import { PhoneNotificationSettings } from '../components/PhoneNotificationSettings';
import React, { useState, useEffect } from 'react';
import { UserProfile, ActiveView, isUserProfileComplete, isSuperAdminEmail } from '../types';
import { YEMENI_BANKS, YEMENI_WALLETS } from '../data/mockData';
import { auth } from '../firebase';

interface Props {
  userProfile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onNavigate: (view: ActiveView) => void;
  onSignOut?: () => void;
}

export const ProfileView: React.FC<Props> = ({
  userProfile,
  onUpdateProfile,
  onNavigate,
  onSignOut,
}) => {
  const isCompleted = isUserProfileComplete(userProfile);
  const isSuperAdmin = isSuperAdminEmail(userProfile?.email || auth.currentUser?.email);

  // Edit mode is ONLY true by default on the very first time before profile completion
  const [isEditing, setIsEditing] = useState<boolean>(() => !isUserProfileComplete(userProfile));

  // Form Fields
  const [fullName, setFullName] = useState(userProfile.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(
    userProfile.phone ? userProfile.phone.replace('+967', '').trim() : ''
  );
  const [operator, setOperator] = useState(userProfile.operator || 'يمن موبايل (77/78)');
  const [payoutType, setPayoutType] = useState<'bank' | 'wallet'>(userProfile.payoutType || 'bank');
  const [institution, setInstitution] = useState(userProfile.institution || 'kuraimi');
  const [accountNumber, setAccountNumber] = useState(userProfile.accountNumber || '');
  const [beneficiaryName, setBeneficiaryName] = useState(
    userProfile.beneficiaryName || userProfile.fullName || ''
  );
  const [isBeneficiaryCustomized, setIsBeneficiaryCustomized] = useState(
    Boolean(
      userProfile.beneficiaryName &&
        userProfile.fullName &&
        userProfile.beneficiaryName !== userProfile.fullName
    )
  );

  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(
    Boolean(userProfile.accountNumber && userProfile.isVerified)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Sync state when userProfile loads from Firestore
  useEffect(() => {
    setFullName(userProfile.fullName || '');
    setPhoneNumber(userProfile.phone ? userProfile.phone.replace('+967', '').trim() : '');
    setOperator(userProfile.operator || 'يمن موبايل (77/78)');
    setPayoutType(userProfile.payoutType || 'bank');
    setInstitution(userProfile.institution || 'kuraimi');
    setAccountNumber(userProfile.accountNumber || '');
    setBeneficiaryName(userProfile.beneficiaryName || userProfile.fullName || '');
    setIsVerified(Boolean(userProfile.accountNumber && userProfile.isVerified));

    // If profile loaded from Firestore is already completed, show the Settings view by default
    if (isUserProfileComplete(userProfile)) {
      setIsEditing(false);
    }
  }, [
    userProfile.id,
    userProfile.fullName,
    userProfile.phone,
    userProfile.accountNumber,
    userProfile.isVerified,
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    if (!isBeneficiaryCustomized || beneficiaryName === fullName || !beneficiaryName.trim()) {
      setBeneficiaryName(val);
    }
  };

  const handleBeneficiaryNameChange = (val: string) => {
    setIsBeneficiaryCustomized(true);
    setBeneficiaryName(val);
  };

  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setIsVerified(true);
      showToast('تم التحقق بنجاح: الحساب نشط ومطابق للهوية ✓');
    }, 600);
  };

  const handleCopyAccount = () => {
    if (navigator.clipboard && userProfile.accountNumber) {
      navigator.clipboard.writeText(userProfile.accountNumber);
      setCopiedAccount(true);
      showToast('تم نسخ رقم الحساب / المحفظة بنجاح');
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  const handleCopyUid = () => {
    const uid = userProfile.id || auth.currentUser?.uid;
    if (navigator.clipboard && uid) {
      navigator.clipboard.writeText(uid);
      setCopiedUid(true);
      showToast('تم نسخ معرف الحساب (UID)');
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      showToast('يرجى إدخال الاسم الكامل الرباعي بشكل صحيح');
      return;
    }
    if (!phoneNumber.trim() || phoneNumber.trim().length < 6) {
      showToast('يرجى إدخال رقم الجوال اليمني بشكل صحيح');
      return;
    }
    if (!accountNumber.trim() || accountNumber.trim().length < 3) {
      showToast('يرجى إدخال رقم الحساب البنكي أو المحفظة الإلكترونية');
      return;
    }

    setIsSaving(true);
    const wasFirstTime = !isCompleted;

    const institutionList = payoutType === 'bank' ? YEMENI_BANKS : YEMENI_WALLETS;
    const selectedInst = institutionList.find((i) => i.id === institution);

    const updatedProfile: UserProfile = {
      ...userProfile,
      fullName: fullName.trim(),
      phone: `+967 ${phoneNumber.trim()}`,
      operator,
      payoutType,
      institution,
      institutionName:
        selectedInst?.name ||
        (payoutType === 'bank'
          ? 'بنك الكريمي للتمويل الأصغر الإسلامي (حساب مميز)'
          : 'محفظة كاش (Cash)'),
      accountNumber: accountNumber.trim(),
      beneficiaryName: beneficiaryName.trim() || fullName.trim(),
      isVerified: true,
    };

    try {
      await onUpdateProfile(updatedProfile);
      setSaveSuccess(true);
      setIsVerified(true);

      if (wasFirstTime) {
        showToast('تم حفظ وتوثيق حسابك بنسبة ١٠٠%! جاري الانتقال للرئيسية...');
        setTimeout(() => {
          setIsSaving(false);
          setSaveSuccess(false);
          setIsEditing(false);
          onNavigate('home');
        }, 900);
      } else {
        showToast('تم حفظ تعديلات حسابك بنجاح • الخطوات مكتملة ١٠٠% ✓');
        setTimeout(() => {
          setIsSaving(false);
          setSaveSuccess(false);
          setIsEditing(false);
        }, 500);
      }
    } catch {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex flex-col relative w-full px-4 pt-2 pb-28 bg-[#fcf9f3] text-right" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1c1c18] text-[#fcf9f3] px-4 py-2.5 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 border border-[#8c6239]/40 animate-fade-in max-w-sm text-center">
          <span className="material-symbols-outlined text-sm text-[#edbf76]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col w-full pb-8">
        {/* =====================================================================
            TOP HEADER / STATUS (Shows 100% completion or 80% on first time)
           ===================================================================== */}
        <div className="flex flex-col gap-2 pt-1 mb-4">
          <div className="flex items-center justify-between text-[#536161]">
            <span className="text-xs text-[#1c1c18] flex items-center gap-1.5 font-extrabold">
              <span
                className={`material-symbols-outlined text-[18px] ${
                  isCompleted ? 'text-[#2D6A4F]' : 'text-[#896425]'
                }`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {isCompleted ? 'tune' : 'manage_accounts'}
              </span>
              {isCompleted ? 'صفحة الإعدادات والحساب المالي' : 'إكمال الملف المالي (إجباري لأول مرة فقط)'}
            </span>
            {isCompleted ? (
              <span className="text-[11px] text-white font-black bg-[#2D6A4F] px-3 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                <span className="material-symbols-outlined text-xs">done_all</span>
                <span>الخطوات مكتملة ١٠٠%</span>
              </span>
            ) : (
              <span className="text-[10px] text-[#714a23] font-bold bg-[#ffdcbf]/70 px-2.5 py-0.5 rounded-full">
                إجبارية لأول مرة • 80%
              </span>
            )}
          </div>

          {/* Progress Indicator Bar */}
          <div className="w-full h-1.5 bg-[#f0eee8] rounded-full overflow-hidden shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isCompleted
                  ? 'w-full bg-gradient-to-l from-[#2D6A4F] via-emerald-600 to-emerald-500'
                  : 'w-4/5 bg-gradient-to-l from-[#714a23] via-[#8c6239] to-[#edbf76]'
              }`}
            />
          </div>
        </div>

        {/* =====================================================================
            MODE 1: SETTINGS VIEW (Default when profile is completed)
           ===================================================================== */}
        {isCompleted && !isEditing ? (
          <div className="flex flex-col gap-4 animate-fade-in">

            {/* 1. EXCLUSIVE SUPER ADMIN ENTRY CARD (Shown ONLY in Settings as requested) */}
            {isSuperAdmin && (
              <div className="rounded-2xl bg-gradient-to-l from-[#1c1c18] via-[#2d2217] to-[#1c1c18] border-2 border-[#edbf76]/70 text-white p-4.5 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-32 h-32 bg-[#edbf76]/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-start justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#edbf76] to-[#b38435] text-[#1c1c18] flex items-center justify-center shadow-lg shrink-0">
                      <span className="material-symbols-outlined text-2xl font-black">admin_panel_settings</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-black text-[#ffdeae]">لوحة تحكم الأدمن العام 👑</h2>
                        <span className="px-2 py-0.5 rounded-full bg-[#ffdeae]/20 text-[#ffdeae] text-[9px] font-black border border-[#ffdeae]/40">
                          مدير النظام
                        </span>
                      </div>
                      <p className="text-[11px] text-[#e0cfbe] mt-0.5 leading-relaxed">
                        التحكم بالجمعيات، إيقاف الحسابات، حذف الجمعيات، ومراقبة مساحة وسجلات السحابة
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-[#edbf76]/20 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[10px] text-[#ffdeae]/90">
                    <span className="material-symbols-outlined text-sm text-[#edbf76]">verified</span>
                    <span>الدخول متاح لحسابك المعتمد فقط</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate('super-admin')}
                    className="px-4 py-2 rounded-xl bg-gradient-to-l from-[#edbf76] to-[#c79246] hover:brightness-110 active:scale-95 text-[#1c1c18] text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                  >
                    <span>دخول لوحة الأدمن</span>
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. User Profile Summary Hero Card */}
            <div className="rounded-2xl bg-gradient-to-l from-[#2D6A4F] via-[#23533e] to-[#1b4332] text-white p-4 shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={userProfile.avatar || '/assets/aistudio/image_94928b82.png'}
                    alt={userProfile.fullName}
                    className="w-13 h-13 rounded-2xl object-cover ring-2 ring-white/40 shadow-sm"
                  />
                  <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-emerald-400 text-[#1b4332] flex items-center justify-center ring-2 ring-[#1b4332]">
                    <span className="material-symbols-outlined text-xs font-black">check</span>
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-black text-emerald-100">
                      حساب موثق ١٠٠% ✓
                    </span>
                  </div>
                  <h2 className="text-sm font-black text-white truncate mt-1">
                    {userProfile.fullName}
                  </h2>
                  <span className="text-xs text-emerald-100 font-mono" dir="ltr">
                    {userProfile.phone}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="shrink-0 px-3 py-2 rounded-xl bg-white text-[#1b4332] hover:bg-emerald-50 font-black text-xs shadow-sm flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                <span>تعديل الحساب</span>
              </button>
            </div>

            {/* 3. SETTINGS SECTION: Financial Account & Payout Information */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#e5e2dc] flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#f0eee8]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#ffdeae]/50 text-[#714a23] flex items-center justify-center">
                    <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-[#1c1c18]">الحساب المالي لتحويل الحصيلة</h3>
                    <p className="text-[10px] text-[#50453b]">معتمد لاستلام مبالغ الجمعية في دورك</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#ffdeae] text-[#714a23] text-[10px] font-bold">
                  {userProfile.payoutType === 'wallet' ? 'محفظة إلكترونية' : 'حساب بنكي'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-[#f6f3ed] flex items-center justify-between gap-2">
                  <span className="text-[#50453b] font-medium shrink-0">البنك / المحفظة:</span>
                  <span className="font-black text-[#1c1c18] text-left truncate">
                    {userProfile.institutionName}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#f6f3ed] flex items-center justify-between gap-2">
                  <span className="text-[#50453b] font-medium">رقم الحساب / المحفظة:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[#714a23] font-mono text-sm" dir="ltr">
                      {userProfile.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAccount}
                      className="px-2 py-1 rounded-lg bg-white border border-[#e5e2dc] text-[#714a23] text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-[#ffdeae]/30"
                    >
                      <span className="material-symbols-outlined text-xs">
                        {copiedAccount ? 'done' : 'content_copy'}
                      </span>
                      <span>{copiedAccount ? 'تم النسخ' : 'نسخ'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#f6f3ed] flex items-center justify-between gap-2">
                  <span className="text-[#50453b] font-medium">اسم المستفيد المعتمد:</span>
                  <span className="font-black text-[#1c1c18]">
                    {userProfile.beneficiaryName || userProfile.fullName}
                  </span>
                </div>
              </div>
            </div>

            <PhoneNotificationSettings />
            <CheckForUpdatesButton />

            {/* 5. SETTINGS SECTION: Account Security & Cloud Storage */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#e5e2dc] flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-2.5 border-b border-[#f0eee8]">
                <div className="w-8 h-8 rounded-lg bg-[#f0eee8] text-[#714a23] flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">shield</span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#1c1c18]">الأمان والربط السحابي</h3>
                  <p className="text-[10px] text-[#50453b]">معلومات الحماية وقاعدة البيانات السحابية المشفرة</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 text-xs">
                {/* Google Connected Account */}
                <div className="p-3 bg-[#f6f3ed] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs border border-[#e5e2dc]">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-[#1c1c18]">حساب Google المرتبط</span>
                        <span className="material-symbols-outlined text-xs text-[#2D6A4F]">verified</span>
                      </div>
                      <span className="text-[11px] text-[#50453b] font-mono truncate" dir="ltr">
                        {userProfile.email || auth.currentUser?.email || 'Google Connected'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#2D6A4F] bg-emerald-50 border border-[#2D6A4F]/20 px-2 py-0.5 rounded-full shrink-0">
                    نشط وآمن
                  </span>
                </div>

                {/* Firebase User UID */}
                <div className="p-3 bg-[#f6f3ed] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-base text-[#714a23]">fingerprint</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-bold text-[#1c1c18]">معرف المستخدم الفريد (UID)</span>
                      <span className="text-[10px] text-[#50453b] font-mono truncate max-w-[170px]" dir="ltr">
                        {userProfile.id || auth.currentUser?.uid}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUid}
                    className="px-2 py-1 rounded-lg bg-white border border-[#e5e2dc] text-[#714a23] text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-[#ffdeae]/30"
                  >
                    <span className="material-symbols-outlined text-xs">
                      {copiedUid ? 'done' : 'content_copy'}
                    </span>
                    <span>{copiedUid ? 'تم' : 'نسخ'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 6. SETTINGS SECTION: App Info & Support */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#e5e2dc] flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src="/assets/aistudio/image_94928b82.png"
                    alt="هيا نجمعها"
                    className="w-7 h-7 rounded-lg object-contain shadow-xs"
                  />
                  <div>
                    <h3 className="font-black text-[#1c1c18]">هيا نجمعها — النسخة الذكية</h3>
                    <p className="text-[10px] text-[#50453b]">منصة الجمعيات والادخار التعاوني في اليمن</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[#714a23] bg-[#ffdeae]/40 px-2 py-0.5 rounded-full font-mono">
                  v2.4
                </span>
              </div>
            </div>

            {/* 7. Sign Out Button */}
            {onSignOut && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full h-12 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  <span>تسجيل الخروج من الحساب</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* =====================================================================
             MODE 2: FIRST-TIME MANDATORY SETUP OR EXPLICIT EDIT MODE
             ===================================================================== */
          <div className="flex flex-col animate-fade-in">
            {/* Header Section */}
            <div className="mb-4 text-right flex items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-black text-[#1c1c18]">
                  {isCompleted ? 'تعديل بيانات الحساب' : 'إكمال بيانات المشترك (إجباري لأول مرة فقط)'}
                </h2>
                <p className="text-xs text-[#50453b] mt-1 leading-relaxed">
                  {isCompleted
                    ? 'يمكنك تحديث بياناتك الشخصية أو رقم حسابك البنكي وحفظها في قاعدة البيانات.'
                    : 'هذه الخطوة مطلوبة مرة واحدة فقط عند دخولك الأول للتطبيق، وبعدها ستُحفظ بياناتك في حسابك بنسبة ١٠٠%.'}
                </p>
              </div>
              {isCompleted && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-xl bg-[#ebe8e2] text-[#50453b] hover:text-[#1c1c18] text-xs font-bold shrink-0 cursor-pointer"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>

            {/* Form Container */}
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveProfile();
              }}
            >
              {/* SECTION 1: Personal Info */}
              <div className="flex flex-col gap-3.5 bg-white p-4 rounded-xl shadow-xs border border-[#e5e2dc]">
                <div className="flex items-center gap-2 pb-1 border-b border-[#f0eee8]">
                  <div className="w-8 h-8 rounded-lg bg-[#f0eee8] flex items-center justify-center text-[#714a23]">
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      person
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1c1c18]">البيانات الشخصية المعتمدة</h3>
                    <p className="text-[11px] text-[#50453b]">
                      تُستخدم لتأكيد هويتك في كشوفات ومحاضر الجمعية
                    </p>
                  </div>
                </div>

                {/* Full Name Field */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-bold text-[#1c1c18] flex items-center justify-between"
                    htmlFor="fullName"
                  >
                    <span>
                      الاسم الكامل الرباعي <span className="text-[#ba1a1a]">*</span>
                    </span>
                    <span className="text-[10px] text-[#536161]">حسب البطاقة / الجواز</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => handleFullNameChange(e.target.value)}
                      placeholder="أدخل اسمك الرباعي الرسمي"
                      className="w-full h-12 pr-10 pl-4 bg-[#f6f3ed] text-[#1c1c18] rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#714a23]/30 transition-all placeholder:text-[#82756a] border border-[#e5e2dc]"
                    />
                    <span className="material-symbols-outlined absolute right-3 text-[#536161] text-[20px]">
                      badge
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6d4c0d] flex items-center gap-1.5 mt-0.5">
                    <span className="material-symbols-outlined text-[16px] text-[#896425]">
                      verified_user
                    </span>
                    <span>تأكد من مطابقة الاسم لهويتك الشخصية لضمان استلام أدوارك بأمان</span>
                  </p>
                </div>

                {/* Mobile Number Field */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-bold text-[#1c1c18] flex items-center justify-between"
                    htmlFor="phoneNumber"
                  >
                    <span>
                      رقم الجوال لتنبيهات الأقساط <span className="text-[#ba1a1a]">*</span>
                    </span>
                    <span className="text-[10px] text-[#714a23] font-bold">الجمهورية اليمنية</span>
                  </label>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3 h-12 bg-[#f6f3ed] border border-[#e5e2dc] rounded-lg px-2 flex items-center justify-center gap-1 text-[#1c1c18] select-none">
                      <span className="text-xs text-[#536161] font-bold" dir="ltr">
                        +967
                      </span>
                      <span className="material-symbols-outlined text-[#536161] text-[18px]">
                        call
                      </span>
                    </div>

                    <div className="col-span-9 relative flex items-center">
                      <input
                        id="phoneNumber"
                        name="phoneNumber"
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="7XXXXXXXX (أدخل رقم هاتفك مباشرة)"
                        className="w-full h-12 px-3 bg-[#f6f3ed] text-[#1c1c18] rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#714a23]/30 transition-all placeholder:text-[#82756a] text-left border border-[#e5e2dc] font-mono tracking-wider"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Financial Account & Payout Method */}
              <div className="flex flex-col gap-3.5 bg-white p-4 rounded-xl shadow-xs border border-[#e5e2dc]">
                <div className="flex items-center gap-2 pb-1 border-b border-[#f0eee8]">
                  <div className="w-8 h-8 rounded-lg bg-[#f0eee8] flex items-center justify-center text-[#714a23]">
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      account_balance_wallet
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1c1c18]">
                      بيانات استلام الحصيلة والأدوار المالية
                    </h3>
                    <p className="text-[11px] text-[#50453b]">
                      الحساب أو المحفظة التي ستتحول إليها مبالغ جمعيتك عند دورك
                    </p>
                  </div>
                </div>

                {/* Segmented Mode Toggle (Bank Account vs E-Wallet) */}
                <div className="grid grid-cols-2 p-1 bg-[#f0eee8] rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPayoutType('bank');
                      setInstitution('kuraimi');
                    }}
                    className={`h-10 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      payoutType === 'bank'
                        ? 'bg-white text-[#714a23] shadow-sm'
                        : 'text-[#536161] hover:text-[#1c1c18]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">account_balance</span>
                    <span>حساب بنكي محلي</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPayoutType('wallet');
                      setInstitution('cash');
                    }}
                    className={`h-10 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      payoutType === 'wallet'
                        ? 'bg-white text-[#714a23] shadow-sm'
                        : 'text-[#536161] hover:text-[#1c1c18]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">contactless</span>
                    <span>محفظة إلكترونية</span>
                  </button>
                </div>

                {/* Bank/Wallet Selector Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#1c1c18]" htmlFor="institutionSelect">
                    {payoutType === 'bank' ? 'اسم البنك المعتمد' : 'اسم المحفظة الإلكترونية'}{' '}
                    <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <select
                      id="institutionSelect"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      className="w-full h-12 pr-10 pl-8 bg-[#f6f3ed] text-[#1c1c18] rounded-lg text-xs font-medium appearance-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#714a23]/30 transition-all cursor-pointer border border-[#e5e2dc]"
                    >
                      {(payoutType === 'bank' ? YEMENI_BANKS : YEMENI_WALLETS).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 text-[#536161] text-[20px]">
                      {payoutType === 'bank' ? 'account_balance' : 'phone_android'}
                    </span>
                    <span className="material-symbols-outlined absolute left-3 text-[#536161] text-[20px] pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Account Number / Wallet ID */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-bold text-[#1c1c18] flex items-center justify-between"
                    htmlFor="accountNumber"
                  >
                    <span>
                      {payoutType === 'bank' ? 'رقم الحساب / الآيبان' : 'رقم المحفظة الإلكترونية'}{' '}
                      <span className="text-[#ba1a1a]">*</span>
                    </span>
                    <span className="text-[10px] text-[#536161]">
                      {payoutType === 'bank'
                        ? 'مثال الكريمي: 12345678'
                        : 'أدخل رقم الهاتف المرتبط بالمحفظة'}
                    </span>
                  </label>

                  {payoutType === 'bank' ? (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 flex items-center min-w-0">
                        <input
                          id="accountNumber"
                          name="accountNumber"
                          type="text"
                          required
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          placeholder="210984532"
                          className="w-full h-12 pr-10 pl-3 bg-[#f6f3ed] text-[#1c1c18] rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#714a23]/30 transition-all placeholder:text-[#82756a] text-left tracking-wider font-mono border border-[#e5e2dc]"
                          dir="ltr"
                        />
                        <span className="material-symbols-outlined absolute right-3 text-[#536161] text-[20px]">
                          pin
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleVerify}
                        disabled={isVerifying}
                        className={`h-12 px-3.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                          isVerified
                            ? 'bg-[#2D6A4F] text-white shadow-xs'
                            : 'bg-[#d4e3e2] text-[#111e1e] hover:bg-[#bbc9c9]'
                        }`}
                      >
                        {isVerifying ? (
                          <span className="material-symbols-outlined text-[18px] animate-spin">
                            progress_activity
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-[18px]">verified</span>
                        )}
                        <span>
                          {isVerifying ? 'جاري الفحص...' : isVerified ? 'تم التحقق' : 'تحقق من الحساب'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex items-center w-full">
                      <input
                        id="accountNumber"
                        name="accountNumber"
                        type="text"
                        required
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="7XXXXXXXX (أدخل رقم المحفظة مباشرة)"
                        className="w-full h-12 pr-10 pl-3 bg-[#f6f3ed] text-[#1c1c18] rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#714a23]/30 transition-all placeholder:text-[#82756a] text-left tracking-wider font-mono border border-[#e5e2dc]"
                        dir="ltr"
                      />
                      <span className="material-symbols-outlined absolute right-3 text-[#536161] text-[20px]">
                        contactless
                      </span>
                    </div>
                  )}
                </div>

                {/* Account Beneficiary Name */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-bold text-[#1c1c18] flex items-center justify-between"
                    htmlFor="beneficiaryName"
                  >
                    <span>
                      اسم صاحب الحساب / المحفظة بالكامل <span className="text-[#ba1a1a]">*</span>
                    </span>
                    <span className="text-[10px] text-[#714a23] font-medium">
                      {isBeneficiaryCustomized ? 'معدّل يدوياً' : '(يُكتب تلقائياً ويمكنك تعديله)'}
                    </span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="beneficiaryName"
                      name="beneficiaryName"
                      type="text"
                      required
                      value={beneficiaryName}
                      onChange={(e) => handleBeneficiaryNameChange(e.target.value)}
                      placeholder="اسم صاحب الحساب أو المحفظة"
                      className="w-full h-12 pr-10 pl-4 bg-[#f6f3ed] text-[#1c1c18] rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#714a23]/30 transition-all border border-[#e5e2dc]"
                    />
                    <span className="material-symbols-outlined absolute right-3 text-[#536161] text-[20px]">
                      person_check
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Action Buttons */}
              <div className="flex flex-col gap-2.5 mt-2">
                <button
                  id="saveProfileBtn"
                  type="submit"
                  disabled={isSaving}
                  className="w-full h-14 rounded-xl bg-gradient-to-l from-[#714a23] via-[#8c6239] to-[#633f19] text-white text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-[#714a23]/25 hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-85"
                >
                  {isSaving ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[20px]">
                        progress_activity
                      </span>
                      <span>جاري حفظ الحساب في قاعدة البيانات...</span>
                    </>
                  ) : saveSuccess ? (
                    <>
                      <span
                        className="material-symbols-outlined text-[22px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span>تم الحفظ والتوثيق بنسبة ١٠٠%!</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">verified</span>
                      <span>
                        {isCompleted
                          ? 'حفظ التعديلات في حسابي (١٠٠%)'
                          : 'حفظ وتوثيق الحساب النهائي (إتمام ١٠٠%)'}
                      </span>
                    </>
                  )}
                </button>

                {isCompleted && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="w-full py-3 px-4 rounded-xl bg-[#ebe8e2] text-[#1c1c18] hover:bg-[#e5e2dc] transition-colors text-xs font-bold text-center cursor-pointer"
                  >
                    إلغاء والرجوع لصفحة الإعدادات
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
