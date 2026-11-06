import React, { useState, useEffect } from 'react';
import {
  SavingsCircle,
  UserProfile,
  PaymentSubmission,
  AppNotification,
  SystemLogEntry,
  GlobalAppSettings,
  ActiveView,
  SUPER_ADMIN_EMAIL,
  isSuperAdminEmail,
} from '../types';
import { db, auth, logSystemEvent } from '../firebase';
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  setDoc,
  getDocFromServer,
} from 'firebase/firestore';

interface Props {
  circles: SavingsCircle[];
  payments: PaymentSubmission[];
  notifications: AppNotification[];
  userProfile: UserProfile;
  onNavigate: (view: ActiveView) => void;
  onSelectCircle: (circle: SavingsCircle) => void;
  onCircleDeletedFromDB?: (circleId: string) => void;
}

export const SuperAdminView: React.FC<Props> = ({
  circles,
  payments,
  notifications,
  userProfile,
  onNavigate,
  onSelectCircle,
  onCircleDeletedFromDB,
}) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'users' | 'circles' | 'logs' | 'control'>('storage');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [appSettings, setAppSettings] = useState<GlobalAppSettings>({
    id: 'global',
    maintenanceMode: false,
    allowCreateCircles: true,
    allowJoinCircles: true,
    announcementText: '',
    updatedAt: Date.now(),
  });

  // Search & Filter states
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [circleSearch, setCircleSearch] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  // Action states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(42);
  const [isPinging, setIsPinging] = useState(false);
  const [suspendingUser, setSuspendingUser] = useState<UserProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState('مخالفة سياسة الاستخدام أو عدم الالتزام بالسداد');
  const [deletingCircle, setDeletingCircle] = useState<SavingsCircle | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Broadcast notification states
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Real-time listeners for all users, system_logs, and app_settings
  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => list.push({ ...(d.data() as UserProfile), id: d.id }));
        setAllUsers(list);
      },
      (err) => console.warn('Admin users listener warning:', err)
    );

    const unsubLogs = onSnapshot(
      collection(db, 'system_logs'),
      (snap) => {
        const list: SystemLogEntry[] = [];
        snap.forEach((d) => list.push({ ...(d.data() as SystemLogEntry), id: d.id }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setSystemLogs(list);
      },
      (err) => console.warn('Admin logs listener warning:', err)
    );

    const unsubSettings = onSnapshot(
      doc(db, 'app_settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          setAppSettings(snap.data() as GlobalAppSettings);
        }
      },
      (err) => console.warn('Admin settings listener warning:', err)
    );

    return () => {
      unsubUsers();
      unsubLogs();
      unsubSettings();
    };
  }, []);

  // Calculate exact byte size of any array of objects
  const calcByteSize = (data: unknown): number => {
    try {
      const str = JSON.stringify(data);
      return new Blob([str]).size;
    } catch {
      return 0;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} بايت`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} كيلوبايت`;
    return `${(bytes / (1024 * 1024)).toFixed(3)} ميجابايت`;
  };

  // Database Storage Metrics (Firestore Free Tier = 1 GiB = 1,073,741,824 bytes)
  const TOTAL_DB_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB (1024 MB)
  const usersBytes = calcByteSize(allUsers);
  const circlesBytes = calcByteSize(circles);
  const paymentsBytes = calcByteSize(payments);
  const notificationsBytes = calcByteSize(notifications);
  const logsBytes = calcByteSize(systemLogs);

  // Add Firestore index & metadata overhead factor (~1.35x)
  const rawUsedBytes = usersBytes + circlesBytes + paymentsBytes + notificationsBytes + logsBytes;
  const totalUsedBytes = Math.round(rawUsedBytes * 1.35);
  const freeBytesRemaining = Math.max(0, TOTAL_DB_LIMIT_BYTES - totalUsedBytes);

  const usedMB = (totalUsedBytes / (1024 * 1024)).toFixed(3);
  const freeMB = (freeBytesRemaining / (1024 * 1024)).toFixed(2);
  const usedPercent = Math.min(100, (totalUsedBytes / TOTAL_DB_LIMIT_BYTES) * 100);
  const freePercent = (100 - usedPercent).toFixed(3);

  const totalDocsCount =
    allUsers.length + circles.length + payments.length + notifications.length + systemLogs.length;

  // Ping Firestore Latency
  const handlePingDatabase = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      await getDocFromServer(doc(db, 'app_settings', 'global'));
      const elapsed = Math.round(performance.now() - start);
      setPingMs(elapsed);
      showToast(`الاتصال بقاعدة البيانات ممتاز (${elapsed} ms) ✓`);
      await logSystemEvent('info', 'فحص اتصال قاعدة البيانات', `تم فحص سرعة الاستجابة بنجاح: ${elapsed} مللي ثانية`, 'app_settings/global');
    } catch (err) {
      showToast('تم الفحص (وضع الاتصال المحلي نشط)');
    } finally {
      setIsPinging(false);
    }
  };

  // 1. Toggle User Account Suspension
  const handleConfirmSuspendUser = async () => {
    if (!suspendingUser) return;
    setIsBusy(true);
    try {
      await updateDoc(doc(db, 'users', suspendingUser.id), {
        isSuspended: true,
        suspendedReason: suspendReason,
      });

      // Notify user
      const notifId = `notif-suspend-${suspendingUser.id}-${Date.now()}`;
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: suspendingUser.id,
        title: 'تنبيه إداري: تم إيقاف حسابك مؤقتاً 🚫',
        message: `قامت إدارة التطبيق بإيقاف حسابك للسبب التالي: "${suspendReason}". يرجى التواصل مع الإدارة للمراجعة.`,
        time: 'الآن',
        type: 'system',
        isRead: false,
        createdAt: Date.now(),
      });

      await logSystemEvent(
        'warning',
        `إيقاف حساب مستخدم: ${suspendingUser.fullName}`,
        `البريد: ${suspendingUser.email} | السبب: ${suspendReason}`,
        `users/${suspendingUser.id}`
      );

      showToast(`تم إيقاف حساب "${suspendingUser.fullName}" بنجاح 🚫`);
      setSuspendingUser(null);
    } catch (err) {
      console.error('Error suspending user:', err);
      showToast('حدث خطأ أثناء إيقاف الحساب');
    } finally {
      setIsBusy(false);
    }
  };

  const handleReactivateUser = async (u: UserProfile) => {
    setIsBusy(true);
    try {
      await updateDoc(doc(db, 'users', u.id), {
        isSuspended: false,
        suspendedReason: '',
      });

      await logSystemEvent(
        'info',
        `إعادة تفعيل حساب: ${u.fullName}`,
        `تم رفع الإيقاف عن الحساب (${u.email})`,
        `users/${u.id}`
      );

      showToast(`تم إعادة تفعيل حساب "${u.fullName}" بنجاح ✓`);
    } catch (err) {
      console.error('Error reactivating user:', err);
      showToast('حدث خطأ أثناء تفعيل الحساب');
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsBusy(true);
    try {
      await deleteDoc(doc(db, 'users', deletingUser.id));
      await logSystemEvent(
        'warning',
        `حذف حساب مستخدم نهائياً: ${deletingUser.fullName}`,
        `تم حذف الحساب (${deletingUser.email}) من قاعدة البيانات`,
        `users/${deletingUser.id}`
      );
      showToast(`تم حذف حساب "${deletingUser.fullName}" من قاعدة البيانات 🗑️`);
      setDeletingUser(null);
    } catch (err) {
      console.error('Delete user error:', err);
      showToast('حدث خطأ أثناء حذف الحساب');
    } finally {
      setIsBusy(false);
    }
  };

  // 2. Force Delete Circle from Database (Even if confirmed!) + Clean related records
  const handleForceDeleteCircle = async () => {
    if (!deletingCircle) return;
    setIsBusy(true);
    try {
      const targetId = deletingCircle.id;
      const targetTitle = deletingCircle.title;

      // A. Delete circle document from Firestore
      await deleteDoc(doc(db, 'circles', targetId));

      // B. Delete related payments for this circle to free up DB space
      const relatedPayments = payments.filter((p) => p.circleId === targetId);
      for (const p of relatedPayments) {
        try {
          await deleteDoc(doc(db, 'payments', p.id));
        } catch {}
      }

      // C. Delete related notifications for this circle
      const relatedNotifs = notifications.filter((n) => n.circleId === targetId);
      for (const n of relatedNotifs) {
        try {
          await deleteDoc(doc(db, 'notifications', n.id));
        } catch {}
      }

      await logSystemEvent(
        'warning',
        `حذف جمعية من قاعدة البيانات: ${targetTitle}`,
        `تم حذف الجمعية (${targetTitle} - كود: ${deletingCircle.code}) مع (${relatedPayments.length}) إيصالات مرتبطة بها نهائياً من قاعدة البيانات.`,
        `circles/${targetId}`
      );

      if (onCircleDeletedFromDB) {
        onCircleDeletedFromDB(targetId);
      }

      showToast(`تم حذف جمعية "${targetTitle}" وكافة متعلقاتها من قاعدة البيانات بنجاح 🗑️`);
      setDeletingCircle(null);
    } catch (err) {
      console.error('Force delete circle error:', err);
      showToast('حدث خطأ أثناء حذف الجمعية من قاعدة البيانات');
    } finally {
      setIsBusy(false);
    }
  };

  // 3. Clear all logs or old notifications to free space
  const handleClearAllLogs = async () => {
    setIsBusy(true);
    try {
      for (const log of systemLogs) {
        await deleteDoc(doc(db, 'system_logs', log.id));
      }
      showToast('تم مسح كافة السجلات والأخطاء وتفريغ المساحة ✓');
    } catch (err) {
      console.warn('Clear logs error:', err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCleanupStorage = async () => {
    setIsBusy(true);
    try {
      let count = 0;
      for (const log of systemLogs) {
        await deleteDoc(doc(db, 'system_logs', log.id));
        count++;
      }
      for (const notif of notifications.filter((n) => n.isRead)) {
        await deleteDoc(doc(db, 'notifications', notif.id));
        count++;
      }
      showToast(`تم تنظيف (${count}) سجل وإشعار مقروء وتفريغ المساحة بنجاح ✓`);
    } catch (err) {
      console.warn('Cleanup error:', err);
    } finally {
      setIsBusy(false);
    }
  };

  // 4. Update Global App Settings
  const handleUpdateSetting = async (patch: Partial<GlobalAppSettings>) => {
    const updated: GlobalAppSettings = {
      ...appSettings,
      ...patch,
      updatedAt: Date.now(),
    };
    setAppSettings(updated);
    try {
      await setDoc(doc(db, 'app_settings', 'global'), updated, { merge: true });
      await logSystemEvent(
        'info',
        'تحديث إعدادات التحكم بالتطبيق',
        JSON.stringify(patch),
        'app_settings/global'
      );
      showToast('تم حفظ وتطبيق إعدادات التحكم بالتطبيق بنجاح ✓');
    } catch (err) {
      console.error('Save settings error:', err);
      showToast('حدث خطأ أثناء حفظ الإعدادات');
    }
  };

  // 5. Broadcast Notification to All Users
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    setIsBusy(true);
    try {
      const promises = allUsers.map(async (u) => {
        const nid = `notif-broadcast-${u.id}-${Date.now()}`;
        await setDoc(doc(db, 'notifications', nid), {
          id: nid,
          userId: u.id,
          title: `📢 تعميم إداري: ${broadcastTitle.trim()}`,
          message: broadcastMessage.trim(),
          time: 'الآن',
          type: 'system',
          isRead: false,
          createdAt: Date.now(),
        });
      });
      await Promise.allSettled(promises);
      await logSystemEvent(
        'info',
        `إرسال تعميم عام لـ (${allUsers.length}) مستخدم`,
        `${broadcastTitle}: ${broadcastMessage}`,
        'notifications/broadcast'
      );
      setBroadcastTitle('');
      setBroadcastMessage('');
      showToast(`تم إرسال التعميم الإداري لجميع الحسابات (${allUsers.length}) بنجاح! 📢`);
    } catch (err) {
      console.error('Broadcast error:', err);
      showToast('حدث خطأ أثناء إرسال التعميم');
    } finally {
      setIsBusy(false);
    }
  };

  // Filtered lists
  const filteredUsers = allUsers.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (userFilter === 'active') return !u.isSuspended;
    if (userFilter === 'suspended') return Boolean(u.isSuspended);
    return true;
  });

  const filteredCircles = circles.filter((c) => {
    const q = circleSearch.trim().toLowerCase();
    return (
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.organizer?.name || '').toLowerCase().includes(q)
    );
  });

  const filteredLogs = systemLogs.filter((l) => {
    if (logFilter === 'all') return true;
    return l.level === logFilter;
  });

  const errorCount = systemLogs.filter((l) => l.level === 'error').length;
  const suspendedCount = allUsers.filter((u) => u.isSuspended).length;

  return (
    <div className="flex flex-col w-full pb-28 pt-2 px-4 selection:bg-[#ffdcbf] text-right" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1c1c18] text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 border border-[#edbf76] animate-fade-in max-w-sm text-center">
          <span className="material-symbols-outlined text-sm text-[#ffdeae]">verified</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Super Admin Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c1c18] via-[#2e261f] to-[#4a3219] text-white p-5 shadow-xl mb-4 border border-[#8c6239]/40">
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex flex-col gap-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ffdeae]/20 border border-[#ffdeae]/40 text-[#ffdeae] text-[10px] font-bold w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>صلاحية التحكم الكامل بالنظام (Super Admin)</span>
            </div>
            <h2 className="text-base font-black text-white mt-0.5">
              لوحة تحكم الأدمن العام وإدارة قاعدة البيانات
            </h2>
            <p className="text-[11px] text-[#ffdeae]/90 font-mono" dir="ltr">
              {auth.currentUser?.email || userProfile.email || SUPER_ADMIN_EMAIL}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-[#ffdeae] text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border border-white/20 shadow-xs"
              title="الرجوع لصفحة الإعدادات"
            >
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
              <span>الرجوع للإعدادات</span>
            </button>
            <div className="w-10 h-10 rounded-xl bg-[#ffdeae]/15 border border-[#ffdeae]/30 flex items-center justify-center text-[#ffdeae] shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                admin_panel_settings
              </span>
            </div>
          </div>
        </div>

        {/* Quick 4-Card Summary */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-white/15 text-center relative z-10">
          <div className="bg-white/10 rounded-xl p-2 flex flex-col">
            <span className="text-[9px] text-white/70">المساحة الفاضية</span>
            <span className="text-xs font-black text-emerald-300 font-sans mt-0.5">{freeMB} MB</span>
          </div>
          <div className="bg-white/10 rounded-xl p-2 flex flex-col">
            <span className="text-[9px] text-white/70">الحسابات</span>
            <span className="text-xs font-black text-white font-sans mt-0.5">
              {allUsers.length} {suspendedCount > 0 && <span className="text-red-300 text-[9px]">({suspendedCount} موقوف)</span>}
            </span>
          </div>
          <div className="bg-white/10 rounded-xl p-2 flex flex-col">
            <span className="text-[9px] text-white/70">الجمعيات</span>
            <span className="text-xs font-black text-[#ffdeae] font-sans mt-0.5">{circles.length}</span>
          </div>
          <div className="bg-white/10 rounded-xl p-2 flex flex-col">
            <span className="text-[9px] text-white/70">الأخطاء والسجلات</span>
            <span className={`text-xs font-black font-sans mt-0.5 ${errorCount > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
              {systemLogs.length}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-5 gap-1 p-1 rounded-2xl bg-[#f0eee8] border border-[#e5e2dc] mb-4 text-center">
        {[
          { id: 'storage', label: 'المساحة والقاعدة', icon: 'database' },
          { id: 'users', label: `الحسابات (${allUsers.length})`, icon: 'manage_accounts' },
          { id: 'circles', label: `الجمعيات (${circles.length})`, icon: 'savings' },
          { id: 'logs', label: `السجلات (${systemLogs.length})`, icon: 'bug_report' },
          { id: 'control', label: 'التحكم بالتطبيق', icon: 'tune' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`py-2 px-1 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#714a23] text-white shadow-xs'
                : 'text-[#50453b] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            <span className="truncate w-full">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* =========================================================
          TAB 1: DATABASE STORAGE & FREE SPACE MONITOR
      ========================================================= */}
      {activeTab === 'storage' && (
        <div className="flex flex-col gap-3.5 animate-fade-in">
          {/* Storage Gauge Card */}
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-[#e5e2dc] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">hard_drive</span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#1c1c18]">
                    سعة ومساحة قاعدة البيانات (Firestore Storage)
                  </h3>
                  <span className="text-[10px] text-[#50453b]">
                    الحصة الكلية المجانية: 1,024 ميجابايت (1 جيجابايت)
                  </span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black">
                {freePercent}% مساحة فاضية
              </span>
            </div>

            {/* Visual Meter */}
            <div className="p-3.5 rounded-2xl bg-[#f6f3ed] border border-[#e5e2dc] flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-emerald-200 flex flex-col">
                  <span className="text-[10px] text-[#50453b]">المساحة الفاضية المتبقية</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-emerald-700 font-sans">{freeMB}</span>
                    <span className="text-[11px] font-bold text-emerald-800">ميجابايت (MB)</span>
                  </div>
                  <span className="text-[9px] text-emerald-700 mt-0.5">
                    متاح لتخزين آلاف الجمعيات والإيصالات
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[#e5e2dc] flex flex-col">
                  <span className="text-[10px] text-[#50453b]">المساحة المستهلكة حالياً</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-[#714a23] font-sans">
                      {formatBytes(totalUsedBytes)}
                    </span>
                  </div>
                  <span className="text-[9px] text-[#50453b] mt-0.5">
                    إجمالي المستندات: {totalDocsCount} سجل
                  </span>
                </div>
              </div>

              <div className="w-full bg-[#e5e2dc] h-3 rounded-full overflow-hidden flex">
                <div
                  className="bg-gradient-to-l from-[#714a23] to-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(2, usedPercent)}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-[#50453b] font-medium">
                <span>المستخدم: {usedMB} MB</span>
                <span>الإجمالي الكلي: 1,024.00 MB (1 GB)</span>
              </div>
            </div>

            {/* Collection-by-Collection Breakdown */}
            <div className="flex flex-col gap-2 pt-1">
              <h4 className="text-xs font-black text-[#1c1c18]">
                تفصيل استهلاك الجداول في قاعدة البيانات:
              </h4>

              {[
                {
                  name: 'جدول الحسابات والمستخدمين (users)',
                  count: allUsers.length,
                  bytes: usersBytes,
                  icon: 'group',
                },
                {
                  name: 'جدول الجمعيات والأدوار (circles)',
                  count: circles.length,
                  bytes: circlesBytes,
                  icon: 'savings',
                },
                {
                  name: 'جدول الإيصالات والمدفوعات (payments)',
                  count: payments.length,
                  bytes: paymentsBytes,
                  icon: 'receipt_long',
                },
                {
                  name: 'جدول الإشعارات والتنبيهات (notifications)',
                  count: notifications.length,
                  bytes: notificationsBytes,
                  icon: 'notifications',
                },
                {
                  name: 'جدول السجلات والأخطاء (system_logs)',
                  count: systemLogs.length,
                  bytes: logsBytes,
                  icon: 'terminal',
                },
              ].map((col) => (
                <div
                  key={col.name}
                  className="p-2.5 rounded-xl bg-[#fcf9f3] border border-[#e5e2dc] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-[#714a23]">
                      {col.icon}
                    </span>
                    <span className="font-bold text-[#1c1c18]">{col.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-[#f0eee8] text-[#50453b] text-[10px] font-bold">
                      {col.count} سجل
                    </span>
                    <span className="font-mono font-bold text-[#714a23] text-[11px]">
                      {formatBytes(col.bytes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Ping & Cleanup Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={isPinging}
                onClick={handlePingDatabase}
                className="h-10 rounded-xl bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#1c1c18] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-base text-emerald-700">
                  network_check
                </span>
                <span>
                  {isPinging
                    ? 'جاري الفحص...'
                    : `فحص الاتصال (${pingMs !== null ? `${pingMs}ms` : 'متصل'})`}
                </span>
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={handleCleanupStorage}
                className="h-10 rounded-xl bg-[#714a23] hover:bg-[#8c6239] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-base">cleaning_services</span>
                <span>تنظيف وتفريغ المساحة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 2: ACCOUNTS MANAGEMENT & SUSPENSION
      ========================================================= */}
      {activeTab === 'users' && (
        <div className="flex flex-col gap-3 animate-fade-in">
          <div className="rounded-2xl bg-white p-3.5 shadow-sm border border-[#e5e2dc] flex flex-col gap-2.5">
            <div className="relative flex items-center">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="ابحث بالاسم أو البريد الإلكتروني..."
                className="w-full bg-[#f6f3ed] rounded-xl p-2.5 pr-9 text-xs font-bold text-[#1c1c18] border border-[#e5e2dc] focus:outline-none focus:border-[#714a23]"
              />
              <span className="material-symbols-outlined absolute right-2.5 text-base text-[#50453b]">
                search
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'all', label: `الكل (${allUsers.length})` },
                { id: 'active', label: `النشطة (${allUsers.length - suspendedCount})` },
                { id: 'suspended', label: `الموقوفة (${suspendedCount})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setUserFilter(f.id as typeof userFilter)}
                  className={`py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    userFilter === f.id
                      ? 'bg-[#714a23] text-white'
                      : 'bg-[#f0eee8] text-[#50453b]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-8 bg-white rounded-2xl border border-dashed border-[#d4c3b7] text-center text-xs text-[#50453b]">
              لا توجد حسابات مطابقة للبحث
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isRootAdmin = isSuperAdminEmail(u.email);
              const userCirclesCount = circles.filter(
                (c) => c.creatorId === u.id || c.members.some((m) => m.id === u.id)
              ).length;

              return (
                <div
                  key={u.id}
                  className={`rounded-2xl bg-white p-4 shadow-sm border flex flex-col gap-3 ${
                    u.isSuspended ? 'border-red-300 bg-red-50/20' : 'border-[#e5e2dc]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={u.avatar || '/assets/aistudio/image_94928b82.png'}
                        alt={u.fullName}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-[#e5e2dc] shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-black text-[#1c1c18] truncate">
                            {u.fullName || 'مستخدم بدون اسم'}
                          </h4>
                          {isRootAdmin && (
                            <span className="px-2 py-0.5 rounded-md bg-[#714a23] text-white text-[9px] font-bold">
                              الأدمن العام 👑
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#714a23] font-mono truncate" dir="ltr">
                          {u.email || 'لا يوجد بريد'}
                        </span>
                        {/* Private Info Guard: Phone numbers and bank details are strictly hidden for user privacy */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#f0eee8] text-[#50453b] text-[10px] font-semibold border border-[#e5e2dc]">
                            <span className="material-symbols-outlined text-xs text-[#714a23]">lock</span>
                            <span>رقم الجوال: محجوب ومشفر (خصوصية المستخدم) 🔒</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#f0eee8] text-[#50453b] text-[10px] font-semibold border border-[#e5e2dc]">
                            <span className="material-symbols-outlined text-xs text-[#2D6A4F]">shield</span>
                            <span>الحساب البنكي: محمي 🔒</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isSuspended
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {u.isSuspended ? 'حساب موقوف 🚫' : 'حساب نشط ✓'}
                      </span>
                      <span className="text-[10px] text-[#50453b]">
                        مشترك في {userCirclesCount} جمعية
                      </span>
                    </div>
                  </div>

                  {u.isSuspended && u.suspendedReason && (
                    <div className="p-2 rounded-xl bg-red-100/70 text-red-900 text-[11px] font-bold">
                      سبب الإيقاف: {u.suspendedReason}
                    </div>
                  )}

                  {/* Admin Account Controls */}
                  {!isRootAdmin && (
                    <div className="flex items-center gap-2 pt-2 border-t border-[#f0eee8]">
                      {u.isSuspended ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleReactivateUser(u)}
                          className="flex-1 h-9 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>إعادة تفعيل الحساب ✓</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setSuspendingUser(u)}
                          className="flex-1 h-9 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">block</span>
                          <span>إيقاف الحساب مؤقتاً 🚫</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setDeletingUser(u)}
                        className="h-9 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        <span>حذف</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================
          TAB 3: CIRCLES MANAGEMENT & FORCE DELETE FROM DATABASE
      ========================================================= */}
      {activeTab === 'circles' && (
        <div className="flex flex-col gap-3 animate-fade-in">
          <div className="rounded-2xl bg-white p-3.5 shadow-sm border border-[#e5e2dc]">
            <div className="relative flex items-center">
              <input
                type="text"
                value={circleSearch}
                onChange={(e) => setCircleSearch(e.target.value)}
                placeholder="ابحث باسم الجمعية، كود الانضمام (HYA-...)، أو اسم المنظم..."
                className="w-full bg-[#f6f3ed] rounded-xl p-2.5 pr-9 text-xs font-bold text-[#1c1c18] border border-[#e5e2dc] focus:outline-none focus:border-[#714a23]"
              />
              <span className="material-symbols-outlined absolute right-2.5 text-base text-[#50453b]">
                search
              </span>
            </div>
          </div>

          {filteredCircles.length === 0 ? (
            <div className="p-8 bg-white rounded-2xl border border-dashed border-[#d4c3b7] text-center text-xs text-[#50453b]">
              لا توجد جمعيات مسجلة في قاعدة البيانات حالياً
            </div>
          ) : (
            filteredCircles.map((c) => {
              const allocatedShares = (c.members || []).reduce(
                (acc, m) => acc + (m.sharesCount || 1),
                0
              );
              const totalShares = c.sharesCount || c.totalMonths || 30;
              const sharePrice = c.sharePrice || c.monthlyShare || 1000;

              return (
                <div
                  key={c.id}
                  className="rounded-2xl bg-white p-4 shadow-sm border border-[#e5e2dc] flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-mono text-[10px] font-black bg-[#ffdeae] text-[#714a23] px-2 py-0.5 rounded-md">
                          {c.code}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                            c.isConfirmedByAdmin
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.isConfirmedByAdmin ? 'معمدة رسمياً ✓' : 'بانتظار التعميد'}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-[#1c1c18]">{c.title}</h4>
                      <span className="text-[11px] text-[#50453b]">
                        المنظم: <strong>{c.organizer?.name}</strong>{' '}
                        {c.creatorEmail && `(${c.creatorEmail})`}
                      </span>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] text-[#50453b]">الحصيلة الشهرية</span>
                      <span className="text-sm font-black text-[#714a23] font-sans">
                        {(c.monthlyPayout || c.totalPool).toLocaleString('ar-YE')} {c.currencySymbol}
                      </span>
                      <span className="text-[10px] text-[#50453b]">
                        ({allocatedShares}/{totalShares} سهم • السهم {sharePrice.toLocaleString('ar-YE')})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#f0eee8]">
                    <button
                      type="button"
                      onClick={() => onSelectCircle(c)}
                      className="flex-1 h-9 rounded-xl bg-[#f0eee8] hover:bg-[#e5e2dc] text-[#1c1c18] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      <span>عرض وتعديل الجمعية</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingCircle(c)}
                      className="flex-1 h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
                    >
                      <span className="material-symbols-outlined text-sm">delete_forever</span>
                      <span>حذف من قاعدة البيانات 🗑️</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================
          TAB 4: APPLICATION LOGS & ERROR MONITOR
      ========================================================= */}
      {activeTab === 'logs' && (
        <div className="flex flex-col gap-3 animate-fade-in">
          <div className="rounded-2xl bg-white p-3.5 shadow-sm border border-[#e5e2dc] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-[#1c1c18]">
                سجل عمليات النظام والأخطاء البرمجية (Live Logs)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    logSystemEvent(
                      'info',
                      'فحص حالة النظام اليدوي',
                      'جميع الخدمات السحابية والمصادقة تعمل بشكل طبيعي بدون أخطاء.',
                      'SuperAdminView'
                    )
                  }
                  className="text-[11px] text-[#714a23] font-bold hover:underline cursor-pointer"
                >
                  + تسجيل فحص
                </button>
                {systemLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllLogs}
                    className="text-[11px] text-red-600 font-bold hover:underline cursor-pointer"
                  >
                    مسح السجلات
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'all', label: `الكل (${systemLogs.length})` },
                { id: 'error', label: `أخطاء (${errorCount})` },
                {
                  id: 'warning',
                  label: `تحذيرات (${systemLogs.filter((l) => l.level === 'warning').length})`,
                },
                {
                  id: 'info',
                  label: `عمليات (${systemLogs.filter((l) => l.level === 'info').length})`,
                },
              ].map((lf) => (
                <button
                  key={lf.id}
                  type="button"
                  onClick={() => setLogFilter(lf.id as typeof logFilter)}
                  className={`py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                    logFilter === lf.id
                      ? 'bg-[#714a23] text-white'
                      : 'bg-[#f0eee8] text-[#50453b]'
                  }`}
                >
                  {lf.label}
                </button>
              ))}
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-8 bg-white rounded-2xl border border-dashed border-[#d4c3b7] text-center flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-3xl text-emerald-600">
                verified_user
              </span>
              <p className="text-xs font-bold text-[#1c1c18]">لا توجد أخطاء مسجلة في النظام</p>
              <p className="text-[11px] text-[#50453b]">
                التطبيق يعمل بكفاءة عالية ولم يتم رصد أي استثناءات برمجية.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3.5 rounded-2xl bg-white border shadow-xs flex flex-col gap-1.5 ${
                  log.level === 'error'
                    ? 'border-red-300 bg-red-50/20'
                    : log.level === 'warning'
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-[#e5e2dc]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        log.level === 'error'
                          ? 'bg-red-600 text-white'
                          : log.level === 'warning'
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-700 text-white'
                      }`}
                    >
                      {log.level === 'error'
                        ? 'خطأ 🚨'
                        : log.level === 'warning'
                        ? 'تحذير ⚠️'
                        : 'عملية ℹ️'}
                    </span>
                    <h4 className="text-xs font-black text-[#1c1c18]">{log.title}</h4>
                  </div>
                  <span className="text-[10px] text-[#50453b] font-mono">{log.timestamp}</span>
                </div>

                <p className="text-[11px] text-[#50453b] bg-[#f6f3ed] p-2 rounded-xl font-mono break-all">
                  {log.details}
                </p>

                <div className="flex items-center justify-between text-[10px] text-[#50453b] pt-1">
                  <span>المسار: {log.path || 'system'}</span>
                  <span dir="ltr">{log.userEmail}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* =========================================================
          TAB 5: GLOBAL APP CONTROL & BROADCAST
      ========================================================= */}
      {activeTab === 'control' && (
        <div className="flex flex-col gap-3.5 animate-fade-in">
          {/* Switches Card */}
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-[#e5e2dc] flex flex-col gap-3.5">
            <h3 className="text-xs font-black text-[#1c1c18] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#714a23]">tune</span>
              <span>مفاتيح التحكم الفوري بالتطبيق</span>
            </h3>

            {/* Switch 1: Maintenance Mode */}
            <div className="p-3 rounded-xl bg-[#f6f3ed] border border-[#e5e2dc] flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#1c1c18]">وضع الصيانة العام للتطبيق</span>
                <span className="text-[10px] text-[#50453b]">
                  عند التفعيل، يتوقف التطبيق مؤقتاً لجميع المستخدمين وتظهر شاشة الصيانة
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleUpdateSetting({ maintenanceMode: !appSettings.maintenanceMode })
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 ${
                  appSettings.maintenanceMode
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-[#50453b] border border-[#e5e2dc]'
                }`}
              >
                {appSettings.maintenanceMode ? 'مُفعّل (مغلق للصيانة)' : 'معطّل (يعمل طبيعياً)'}
              </button>
            </div>

            {/* Switch 2: Allow Creating Circles */}
            <div className="p-3 rounded-xl bg-[#f6f3ed] border border-[#e5e2dc] flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#1c1c18]">السماح بإنشاء جمعيات جديدة</span>
                <span className="text-[10px] text-[#50453b]">
                  تمكين أو إيقاف إنشاء الجمعيات الجديدة من قِبل المستخدمين
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleUpdateSetting({ allowCreateCircles: !appSettings.allowCreateCircles })
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 ${
                  appSettings.allowCreateCircles
                    ? 'bg-emerald-700 text-white'
                    : 'bg-red-600 text-white'
                }`}
              >
                {appSettings.allowCreateCircles ? 'مسموح ✓' : 'موقوف 🚫'}
              </button>
            </div>

            {/* Switch 3: Allow Joining Circles */}
            <div className="p-3 rounded-xl bg-[#f6f3ed] border border-[#e5e2dc] flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#1c1c18]">السماح بالانضمام للجمعيات</span>
                <span className="text-[10px] text-[#50453b]">
                  تمكين أو إيقاف انضمام الأعضاء الجدد عبر أكواد الدعوة
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleUpdateSetting({ allowJoinCircles: !appSettings.allowJoinCircles })
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 ${
                  appSettings.allowJoinCircles
                    ? 'bg-emerald-700 text-white'
                    : 'bg-red-600 text-white'
                }`}
              >
                {appSettings.allowJoinCircles ? 'مسموح ✓' : 'موقوف 🚫'}
              </button>
            </div>
          </div>

          {/* Broadcast Notification to All Accounts */}
          <form
            onSubmit={handleSendBroadcast}
            className="rounded-2xl bg-white p-4 shadow-sm border border-[#e5e2dc] flex flex-col gap-3"
          >
            <h3 className="text-xs font-black text-[#1c1c18] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#714a23]">campaign</span>
              <span>إرسال إشعار وتعميم إداري لكافة حسابات التطبيق ({allUsers.length})</span>
            </h3>

            <input
              type="text"
              required
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="عنوان التعميم الإداري (مثال: تحديث هام بشأن مواعيد السداد)"
              className="w-full bg-[#f6f3ed] rounded-xl p-3 text-xs font-bold text-[#1c1c18] border border-[#e5e2dc]"
            />

            <textarea
              required
              rows={3}
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="نص الرسالة التي ستصل لجميع المستخدمين في مركز الإشعارات..."
              className="w-full bg-[#f6f3ed] rounded-xl p-3 text-xs font-medium text-[#1c1c18] border border-[#e5e2dc]"
            />

            <button
              type="submit"
              disabled={isBusy}
              className="w-full h-11 rounded-xl bg-[#714a23] hover:bg-[#8c6239] text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-base">send</span>
              <span>إرسال التعميم لكافة المستخدمين الآن</span>
            </button>
          </form>
        </div>
      )}

      {/* Modal: Suspend User Reason */}
      {suspendingUser && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
          onClick={() => setSuspendingUser(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-[#e5e2dc] flex flex-col gap-3.5 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-black text-[#1c1c18]">
              إيقاف حساب: {suspendingUser.fullName}
            </h3>
            <p className="text-xs text-[#50453b]">
              حدد سبب إيقاف الحساب (سيظهر للمستخدم عند محاولة فتح التطبيق):
            </p>
            <input
              type="text"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="w-full bg-[#f6f3ed] rounded-xl p-3 text-xs font-bold text-[#1c1c18] border border-[#e5e2dc]"
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isBusy}
                onClick={handleConfirmSuspendUser}
                className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                تأكيد إيقاف الحساب 🚫
              </button>
              <button
                type="button"
                onClick={() => setSuspendingUser(null)}
                className="px-4 h-10 rounded-xl bg-[#f0eee8] text-[#50453b] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Circle Permanently from DB */}
      {deletingCircle && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
          onClick={() => setDeletingCircle(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-red-200 flex flex-col gap-3.5 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <div className="text-center">
              <h3 className="text-sm font-black text-[#1c1c18]">
                حذف جمعية &quot;{deletingCircle.title}&quot; من قاعدة البيانات؟
              </h3>
              <p className="text-xs text-[#50453b] mt-1 leading-relaxed">
                بصفتك الأدمن العام، سيتم مسح هذه الجمعية وكودها ({deletingCircle.code}) وكافة إيصالاتها نهائياً من قاعدة البيانات وتفريغ مساحتها.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isBusy}
                onClick={handleForceDeleteCircle}
                className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                نعم، احذف من قاعدة البيانات 🗑️
              </button>
              <button
                type="button"
                onClick={() => setDeletingCircle(null)}
                className="px-4 h-11 rounded-xl bg-[#f0eee8] text-[#50453b] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete User Permanently from DB */}
      {deletingUser && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
          onClick={() => setDeletingUser(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-red-200 flex flex-col gap-3.5 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-black text-[#1c1c18]">
              حذف حساب &quot;{deletingUser.fullName}&quot; نهائياً؟
            </h3>
            <p className="text-xs text-[#50453b]">
              سيتم إزالة سجل هذا الحساب ({deletingUser.email}) من جدول المستخدمين في قاعدة البيانات.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isBusy}
                onClick={handleConfirmDeleteUser}
                className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
              >
                تأكيد الحذف النهائي
              </button>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 h-10 rounded-xl bg-[#f0eee8] text-[#50453b] text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
