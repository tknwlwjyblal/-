import { PhoneNotificationSettings } from '../components/PhoneNotificationSettings';
import React, { useState } from 'react';
import { AppNotification, ActiveView, SavingsCircle, isNotificationForUser } from '../types';
import { db, auth } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';

interface Props {
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onNavigate: (view: ActiveView) => void;
  onSelectCircleById: (id: string) => void;
  onOpenAdminApprovalsForCircle?: (circleId: string) => void;
  circles: SavingsCircle[];
  onDeleteNotification?: (id: string) => void;
  onClearAllNotifications?: () => void;
}

function getNotificationTimestamp(notif: AppNotification): number {
  if (typeof notif.createdAt === 'number' && !isNaN(notif.createdAt) && notif.createdAt > 0) {
    return notif.createdAt;
  }
  const matches = (notif.id || '').match(/(\d{10,14})/g);
  if (matches && matches.length > 0) {
    const nums = matches.map((m) => parseInt(m, 10)).filter((n) => !isNaN(n) && n > 1600000000000);
    if (nums.length > 0) {
      return Math.max(...nums);
    }
  }
  return 0;
}

function formatNotificationTime(timestamp: number, fallbackStr?: string): string {
  if (!timestamp || timestamp === 0) return fallbackStr || 'الآن';
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return 'الآن';
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `منذ ${minutes} ${minutes === 1 ? 'دقيقة' : minutes === 2 ? 'دقيقتين' : 'دقائق'}`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `منذ ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : 'ساعات'}`;
  }
  const d = new Date(timestamp);
  return d.toLocaleDateString('ar-YE', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const NotificationsView: React.FC<Props> = ({
  notifications,
  onMarkAllRead,
  onNavigate,
  onSelectCircleById,
  onOpenAdminApprovalsForCircle,
  circles,
  onDeleteNotification,
  onClearAllNotifications,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'unread' | string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [showConfirmClearModal, setShowConfirmClearModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteSingle = async (notifId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(notifId);

    try {
      await deleteDoc(doc(db, 'notifications', notifId));
    } catch (err) {
      console.warn('Delete notification warning:', err);
    }

    if (onDeleteNotification) {
      onDeleteNotification(notifId);
    }

    setDeletingId(null);
    showToast('تم حذف الإشعار بنجاح ✓');
  };

  const handleExecuteClearAll = async () => {
    if (notifications.length === 0) return;
    setIsClearingAll(true);
    setShowConfirmClearModal(false);

    try {
      const deletePromises = notifications.map(async (n) => {
        try {
          await deleteDoc(doc(db, 'notifications', n.id));
        } catch (err) {
          console.warn('Failed to delete notif doc:', n.id, err);
        }
      });
      await Promise.allSettled(deletePromises);
    } catch (err) {
      console.warn('Clear all error:', err);
    }

    if (onClearAllNotifications) {
      onClearAllNotifications();
    }

    setIsClearingAll(false);
    showToast('تم مسح وحذف كافة الإشعارات بنجاح ✓');
  };

  const currentUid = auth.currentUser?.uid;
  const currentEmail = auth.currentUser?.email;
  const managedCircleIds = new Set(
    circles
      .filter(
        (c) =>
          c.creatorId === currentUid ||
          c.organizer?.creatorId === currentUid ||
          (currentEmail && c.creatorEmail?.trim().toLowerCase() === currentEmail.trim().toLowerCase())
      )
      .map((c) => c.id)
  );

  // Filter and sort by newest first, strictly ensuring proper recipient role routing
  const validUserNotifications = notifications.filter((n) =>
    isNotificationForUser(n, currentUid, currentEmail, managedCircleIds)
  );

  // Sort strictly by timestamp descending (newest first)
  const sortedNotifications = [...validUserNotifications].sort((a, b) => {
    const timeA = getNotificationTimestamp(a);
    const timeB = getNotificationTimestamp(b);
    return timeB - timeA;
  });

  const filteredNotifications = sortedNotifications.filter((item) => {
    if (filterMode === 'unread') {
      return !item.isRead;
    }
    if (filterMode !== 'all') {
      return item.circleId === filterMode;
    }
    return true;
  });

  return (
    <div className="flex flex-col w-full pb-28 pt-2 px-4 selection:bg-[#ffdcbf] text-right" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1c1c18] text-[#fcf9f3] px-4 py-2.5 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 border border-[#8c6239]/40 animate-fade-in max-w-sm text-center">
          <span className="material-symbols-outlined text-sm text-[#edbf76]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Confirmation Modal for Clear All */}
      {showConfirmClearModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-[#e5e2dc] text-right flex flex-col gap-3.5 animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">delete_sweep</span>
            </div>
            <div className="text-center">
              <h3 className="text-base font-black text-[#1c1c18]">مسح كافة الإشعارات</h3>
              <p className="text-xs text-[#50453b] mt-1 leading-relaxed">
                هل أنت متأكد من مسح وحذف جميع التنبيهات من حسابك نهائياً؟ لن تتمكن من استرجاعها بعد الحذف.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowConfirmClearModal(false)}
                className="h-11 rounded-xl bg-[#ebe8e2] text-[#1c1c18] font-bold text-xs hover:bg-[#e5e2dc] transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isClearingAll}
                onClick={handleExecuteClearAll}
                className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-75"
              >
                {isClearingAll ? (
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">delete</span>
                )}
                <span>{isClearingAll ? 'جاري المسح...' : 'نعم، مسح الكل'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h2 className="text-base font-black text-[#1c1c18]">مركز التنبيهات ومحاضر الجمعيات</h2>
          <p className="text-[10px] text-[#50453b]">إشعارات مرتبة بالوقت الأحدث ومواعيد الأقساط</p>
        </div>

        <div className="flex items-center gap-2">
          {validUserNotifications.length > 0 && (
            <>
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs text-[#714a23] font-bold hover:underline cursor-pointer"
              >
                تحديد كمقروء
              </button>
              <span className="text-[#d4c3b7]">•</span>
              <button
                type="button"
                disabled={isClearingAll}
                onClick={() => setShowConfirmClearModal(true)}
                className="text-xs text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-sm">delete_sweep</span>
                <span>مسح الكل</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Tabs: New / All / Filter by Circle */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar">
        <button
          type="button"
          onClick={() => setFilterMode('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            filterMode === 'all'
              ? 'bg-[#714a23] text-white shadow-xs'
              : 'bg-white text-[#50453b] border border-[#e5e2dc] hover:bg-[#f6f3ed]'
          }`}
        >
          كافة الإشعارات ({notifications.length})
        </button>

        <button
          type="button"
          onClick={() => setFilterMode('unread')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            filterMode === 'unread'
              ? 'bg-[#714a23] text-white shadow-xs'
              : 'bg-white text-[#50453b] border border-[#e5e2dc] hover:bg-[#f6f3ed]'
          }`}
        >
          الجديدة فقط ({notifications.filter((n) => !n.isRead).length})
        </button>

        {circles.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilterMode(c.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 max-w-[150px] truncate ${
              filterMode === c.id
                ? 'bg-[#714a23] text-white shadow-xs'
                : 'bg-white text-[#50453b] border border-[#e5e2dc] hover:bg-[#f6f3ed]'
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>

      <div className="mb-4"><PhoneNotificationSettings /></div>

      {/* Notifications List */}
      <div className="flex flex-col gap-2.5">
        {filteredNotifications.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-dashed border-[#d4c3b7] text-center flex flex-col items-center justify-center gap-2.5 my-4">
            <div className="w-12 h-12 rounded-full bg-[#f0eee8] flex items-center justify-center text-[#714a23]">
              <span className="material-symbols-outlined text-2xl">notifications_off</span>
            </div>
            <p className="text-xs font-bold text-[#1c1c18]">لا توجد إشعارات حالياً</p>
            <p className="text-[11px] text-[#50453b]">
              سجل الإشعارات نظيف، ستصلك تنبيهات فورية عند إجراء القرعة أو سداد الأقساط.
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isDue = item.type === 'due_reminder';
            const isTurn = item.type === 'turn_alert';
            const isApproved = item.type === 'payment_approved';
            const isLottery = item.type === 'lottery_draw';
            const isReceiptForAdmin =
              item.id.startsWith('notif-payment-') ||
              item.title.includes('بانتظار اعتمادك');

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isReceiptForAdmin && item.circleId && onOpenAdminApprovalsForCircle) {
                    onOpenAdminApprovalsForCircle(item.circleId);
                  } else if (item.circleId) {
                    onSelectCircleById(item.circleId);
                  }
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                  !item.isRead
                    ? 'bg-white border-[#edbf76] shadow-sm ring-1 ring-[#8c6239]/15'
                    : 'bg-[#f6f3ed] border-[#e5e2dc] opacity-90'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      isDue
                        ? 'bg-amber-100 text-amber-800'
                        : isTurn
                        ? 'bg-[#ffdeae] text-[#281900]'
                        : isApproved
                        ? 'bg-emerald-100 text-emerald-800'
                        : isLottery
                        ? 'bg-[#ffdeae] text-[#714a23]'
                        : 'bg-[#ebe8e2] text-[#50453b]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {isDue
                        ? 'hourglass_top'
                        : isTurn
                        ? 'stars'
                        : isApproved
                        ? 'verified'
                        : isLottery
                        ? 'casino'
                        : 'notifications'}
                    </span>
                  </div>

                  <div className="flex flex-col flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3 className="text-xs font-black text-[#1c1c18] truncate">{item.title}</h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-[#50453b] font-medium bg-[#f0eee8] px-2 py-0.5 rounded-md">
                          {formatNotificationTime(getNotificationTimestamp(item), item.time)}
                        </span>
                        {/* Delete Single Notification Button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSingle(item.id, e)}
                          title="حذف هذا الإشعار"
                          disabled={deletingId === item.id}
                          className="w-7 h-7 rounded-lg text-[#50453b] hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-all cursor-pointer"
                        >
                          {deletingId === item.id ? (
                            <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                          ) : (
                            <span className="material-symbols-outlined text-sm">delete</span>
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#50453b] leading-relaxed pl-2">{item.message}</p>

                    {isReceiptForAdmin && item.circleId && (
                      <div className="mt-2.5 pt-2 border-t border-[#f0eee8] flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenAdminApprovalsForCircle && item.circleId) {
                              onOpenAdminApprovalsForCircle(item.circleId);
                            } else {
                              onNavigate('admin-approvals');
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#2D6A4F] hover:bg-[#23533e] text-white text-[11px] font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">fact_check</span>
                          <span>فتح لوحة تعميد الإيصال وعرضه (صورة / PDF) 👑</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Back to Home CTA */}
      <div className="mt-6">
        <button
          onClick={() => onNavigate('home')}
          className="w-full h-11 rounded-xl bg-[#ebe8e2] hover:bg-[#e5e2dc] text-[#50453b] hover:text-[#1c1c18] font-bold text-xs transition-colors cursor-pointer"
        >
          العودة للرئيسية
        </button>
      </div>
    </div>
  );
};
