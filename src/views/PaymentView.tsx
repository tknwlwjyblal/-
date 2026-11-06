import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  SavingsCircle,
  PaymentSubmission,
  ActiveView,
  UserProfile,
  AppNotification,
  getMemberInstallmentProgress,
  sortPaymentsNewestFirst,
  isPaymentForMember,
} from '../types';
import { db, auth } from '../firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { getShortMonthForTurn, getDaysLeftUntil30th } from '../utils/lotteryUtils';

interface Props {
  circle?: SavingsCircle | null;
  payments?: PaymentSubmission[];
  userProfile?: UserProfile;
  onPaymentSubmitted: (submission: PaymentSubmission) => void;
  onNavigate: (view: ActiveView) => void;
}

export const PaymentView: React.FC<Props> = ({
  circle,
  payments = [],
  userProfile,
  onPaymentSubmitted,
  onNavigate,
}) => {
  const currentUid = auth.currentUser?.uid || userProfile?.id;
  const currentEmail = auth.currentUser?.email || userProfile?.email;
  const progress = getMemberInstallmentProgress(circle, currentUid, currentEmail, payments);

  const currentMember = circle?.members.find(
    (m) =>
      (currentUid && m.id === currentUid) ||
      (currentEmail && m.email && m.email.trim().toLowerCase() === currentEmail.trim().toLowerCase()) ||
      m.isCurrentUser
  );
  const myShares = progress.sharesCount || currentMember?.sharesCount || circle?.mySharesCount || 1;
  const singleMonthDue = (circle?.sharePrice || circle?.monthlyShare || 1000) * myShares;
  const maxAllowedAdvance = Math.max(1, progress.remainingInstallmentsCount);

  // Check if member already has a pending receipt under review for this exact circle (sorted newest-first)
  // As requested: "في خانة رفع الايصال المفروض لااستطيع رفع ايصال اخر للجمعيه الابعد تعميد الايصالل الاول اورفضة"
  const mySortedPayments = sortPaymentsNewestFirst(payments || []).filter(
    (p) =>
      p.circleId === circle?.id &&
      isPaymentForMember(p, currentMember, currentUid, currentEmail)
  );

  const pendingReceipt = mySortedPayments.find((p) => p.status === 'under_review');
  const rejectedReceipt = mySortedPayments[0]?.status === 'rejected' ? mySortedPayments[0] : undefined;

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const hasPendingReceipt = Boolean(pendingReceipt) || isSubmitted;

  const [advanceMonths, setAdvanceMonths] = useState<number>(1);
  const [method, setMethod] = useState<'bank' | 'wallet' | 'cash'>('bank');
  const [trxId, setTrxId] = useState<string>(`TRX-${Math.floor(1000000 + Math.random() * 9000000)}`);
  
  // File upload state: Starts empty as requested ("يظهر اختار ملف ويدخله لملفات الجهاز وليس تغيير التغيير يظهر بعد الاختيار")
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [fileType, setFileType] = useState<'image' | 'pdf' | ''>('');
  const [fileData, setFileData] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!circle) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-[#50453b] my-12" dir="rtl">
        <div className="w-16 h-16 rounded-full bg-[#f0eee8] flex items-center justify-center text-[#714a23] mb-4 shadow-inner">
          <span className="material-symbols-outlined text-3xl">payments</span>
        </div>
        <h3 className="text-base font-bold text-[#1c1c18] mb-1">يرجى اختيار جمعية لدفع قسطها</h3>
        <p className="text-xs text-[#50453b] max-w-xs mb-5">
          لم يتم تحديد جمعية بعد، يمكنك اختيار جمعيتك من الصفحة الرئيسية لمتابعة السداد.
        </p>
        <button
          onClick={() => onNavigate('home')}
          className="px-5 py-2.5 bg-[#714a23] hover:bg-[#8c6239] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  const kuraimiAcc = circle.cashierBankAccounts?.kuraimiAccount || '300482910';
  const walletAcc = circle.cashierBankAccounts?.jeebWallet || '771234567';
  const cleanOrganizerName = circle.organizer.name.replace(/\(أنت\)|\(المنظم\)/g, '').trim();

  // Gregorian month calculation numerically: "شهر 11", "شهر 12", "شهر 1"
  const currentTurnIndex = (circle.completedMonths || 0) + 1;
  const currentMonthName = getShortMonthForTurn(currentTurnIndex);
  const daysLeft = getDaysLeftUntil30th();

  // Dynamic calculation for advance payments & list of covered months
  const totalAmountDue = singleMonthDue * advanceMonths;
  const coveredMonthsList: string[] = [];
  for (let i = 0; i < advanceMonths; i++) {
    coveredMonthsList.push(getShortMonthForTurn(currentTurnIndex + i));
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string, key: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    showToast(`تم نسخ الرقم: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Compress image to ensure it stays well under Firestore's 1MB limit (< 150KB)
  const compressImage = (file: File): Promise<{ dataUrl: string; sizeStr: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
            const approxBytes = Math.round((dataUrl.length * 3) / 4);
            const sizeStr = `${Math.round(approxBytes / 1024)} كيلوبايت (محسّن)`;
            resolve({ dataUrl, sizeStr });
          } else {
            const raw = e.target?.result as string;
            resolve({ dataUrl: raw, sizeStr: `${Math.round(file.size / 1024)} كيلوبايت` });
          }
        };
        img.onerror = () => {
          const raw = e.target?.result as string;
          resolve({ dataUrl: raw, sizeStr: `${Math.round(file.size / 1024)} كيلوبايت` });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setFileType(isPdf ? 'pdf' : 'image');

    if (isPdf) {
      if (file.size > 750 * 1024) {
        showToast('ملف الـ PDF كبير (يتجاوز 750 ك.ب)، يفضل رفع صورة الإيصال أو تصوير الشاشة');
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setFileData(result);
        setImagePreview(null);
        setFileSize(`${Math.round(file.size / 1024)} كيلوبايت • تم التحميل بنجاح`);
      };
      reader.readAsDataURL(file);
    } else {
      // Compress phone camera/screenshot image down to 80-150KB
      try {
        const compressed = await compressImage(file);
        setFileData(compressed.dataUrl);
        setImagePreview(compressed.dataUrl);
        setFileSize(compressed.sizeStr + ' • تم التحميل بنجاح');
      } catch {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          setFileData(result);
          setImagePreview(result);
          setFileSize(`${Math.round(file.size / 1024)} كيلوبايت`);
        };
        reader.readAsDataURL(file);
      }
    }
    showToast(`تم اختيار الملف: ${file.name}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // STRICT RULE AS REQUESTED:
    // "في خانة رفع الايصال المفروض لااستطيع رفع ايصال اخر للجمعيه الابعد تعميد الايصالل الاول اورفضة"
    if (pendingReceipt || isSubmitted) {
      showToast('عذراً، لديك إيصال سابق قيد المراجعة والاعتماد حالياً. لا يمكنك رفع إيصال جديد حتى يتم تعميده أو رفضه من منظم الجمعية.');
      return;
    }

    // STRICT REFUSAL AS REQUESTED:
    // "واذا رفعت ايصال جديد اوقسط وقد اكملت اقساطي المحددة يرفض"
    if (progress.isCompleted) {
      showToast('تم رفض رفع الإيصال: لقد أتممت سداد كامل الأقساط المقررة في هذه الجمعية (مكتمل ١٠٠%) 🎉');
      return;
    }

    if (advanceMonths > progress.remainingInstallmentsCount) {
      showToast(`تم رفض الطلب: الأقساط المتبقية عليك هي (${progress.remainingInstallmentsCount}) قسط فقط.`);
      return;
    }

    if (!fileName || !fileData) {
      showToast('يرجى اختيار صورة الإيصال أو ملف PDF من جهازك للمتابعة');
      return;
    }

    setIsSubmitting(true);

    const payerUid = auth.currentUser?.uid || userProfile?.id || 'member';
    const payerName = userProfile?.fullName || auth.currentUser?.displayName || 'مشترك الجمعية';
    const payerEmailClean = (auth.currentUser?.email || userProfile?.email || '').trim().toLowerCase();

    const submission: PaymentSubmission = {
      id: `trx-${Date.now()}`,
      circleId: circle.id,
      circleTitle: circle.title,
      amount: totalAmountDue,
      currencySymbol: circle.currencySymbol,
      trxId,
      method,
      receiptFileName: fileName,
      receiptFileSize: fileSize,
      receiptImageData: fileData || '',
      receiptFileType: fileType || 'image',
      submittedAt: 'اليوم، ' + new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
      status: 'under_review',
      recipientName: circle.currentRecipientName,
      advanceMonths: Math.max(1, Number(advanceMonths) || 1),
      coveredMonths: coveredMonthsList,
      payerId: payerUid,
      payerName,
      payerEmail: payerEmailClean,
    };

    // 1. Save payment submission to Firestore (guaranteed independent)
    try {
      const cleanSubmission = Object.fromEntries(
        Object.entries(submission).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'payments', submission.id), cleanSubmission);
    } catch (err: any) {
      console.warn('Payment save error, retrying without image data:', err);
      try {
        const lightweightSubmission: PaymentSubmission = {
          ...submission,
          receiptImageData: '',
          receiptFileSize: submission.receiptFileSize + ' (حجم خفيف)',
        };
        const cleanLightweight = Object.fromEntries(
          Object.entries(lightweightSubmission).filter(([_, v]) => v !== undefined)
        );
        await setDoc(doc(db, 'payments', submission.id), cleanLightweight);
      } catch (err2) {
        console.error('Critical payment persistence error:', err2);
      }
    }

    // 2. Update circle status if possible
    try {
      if (circle && circle.id) {
        await updateDoc(doc(db, 'circles', circle.id), {
          myPaymentStatus: 'under_review',
        });
      }
    } catch (circleErr) {
      console.warn('Circle status update non-fatal warning:', circleErr);
    }

    // 2. SEND NOTIFICATION TO THE ORGANIZER (المنظم) TO APPROVE PAYMENT!
    // As requested: "بعد دفع القسط يروح اشعار للمنضم باعتماد القسط"
    const organizerId = circle.creatorId || circle.organizer?.creatorId;
    const organizerEmail = circle.creatorEmail;
    const payerEmail = auth.currentUser?.email || userProfile?.email || '';

    const advanceLabel = advanceMonths > 1
      ? ` (${advanceMonths} أقساط مقدّمة تغطي: ${coveredMonthsList.join('، ')})`
      : ` (قسط ${currentMonthName})`;

    // Notification for Organizer (Only organizer sees this in their approval inbox)
    if (organizerId || organizerEmail) {
      const notifForOrganizer: AppNotification = {
        id: `notif-payment-${Date.now()}`,
        userId: organizerId,
        userEmail: organizerEmail,
        senderId: payerUid,
        targetRole: 'organizer',
        title: 'إشعار سداد قسط جديد بانتظار اعتمادك 💳',
        message: `قام المشترك "${payerName}" برفع إيصال سداد بقيمة ${totalAmountDue.toLocaleString('ar-YE')} ${circle.currencySymbol}${advanceLabel} لجمعية "${circle.title}". رقم السند: (${trxId}). يرجى فتح لوحة التعميد ومراجعة الإيصال كصورة أو PDF واعتماده.`,
        time: 'الآن',
        type: 'due_reminder',
        isRead: false,
        circleId: circle.id,
        createdAt: Date.now(),
      };

      try {
        const cleanNotif = Object.fromEntries(
          Object.entries(notifForOrganizer).filter(([_, v]) => v !== undefined)
        );
        await setDoc(doc(db, 'notifications', notifForOrganizer.id), cleanNotif);
      } catch (notifErr) {
        console.warn('Failed to notify organizer of payment:', notifErr);
      }
    }

    // Confirmation Notification for the Member (Only the member sees their submission receipt)
    const notifForPayer: AppNotification = {
      id: `notif-payer-submit-${Date.now()}`,
      userId: payerUid,
      userEmail: payerEmail,
      senderId: payerUid,
      targetRole: 'member',
      title: 'تم رفع إيصال القسط بنجاح ⏳',
      message: `تم إرسال إيصال سدادك لجمعية "${circle.title}" برقم سند (${trxId}) إلى منظم الجمعية، وسيتم إشعارك فور قيام المنظم بتعميد القسط.`,
      time: 'الآن',
      type: 'system',
      isRead: false,
      circleId: circle.id,
      createdAt: Date.now(),
    };

    try {
      const cleanPayerNotif = Object.fromEntries(
        Object.entries(notifForPayer).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'notifications', notifForPayer.id), cleanPayerNotif);
    } catch (payerNotifErr) {
      console.warn('Failed to save payer receipt notification:', payerNotifErr);
    }

    // 3. Callback & Confetti
    onPaymentSubmitted(submission);
    setIsSubmitting(false);
    setIsSubmitted(true);

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#714a23', '#8c6239', '#2D6A4F', '#ffffff'],
      });
    } catch {}

    setTimeout(() => {
      const successEl = document.getElementById('success-card');
      successEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `السلام عليكم يا أمين الصندوق (${cleanOrganizerName})، تم سداد قسط ${currentMonthName} بقيمة ${totalAmountDue.toLocaleString('ar-YE')} ${circle.currencySymbol} لجمعية "${circle.title}". رقم العملية: ${trxId}${advanceMonths > 1 ? ` (سداد مقدّم لـ ${advanceMonths} أشهر: ${coveredMonthsList.join('، ')})` : ''}. يرجى مراجعة الإيصال واعتماده.`
    );
    window.open(`https://wa.me/967${walletAcc.replace('+967', '').trim()}?text=${text}`, '_blank');
  };

  return (
    <div className="flex flex-col w-full pb-28 pt-2 px-4 selection:bg-[#ffdcbf] text-right" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#31312d] text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-fade-in border border-[#8c6239]/40 max-w-sm text-center">
          <span className="material-symbols-outlined text-sm text-[#ffdeae]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Brand Mottos & Cultural Touchstone */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-1.5 text-[#714a23]">
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            handshake
          </span>
          <span className="text-xs font-black">هيا نجمعها</span>
          <span className="text-[#82756a] text-xs">•</span>
          <span className="text-xs text-[#50453b]">معًا .. نكمل الخير</span>
        </div>
        <div className="inline-flex items-center gap-1 bg-[#d4e3e2] px-2.5 py-0.5 rounded-full text-[#3c4949]">
          <span className="material-symbols-outlined text-xs">verified_user</span>
          <span className="text-[10px] font-bold">موثوق وآمن</span>
        </div>
      </div>

      {/* If all installments are completed: Show celebration card and lock uploads */}
      {progress.isCompleted ? (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-emerald-100/50 p-6 shadow-sm border-2 border-emerald-500/40 flex flex-col items-center text-center gap-3 mb-5 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-400 text-emerald-700 flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified
            </span>
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-emerald-200/70 text-emerald-900 text-xs font-black inline-block mb-1">
              أقساط الجمعية مكتملة ١٠٠% 🏆
            </span>
            <h3 className="text-base font-black text-[#1c1c18]">
              تهانينا! لقد أتممت سداد كامل الأقساط المقررة في جمعية "{circle.title}"
            </h3>
          </div>
          <p className="text-xs text-[#50453b] leading-relaxed max-w-md">
            لقد سددت جميع الأقساط المطلوبة منك بالكامل ({progress.paidInstallmentsCount} من أصل {progress.totalRequiredInstallments} أقساط معمدة وموثقة).
            <br />
            <strong className="text-emerald-800">تم قفل رفع الإيصالات ورفض أي دفعات إضافية لاكتمال أقساطك المحددة ١٠٠%.</strong>
          </p>

          <div className="w-full max-w-sm bg-white p-3.5 rounded-xl border border-emerald-200 flex items-center justify-around text-xs shadow-xs">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-[#50453b]">إجمالي الأقساط</span>
              <span className="font-black text-emerald-800 text-sm font-sans">{progress.paidInstallmentsCount} / {progress.totalRequiredInstallments}</span>
            </div>
            <div className="w-[1px] h-8 bg-emerald-100" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-[#50453b]">إجمالي المدفوع</span>
              <span className="font-black text-emerald-800 text-sm font-sans">{progress.totalPaidAmount.toLocaleString('ar-YE')} {circle.currencySymbol}</span>
            </div>
            <div className="w-[1px] h-8 bg-emerald-100" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-[#50453b]">المتبقي</span>
              <span className="font-black text-emerald-800 text-sm font-sans">0 قسط</span>
            </div>
          </div>

          <div className="flex gap-2 w-full max-w-sm pt-2">
            <button
              type="button"
              onClick={() => onNavigate('circle-detail')}
              className="flex-1 h-11 rounded-xl bg-[#714a23] hover:bg-[#8c6239] text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">savings</span>
              <span>سجل الجمعية والإيصالات</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="h-11 px-4 rounded-xl bg-[#ebe8e2] hover:bg-[#ded9d0] text-[#1c1c18] text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              الرئيسية
            </button>
          </div>
        </div>
      ) : null}

      {/* 1. Header Card: ملخص القسط المستحق */}
      <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm border border-[#e5e2dc] flex flex-col gap-3 mb-4">
        {/* Glow ambient background accents */}
        <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-[#f1bc8c]/20 pointer-events-none blur-2xl" />
        <div className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full bg-[#ffdeae]/30 pointer-events-none blur-xl" />

        <div className="flex items-start justify-between relative z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#ffdeae] text-[#281900] font-bold">
                قسط {currentMonthName}
              </span>
              <span className="text-[10px] text-[#50453b] font-medium">
                الدفعة {currentTurnIndex} من {circle.totalMonths || circle.sharesCount || 30}
              </span>
            </div>
            <h2 className="text-base font-black text-[#1c1c18]">{circle.title}</h2>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#ebe8e2] flex items-center justify-center text-[#714a23] shadow-xs shrink-0">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              account_balance
            </span>
          </div>
        </div>

        {/* Member Installment Progress Status Bar */}
        <div className="bg-[#fcf9f3] p-3 rounded-xl border border-[#edbf76]/70 flex flex-col gap-1.5 relative z-10">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#1c1c18] flex items-center gap-1">
              <span className="material-symbols-outlined text-base text-[#714a23]">payments</span>
              <span>موقفك في سداد أقساط هذه الجمعية:</span>
            </span>
            <span className="font-black text-[#714a23]">
              {progress.paidInstallmentsCount} من أصل {progress.totalRequiredInstallments} أقساط ({progress.percent}%)
            </span>
          </div>
          <div className="w-full bg-[#e5e2dc] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#2D6A4F] h-full rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#50453b]">
            <span>المبلغ المعمد: <strong>{progress.totalPaidAmount.toLocaleString('ar-YE')} {circle.currencySymbol}</strong></span>
            <span>المتبقي: <strong className="text-[#714a23]">{progress.remainingInstallmentsCount} أقساط</strong></span>
          </div>
        </div>

        {/* Advance Payment Selector (اختيار عدد الأقساط التي سيتم دفعها) */}
        {!progress.isCompleted && !hasPendingReceipt && (
          <div className="bg-[#fcf9f3] p-3.5 rounded-xl border border-[#edbf76]/70 flex flex-col gap-2.5 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1c1c18] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-[#714a23]">calendar_month</span>
                <span>تحديد عدد الأقساط المراد سدادها:</span>
              </span>
              <span className="text-xs font-black text-[#714a23]">
                {advanceMonths === 1 ? 'قسط شهر واحد' : `${advanceMonths} أقساط مقدّمة`}
              </span>
            </div>

            {/* Stepper + Quick Buttons */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white border border-[#e5e2dc] rounded-xl p-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => setAdvanceMonths((prev) => Math.min(progress.remainingInstallmentsCount, prev + 1))}
                  disabled={advanceMonths >= progress.remainingInstallmentsCount}
                  className="w-8 h-8 rounded-lg bg-[#f0eee8] hover:bg-[#ffdeae]/40 text-[#714a23] font-bold text-base flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40"
                  title="زيادة قسط"
                >
                  +
                </button>
                <span className="w-10 text-center font-black text-sm text-[#1c1c18] font-sans">
                  {advanceMonths}
                </span>
                <button
                  type="button"
                  onClick={() => setAdvanceMonths((prev) => Math.max(1, prev - 1))}
                  disabled={advanceMonths <= 1}
                  className="w-8 h-8 rounded-lg bg-[#f0eee8] hover:bg-[#ffdeae]/40 text-[#714a23] font-bold text-base flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40"
                  title="إنقاص قسط"
                >
                  -
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5 flex-1">
                {[1, 2, 3, 6]
                  .filter((count) => count <= progress.remainingInstallmentsCount || count === 1)
                  .map((count) => (
                    <button
                      key={count}
                      type="button"
                      disabled={count > progress.remainingInstallmentsCount}
                      onClick={() => setAdvanceMonths(Math.min(progress.remainingInstallmentsCount, count))}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 ${
                        advanceMonths === count
                          ? 'bg-[#714a23] text-white shadow-xs'
                          : 'bg-white text-[#50453b] hover:bg-[#ebe8e2] border border-[#e5e2dc]'
                      }`}
                    >
                      {count === 1 ? 'شهر' : `${count} أشهر`}
                    </button>
                  ))}
              </div>
            </div>

            {/* Dynamic Covered Months Display */}
            <div className="p-2 rounded-lg bg-[#ffdeae]/25 border border-[#ffdeae]/60 text-[11px] text-[#604101] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm shrink-0 text-[#714a23]">check_circle</span>
              <span>
                <strong>الأشهر التي سيتم سدادها:</strong>{' '}
                {coveredMonthsList.join(' ، ')}
              </span>
            </div>
          </div>
        )}

        {/* Amount Box */}
        <div className="bg-[#f6f3ed] rounded-xl p-3.5 flex items-center justify-between relative z-10 border border-[#e5e2dc]/60">
          <div>
            <span className="block text-[10px] text-[#50453b] mb-0.5">
              {advanceMonths > 1 ? `المبلغ الإجمالي (${advanceMonths} أقساط)` : 'المبلغ المطلوب سداده'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-[#714a23] font-sans">
                {totalAmountDue.toLocaleString('ar-YE')}
              </span>
              <span className="text-xs font-bold text-[#6d4c0d]">{circle.currencySymbol}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="inline-flex items-center gap-1 bg-[#ffdeae]/40 text-[#604101] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
              <span className="material-symbols-outlined text-xs">hourglass_top</span>
              <span>متبقي {daysLeft} أيام</span>
            </div>
            <span className="text-[10px] text-[#50453b]">
              تاريخ السداد: <strong>يوم 30 من كل شهر</strong>
            </span>
          </div>
        </div>

        {/* Member Turn Mini-Bar */}
        <div className="flex items-center justify-between pt-1 relative z-10 text-xs border-t border-[#f0eee8]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#714a23] text-white text-[10px] flex items-center justify-center font-bold">
              {circle.currentRecipientName.charAt(0) || 'أ'}
            </div>
            <span className="text-[#1c1c18]">
              المستلم هذا الشهر: <strong className="font-bold text-[#714a23]">{circle.currentRecipientName}</strong>
            </span>
          </div>
          <span className="text-[11px] text-[#6d4c0d] font-bold">
            دورك: {circle.isConfirmedByAdmin ? circle.myTurnMonth : 'بعد التعميد'}
          </span>
        </div>
      </div>

      {/* 2. Cashier Accounts Details: Beneficiary Account Details */}
      {!progress.isCompleted && !hasPendingReceipt && (
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-[#e5e2dc] flex flex-col gap-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#ebe8e2] flex items-center justify-center text-[#714a23]">
                <span className="material-symbols-outlined text-lg">credit_card</span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#1c1c18]">بيانات تحويل القسط</h3>
                <span className="text-[10px] text-[#50453b]">المنظم المعتمد للمجموعة</span>
              </div>
            </div>
            <span className="inline-block text-[10px] px-2.5 py-0.5 rounded-full bg-[#f0eee8] text-[#1c1c18] font-bold">
              {cleanOrganizerName}
            </span>
          </div>

          {/* Account 1: Kuraimi Bank */}
          <div className="p-3 rounded-xl bg-[#f0eee8] flex items-center justify-between border border-[#e5e2dc]/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#714a23] shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#1c1c18]">بنك الكريمي للتمويل</span>
                <div className="flex items-center gap-1.5" dir="ltr">
                  <span className="text-sm font-black tracking-wider text-[#714a23] font-mono select-all">
                    {kuraimiAcc}
                  </span>
                  <span className="text-[10px] text-[#50453b]">(حساب جاري)</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(kuraimiAcc, 'kuraimi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1 active:scale-95 border cursor-pointer ${
                copiedKey === 'kuraimi'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-white text-[#714a23] border-[#714a23]/30 hover:bg-[#ffdeae]/20'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {copiedKey === 'kuraimi' ? 'check' : 'content_copy'}
              </span>
              <span>{copiedKey === 'kuraimi' ? 'تم النسخ' : 'نسخ'}</span>
            </button>
          </div>

          {/* Account 2: Mobile Wallet */}
          <div className="p-3 rounded-xl bg-[#f0eee8] flex items-center justify-between border border-[#e5e2dc]/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#6d4c0d] shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-lg">phone_android</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#1c1c18]">محفظة جيب / كاش</span>
                <div className="flex items-center gap-1.5" dir="ltr">
                  <span className="text-sm font-black tracking-wider text-[#714a23] font-mono select-all">
                    {walletAcc}
                  </span>
                  <span className="text-[10px] text-[#50453b]">(رقم المحفظة)</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(walletAcc, 'wallet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1 active:scale-95 border cursor-pointer ${
                copiedKey === 'wallet'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-white text-[#714a23] border-[#714a23]/30 hover:bg-[#ffdeae]/20'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {copiedKey === 'wallet' ? 'check' : 'content_copy'}
              </span>
              <span>{copiedKey === 'wallet' ? 'تم النسخ' : 'نسخ'}</span>
            </button>
          </div>

          {/* Notice Advice */}
          <div className="flex items-center gap-2 bg-[#ffdeae]/30 p-2.5 rounded-xl text-[#604101] border border-[#ffdeae]">
            <span className="material-symbols-outlined text-base shrink-0">info</span>
            <p className="text-[11px] font-medium leading-relaxed">
              يرجى كتابة اسمك الثلاثي في وصف الحوالة لتسريع اعتماد القسط من قِبل المنظم وتوثيقه تلقائياً.
            </p>
          </div>
        </div>
      )}

      {/* 3. Payment Submission Form: إثبات سداد القسط OR Completed Locked Card OR Pending Review Locked Card */}
      {progress.isCompleted ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-emerald-200 text-center flex flex-col items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified
            </span>
          </div>
          <div>
            <h4 className="text-sm font-black text-[#1c1c18]">
              تم سداد كامل أقساطك المقررة بنجاح (مكتمل ١٠٠%)
            </h4>
            <p className="text-xs text-[#50453b] mt-1 max-w-xs mx-auto">
              لقد قمت بسداد جميع الأقساط ({progress.paidInstallmentsCount} من {progress.totalRequiredInstallments} قسط). تم إيقاف وقفل رفع أي إيصالات إضافية.
            </p>
          </div>
          <button
            type="button"
            disabled
            className="w-full h-12 rounded-xl bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 opacity-80 cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-base">lock</span>
            <span>مكتمل بالكامل - يمنع رفع إيصالات جديدة</span>
          </button>
        </div>
      ) : hasPendingReceipt ? (
        /* PENDING REVIEW CARD:
           As requested: "في خانة رفع الايصال المفروض لااستطيع رفع ايصال اخر للجمعيه الابعد تعميد الايصالل الاول اورفضة"
        */
        <div
          id="pending-receipt-card"
          className="p-5 rounded-2xl bg-[#f6f3ed] shadow-lg border-2 border-[#8c6239]/40 relative overflow-hidden flex flex-col gap-3.5 mb-4 animate-scale-up"
        >
          <div className="flex flex-col items-center text-center gap-1.5 relative z-10">
            <div className="w-14 h-14 rounded-full bg-[#ffdeae] text-[#714a23] flex items-center justify-center shadow-md mb-1">
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                hourglass_top
              </span>
            </div>
            <h4 className="text-sm font-black text-[#1c1c18]">تم رفع إيصال القسط وهو قيد التدقيق 🌟</h4>
            <p className="text-xs text-[#50453b] leading-relaxed px-1">
              إيصال السداد قيد المراجعة والتدقيق حالياً لدى منظم الجمعية.
              <br />
              <strong className="text-[#714a23]">
                لا يمكن رفع إيصال آخر لهذه الجمعية إلا بعد تعميد هذا الإيصال أو رفضه من قِبل المنظم.
              </strong>
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl flex flex-col gap-2 relative z-10 shadow-xs border border-[#e5e2dc]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6d4c0d] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#6d4c0d] animate-ping" />
                الحالة: قيد المراجعة والاعتماد ⏳
              </span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#ffdeae] text-[#604101] font-bold">
                بانتظار تعميد المنظم
              </span>
            </div>

            <div className="text-[11px] text-[#50453b] pt-2 border-t border-[#f0eee8] flex items-center justify-between">
              <span>
                المبلغ: <strong className="text-[#714a23] font-bold font-sans">{(pendingReceipt?.amount || totalAmountDue).toLocaleString('ar-YE')} {circle.currencySymbol}</strong>
              </span>
              <span>•</span>
              <span>
                رقم السند: <strong className="text-[#1c1c18] font-mono">{pendingReceipt?.trxId || trxId}</strong>
              </span>
            </div>

            <div className="text-[10px] text-[#50453b] pt-1 border-t border-[#f0eee8] flex items-center justify-between">
              <span>
                عدد الأقساط: <strong>{pendingReceipt?.advanceMonths || advanceMonths} شهر</strong>
              </span>
              <span>
                تاريخ الرفع: <strong>{pendingReceipt?.submittedAt || 'اليوم'}</strong>
              </span>
            </div>

            {(pendingReceipt?.receiptFileName || fileName) && (
              <div className="p-2 rounded-lg bg-[#f0eee8] text-[11px] text-[#1c1c18] font-medium flex items-center gap-1.5 mt-1 truncate">
                <span className="material-symbols-outlined text-sm text-[#714a23]">attach_file</span>
                <span className="truncate">{pendingReceipt?.receiptFileName || fileName}</span>
              </div>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-amber-700 shrink-0">lock</span>
            <span className="text-[11px] font-medium leading-relaxed">
              تم قفل رفع إيصال جديد منعاً للازدواجية. فور قيام المنظم بتعميد هذا القسط أو رفضه، ستتمكن من متابعة السداد تلقائياً.
            </span>
          </div>

          <div className="flex flex-col gap-2 relative z-10 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="w-full h-11 rounded-xl bg-[#714a23] hover:bg-[#8c6239] text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              العودة للرئيسية
            </button>

            <button
              type="button"
              onClick={shareWhatsApp}
              className="w-full h-11 rounded-xl bg-white hover:bg-[#f0eee8] text-[#1c1c18] font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 border border-[#e5e2dc] cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-[#6d4c0d]">share</span>
              <span>مشاركة الإشعار مع المنظم عبر واتساب للاستعجال</span>
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-4 shadow-sm border border-[#e5e2dc] flex flex-col gap-3.5 mb-4"
        >
          {/* Previous rejection alert if applicable */}
          {rejectedReceipt && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2 mb-1">
              <span className="material-symbols-outlined text-base text-red-600 shrink-0 mt-0.5">error</span>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold">تنبيه: تم رفض إيصالك السابق برقم ({rejectedReceipt.trxId}):</span>
                <span className="text-[11px] text-red-800">
                  السبب: {rejectedReceipt.reviewNote || 'المبلغ غير مطابق أو صورة الإيصال غير واضحة'}. يمكنك الآن إعادة رفع الإيصال الصحيح أدناه.
                </span>
              </div>
            </div>
          )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#ebe8e2] flex items-center justify-center text-[#714a23]">
            <span className="material-symbols-outlined text-lg">receipt_long</span>
          </div>
          <h3 className="text-xs font-bold text-[#1c1c18]">إثبات سداد القسط</h3>
        </div>

        {/* Payment Method Toggle */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[#1c1c18]">طريقة التحويل المستخدمة</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMethod('bank')}
              className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                method === 'bank'
                  ? 'bg-[#714a23] text-white shadow-xs'
                  : 'bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#50453b]'
              }`}
            >
              <span className="material-symbols-outlined text-lg">account_balance</span>
              <span className="truncate">تحويل بنكي</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('wallet')}
              className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                method === 'wallet'
                  ? 'bg-[#714a23] text-white shadow-xs'
                  : 'bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#50453b]'
              }`}
            >
              <span className="material-symbols-outlined text-lg">payments</span>
              <span className="truncate">محفظة رقمية</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('cash')}
              className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                method === 'cash'
                  ? 'bg-[#714a23] text-white shadow-xs'
                  : 'bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#50453b]'
              }`}
            >
              <span className="material-symbols-outlined text-lg">handshake</span>
              <span className="truncate">تسليم يدوي</span>
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[#1c1c18]">المبلغ المحوّل الفعلي</label>
          <div className="relative flex items-center">
            <input
              type="text"
              readOnly
              value={`${totalAmountDue.toLocaleString('ar-YE')} ${circle.currencySymbol}`}
              className="w-full bg-[#f6f3ed] rounded-xl p-3 text-[#714a23] font-bold text-lg font-sans border border-[#e5e2dc]"
            />
          </div>
        </div>

        {/* Transaction Number Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[#1c1c18]">رقم الحوالة أو السند (TRX)</label>
          <div className="relative flex items-center">
            <input
              type="text"
              required
              value={trxId}
              onChange={(e) => setTrxId(e.target.value)}
              placeholder="مثال: TRX-84920182"
              className="w-full bg-[#f6f3ed] rounded-xl p-3 pr-10 text-xs font-bold text-[#1c1c18] border border-[#e5e2dc] focus:outline-none focus:border-[#714a23]"
            />
            <span className="material-symbols-outlined absolute right-3 text-base text-[#50453b]">tag</span>
          </div>
        </div>

        {/* Upload Receipt Section (Strictly as requested: starts empty with "اختيار ملف", "تغيير" only after selection) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#1c1c18]">صورة الإيصال أو كشف الحساب</label>
            <span className="text-[10px] text-[#714a23] font-bold">مطلوب للاعتماد</span>
          </div>

          {!fileName ? (
            /* Initial Empty State: Clean file picker that opens device storage */
            <label className="border-2 border-dashed border-[#d4c3b7] hover:border-[#714a23] bg-[#fcf9f3] hover:bg-[#f6f3ed] p-5 rounded-2xl flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all text-center group">
              <div className="w-12 h-12 rounded-full bg-[#f0eee8] group-hover:bg-[#ffdeae]/40 flex items-center justify-center text-[#714a23] transition-colors shadow-inner">
                <span className="material-symbols-outlined text-2xl">upload_file</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#1c1c18]">
                  اضغط لاختيار صورة الإيصال أو كشف الحساب من جهازك
                </span>
                <span className="text-[10px] text-[#50453b] mt-0.5">
                  يدعم صور المستندات (PNG, JPG) وملفات كشف الحساب (PDF)
                </span>
              </div>
              <span className="mt-1 px-4 py-2 rounded-xl bg-[#714a23] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 group-hover:bg-[#8c6239] transition-colors">
                <span className="material-symbols-outlined text-sm">folder_open</span>
                <span>اختيار ملف</span>
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            /* File has been selected: Display file name, size, type badge, and ONLY NOW show "تغيير" button */
            <div className="p-3.5 rounded-2xl bg-[#f0eee8] flex items-center justify-between border border-[#e5e2dc] shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                {fileType === 'pdf' ? (
                  <div className="w-11 h-11 rounded-xl bg-red-100 text-red-700 flex flex-col items-center justify-center shrink-0 font-bold shadow-xs">
                    <span className="material-symbols-outlined text-xl">picture_as_pdf</span>
                    <span className="text-[8px] font-sans">PDF</span>
                  </div>
                ) : imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="معاينة الإيصال"
                    className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white shadow-xs"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center text-[#714a23] shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-xl">image</span>
                  </div>
                )}

                <div className="flex flex-col min-w-0 text-right">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#1c1c18] truncate max-w-[150px] sm:max-w-[190px]">
                      {fileName}
                    </span>
                    <span className="material-symbols-outlined text-emerald-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                  </div>
                  <span className="text-[10px] text-[#50453b]">{fileSize}</span>
                </div>
              </div>

              {/* Button "تغيير" appears ONLY after the file is chosen from the device! */}
              <label className="px-3.5 py-2 rounded-xl bg-white text-[#714a23] hover:bg-[#ffdeae]/30 text-xs font-bold border border-[#714a23]/30 shadow-xs transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95">
                <span className="material-symbols-outlined text-sm">cached</span>
                <span>تغيير</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !fileName}
            className="w-full h-12 rounded-xl bg-[#714a23] hover:bg-[#8c6239] text-white font-bold text-xs shadow-md shadow-[#714a23]/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified
              </span>
            )}
            <span>دفع وتأكيد سداد القسط ({advanceMonths > 1 ? `${advanceMonths} أقساط` : 'شهر واحد'})</span>
          </button>

          <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[#50453b]">
            <span className="material-symbols-outlined text-xs">lock</span>
            <span className="text-[10px]">عملية مشفرة ومحفوظة في سجل صندوق الجمعية</span>
          </div>
        </div>
      </form>
      )}
    </div>
  );
};
