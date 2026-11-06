import { startDeviceNotifications, showAccountNotification, unregisterDevice } from './services/deviceNotifications';
import { isNativeNotificationRecipient } from './services/notificationPolicy';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { useState, useEffect } from 'react';
import {
  ActiveView,
  AppNotification,
  Currency,
  GlobalAppSettings,
  PaymentSubmission,
  SavingsCircle,
  UserProfile,
  isSuperAdminEmail,
  canUserSeeCircle,
  isUserPendingConfirmationInCircle,
  isUserProfileComplete,
  isNotificationForUser,
  sortPaymentsNewestFirst,
} from './types';
import {
  INITIAL_NOTIFICATIONS,
} from './data/mockData';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { PWAInstallModal } from './components/PWAInstallModal';
import { SearchModal } from './components/SearchModal';
import { HomeView } from './views/HomeView';
import { CreateCircleView } from './views/CreateCircleView';
import { JoinCircleView } from './views/JoinCircleView';
import { PaymentView } from './views/PaymentView';
import { CircleDetailView } from './views/CircleDetailView';
import { ProfileView } from './views/ProfileView';
import { NotificationsView } from './views/NotificationsView';
import { AdminPaymentsView } from './views/AdminPaymentsView';
import { SuperAdminView } from './views/SuperAdminView';
import { AuthView } from './views/AuthView';
import {
  auth,
  db,
  logoutUser,
  handleFirestoreError,
  logSystemEvent,
  OperationType,
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
} from 'firebase/firestore';

export default function App() {
  // Start with Google login screen as the primary landing page
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(auth.currentUser);
  });

  const [currentView, setCurrentView] = useState<ActiveView>('home');
  const [selectedCircle, setSelectedCircle] = useState<SavingsCircle | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | 'ALL'>('ALL');
  const [joinInitialCode, setJoinInitialCode] = useState<string>('');

  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [installPlatform, setInstallPlatform] = useState<'ios' | 'android'>('ios');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const deviceUid = isAuthenticated ? auth.currentUser?.uid : undefined;
  const [notificationPreferenceRevision, setNotificationPreferenceRevision] = useState(0);
  useEffect(() => {
    const update = () => setNotificationPreferenceRevision(value => value + 1);
    window.addEventListener('phone-notification-preference-changed', update);
    return () => window.removeEventListener('phone-notification-preference-changed', update);
  }, []);
  useEffect(() => {
    if (!deviceUid) return;
    let stopped = false;
    let cleanup: (() => Promise<void>) | undefined;
    void startDeviceNotifications(deviceUid, () => setCurrentView('notifications')).then(result => {
      if (stopped) void result(); else cleanup = result;
    }).catch(() => {});
    return () => { stopped = true; void cleanup?.(); };
  }, [deviceUid, notificationPreferenceRevision]);

  // Global App Settings controlled by Super Admin
  const [appSettings, setAppSettings] = useState<GlobalAppSettings>({
    id: 'global',
    maintenanceMode: false,
    allowCreateCircles: true,
    allowJoinCircles: true,
    announcementText: '',
    updatedAt: Date.now(),
  });

  // User Profile
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    return {
      id: auth.currentUser?.uid || 'guest',
      fullName: auth.currentUser?.displayName || '',
      email: auth.currentUser?.email || '',
      phone: '',
      operator: '',
      payoutType: 'bank',
      institution: 'kuraimi',
      institutionName: 'بنك الكريمي للتمويل الأصغر الإسلامي (حساب مميز)',
      accountNumber: '',
      beneficiaryName: auth.currentUser?.displayName || '',
      isVerified: false,
      avatar: auth.currentUser?.photoURL || '/assets/aistudio/image_94928b82.png',
    };
  });

  // Circles List - dynamic from Firestore (never pre-populated with public/mock circles)
  const [circles, setCircles] = useState<SavingsCircle[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);

  // Real-time Payment Receipts uploaded by members
  const [payments, setPayments] = useState<PaymentSubmission[]>([]);

  // Online status
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const listener = NativeApp.addListener('backButton', () => {
      if (isSearchOpen) setIsSearchOpen(false);
      else if (isInstallModalOpen) setIsInstallModalOpen(false);
      else if (currentView !== 'home') setCurrentView('home');
      else void NativeApp.exitApp();
    });
    return () => { void listener.then(handle => handle.remove()); };
  }, [currentView, isSearchOpen, isInstallModalOpen]);

  // Global Runtime Error & Unhandled Promise Rejection Logger -> Firestore system_logs
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      logSystemEvent(
        'error',
        'RuntimeException',
        event.message || 'خطأ برمجي غير متوقع في واجهة التطبيق',
        `${event.filename || ''}:${event.lineno || 0}:${event.colno || 0} | ${event.error?.stack || ''}`
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? `${event.reason.message} | ${event.reason.stack || ''}`
          : String(event.reason);
      logSystemEvent('error', 'UnhandledPromiseRejection', 'خطأ في عملية غير متزامنة (Promise)', reason);
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Listen for real Firebase Auth and sync User Profile + Circles in real-time
  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;
    let unsubscribeCircles: (() => void) | null = null;
    let unsubscribeNotifs: (() => void) | null = null;
    let unsubscribePayments: (() => void) | null = null;
    let unsubscribeSettings: (() => void) | null = null;

    let previousDeviceUid: string | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (previousDeviceUid && previousDeviceUid !== user?.uid) await unregisterDevice().catch(() => {});
      previousDeviceUid = user?.uid;
      if (user) {
        setIsAuthenticated(true);
        const userDocRef = doc(db, 'users', user.uid);

        // 1. Listen to real user profile document in Firestore
        unsubscribeUserDoc = onSnapshot(
          userDocRef,
          async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as UserProfile;
              const mergedProfile: UserProfile = {
                ...data,
                id: user.uid,
                fullName: data.fullName || user.displayName || '',
                email: data.email || user.email || '',
                avatar: data.avatar || user.photoURL || '/assets/aistudio/image_94928b82.png',
              };
              setUserProfile(mergedProfile);

              // Mandatory first-time setup ONLY if profile is not yet completed
              if (!isUserProfileComplete(mergedProfile)) {
                setCurrentView('profile');
              }
            } else {
              // Create initial real profile document in Firestore (first time ever)
              const realProfile: UserProfile = {
                id: user.uid,
                fullName: user.displayName || '',
                email: user.email || '',
                phone: '',
                operator: '',
                payoutType: 'bank',
                institution: 'kuraimi',
                institutionName: 'بنك الكريمي للتمويل الأصغر الإسلامي (حساب مميز)',
                accountNumber: '',
                beneficiaryName: user.displayName || '',
                isVerified: false,
                isSuspended: false,
                avatar: user.photoURL || '/assets/aistudio/image_94928b82.png',
              };
              try {
                await setDoc(userDocRef, realProfile);
                setUserProfile(realProfile);
                setCurrentView('profile');
              } catch (err) {
                console.warn('Initial profile create error:', err);
              }
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          }
        );

        // 2. Real-time sync for circles collection (excluding all default/mock circles)
        const circlesCol = collection(db, 'circles');
        const MOCK_CIRCLE_IDS = new Set(['c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6']);
        unsubscribeCircles = onSnapshot(
          circlesCol,
          (snapshot) => {
            const remoteCircles: SavingsCircle[] = [];
            snapshot.forEach((docItem) => {
              const data = docItem.data() as SavingsCircle;
              if (data && !MOCK_CIRCLE_IDS.has(data.id) && !data.id.startsWith('c-')) {
                remoteCircles.push(data);
              }
            });
            setCircles(remoteCircles);
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, 'circles');
          }
        );

        // 3. Real-time sync for notifications with strict role-based separation
        const notifsCol = collection(db, 'notifications');
        let hasNotificationsSnapshot = false;
        unsubscribeNotifs = onSnapshot(
          notifsCol,
          (snapshot) => {
            const remoteNotifs: AppNotification[] = [];
            // Managed circle IDs for the current user (where current user is organizer)
            const myManagedCircleIds = new Set(
              circles
                .filter(
                  (c) =>
                    c.creatorId === user.uid ||
                    c.organizer?.creatorId === user.uid ||
                    (user.email && c.creatorEmail?.trim().toLowerCase() === user.email.trim().toLowerCase())
                )
                .map((c) => c.id)
            );

            if (hasNotificationsSnapshot && !snapshot.metadata.fromCache) {
              for (const change of snapshot.docChanges()) {
                if (change.type !== 'added' || change.doc.metadata.hasPendingWrites) continue;
                const notification = { ...change.doc.data(), id: change.doc.id } as AppNotification;
                if (isNativeNotificationRecipient(notification, user.uid, user.email, myManagedCircleIds)) {
                  void showAccountNotification(notification).catch(() => {});
                }
              }
            }
            if (!snapshot.metadata.fromCache) hasNotificationsSnapshot = true;

            snapshot.forEach((docItem) => {
              const data = docItem.data() as AppNotification;
              if (data && isNotificationForUser(data, user.uid, user.email, myManagedCircleIds)) {
                remoteNotifs.push({
                  ...data,
                  id: docItem.id,
                });
              }
            });
            if (remoteNotifs.length > 0) {
              setNotifications((prev) => {
                const map = new Map(remoteNotifs.map((n) => [n.id, n]));
                const remaining = prev.filter(
                  (p) =>
                    !map.has(p.id) &&
                    !p.id.startsWith('n-mock') &&
                    isNotificationForUser(p, user.uid, user.email, myManagedCircleIds)
                );
                return [...remoteNotifs, ...remaining];
              });
            } else {
              setNotifications([]);
            }
          },
          (error) => {
            console.warn('Notifications real-time sync warning:', error);
          }
        );

        // 4. Real-time sync for uploaded payment receipts
        const paymentsCol = collection(db, 'payments');
        unsubscribePayments = onSnapshot(
          paymentsCol,
          (snapshot) => {
            const remotePayments: PaymentSubmission[] = [];
            snapshot.forEach((docItem) => {
              const data = docItem.data() as PaymentSubmission;
              if (data) {
                remotePayments.push(data);
              }
            });
            setPayments(sortPaymentsNewestFirst(remotePayments));
          },
          (error) => {
            console.warn('Payments real-time sync warning:', error);
          }
        );

        // 5. Real-time sync for Global App Settings
        unsubscribeSettings = onSnapshot(
          doc(db, 'app_settings', 'global'),
          (snapshot) => {
            if (snapshot.exists()) {
              setAppSettings(snapshot.data() as GlobalAppSettings);
            }
          },
          () => {}
        );
      } else {
        setIsAuthenticated(false);
        if (unsubscribeUserDoc) {
          unsubscribeUserDoc();
          unsubscribeUserDoc = null;
        }
        if (unsubscribeCircles) {
          unsubscribeCircles();
          unsubscribeCircles = null;
        }
        if (unsubscribeNotifs) {
          unsubscribeNotifs();
          unsubscribeNotifs = null;
        }
        if (unsubscribePayments) {
          unsubscribePayments();
          unsubscribePayments = null;
        }
        if (unsubscribeSettings) {
          unsubscribeSettings();
          unsubscribeSettings = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      if (unsubscribeCircles) unsubscribeCircles();
      if (unsubscribeNotifs) unsubscribeNotifs();
      if (unsubscribePayments) unsubscribePayments();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  }, []);

  // Keep selectedCircle synced with real-time Firestore updates
  useEffect(() => {
    if (selectedCircle) {
      const updated = circles.find((c) => c.id === selectedCircle.id);
      if (updated) {
        setSelectedCircle(updated);
      }
    }
  }, [circles]);

  const currentUid = userProfile.id !== 'guest' ? userProfile.id : auth.currentUser?.uid;
  const currentEmail = userProfile.email || auth.currentUser?.email;
  const isSuperAdmin = isSuperAdminEmail(currentEmail);

  // Strictly filter circles for user-facing screens:
  // Only circles created by the user OR circles joined via code AND confirmed by the organizer
  const myVisibleCircles = circles.filter((c) =>
    canUserSeeCircle(c, currentUid, currentEmail)
  );

  // Count of circles where the user joined via code and is waiting for organizer confirmation
  const pendingConfirmationCount = circles.filter((c) =>
    isUserPendingConfirmationInCircle(c, currentUid, currentEmail)
  ).length;

  // Handlers
  const handleOpenInstall = (platform?: 'ios' | 'android') => {
    if (platform) setInstallPlatform(platform);
    setIsInstallModalOpen(true);
  };

  const handleNavigate = (view: ActiveView) => {
    // Enforce mandatory first-time profile setup before navigating to other tabs
    if (!isUserProfileComplete(userProfile) && view !== 'profile') {
      if (isSuperAdmin && view === 'super-admin') {
        setCurrentView(view);
        return;
      }
      setToastMessage('يرجى إكمال وحفظ بيانات حسابك أولاً (خطوة إجبارية لأول مرة فقط)');
      setCurrentView('profile');
      return;
    }

    if (!isSuperAdmin) {
      if (view === 'create-circle' && !appSettings.allowCreateCircles) {
        setToastMessage('عذراً، إنشاء جمعيات جديدة متوقف مؤقتاً من قِبل إدارة التطبيق.');
        return;
      }
      if (view === 'join-circle' && !appSettings.allowJoinCircles) {
        setToastMessage('عذراً، الانضمام للجمعيات متوقف مؤقتاً من قِبل إدارة التطبيق.');
        return;
      }
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCircle = (circle: SavingsCircle) => {
    setSelectedCircle(circle);
    setCurrentView('circle-detail');
  };

  const handlePayDue = (circle: SavingsCircle) => {
    setSelectedCircle(circle);
    setCurrentView('payment');
  };

  const handlePaymentSubmitted = async (submission: PaymentSubmission) => {
    setPayments((prev) =>
      sortPaymentsNewestFirst([submission, ...prev.filter((p) => p.id !== submission.id)])
    );
    // Update ONLY the target circle in state
    setCircles((prev) =>
      prev.map((c) =>
        c.id === submission.circleId
          ? {
              ...c,
              myPaymentStatus: 'under_review',
              daysLeftForPayment: undefined,
            }
          : c
      )
    );

    setToastMessage(`تم إرسال إيصال السداد (${submission.trxId}) لجمعية "${submission.circleTitle}" بنجاح!`);
  };

  const handleCircleCreated = async (newCircle: SavingsCircle) => {
    setCircles((prev) => [newCircle, ...prev]);

    // Save circle to Firestore
    try {
      await setDoc(doc(db, 'circles', newCircle.id), newCircle);
      await logSystemEvent(
        'info',
        'CircleCreated',
        `تم إنشاء جمعية جديدة "${newCircle.title}" (${newCircle.code})`,
        `المنظم: ${newCircle.organizer?.name || ''}`
      );
    } catch (err) {
      console.warn('Firestore circle save warning:', err);
    }

    const newNotif: AppNotification = {
      id: `n-${Date.now()}`,
      title: 'تم إنشاء جمعيتك بنجاح! 🎉',
      message: `تم تفعيل رمز الدعوة [ ${newCircle.code} ] لجمعية "${newCircle.title}". شارك الكود مع الأهل والأصدقاء للانضمام.`,
      time: 'الآن',
      type: 'system',
      isRead: false,
      circleId: newCircle.id,
    };

    setNotifications((prev) => [newNotif, ...prev]);
    setToastMessage(`تم إنشاء جمعية "${newCircle.title}" بنجاح!`);
  };

  const handleCircleUpdated = async (updatedCircle: SavingsCircle) => {
    setCircles((prev) => prev.map((c) => (c.id === updatedCircle.id ? updatedCircle : c)));
    if (selectedCircle?.id === updatedCircle.id) {
      setSelectedCircle(updatedCircle);
    }

    try {
      await setDoc(doc(db, 'circles', updatedCircle.id), updatedCircle, { merge: true });
    } catch (err) {
      console.warn('Firestore circle update warning:', err);
    }

    const currentUid = auth.currentUser?.uid;
    const currentEmail = auth.currentUser?.email;

    // Notify other members of the update (do NOT notify the organizer who edited it)
    (updatedCircle.members || []).forEach(async (m) => {
      const isOrganizer =
        (currentUid && m.id === currentUid) ||
        (currentEmail && m.email && m.email.toLowerCase() === currentEmail.toLowerCase());
      if (isOrganizer) return;

      const memberNotif: AppNotification = {
        id: `notif-edit-${updatedCircle.id}-${m.id}-${Date.now()}`,
        userId: m.id,
        userEmail: m.email,
        senderId: currentUid,
        targetRole: 'member',
        title: 'تم تعديل بيانات الجمعية ✏️',
        message: `تم تحديث تفاصيل جمعية "${updatedCircle.title}" بنجاح وتعديل الأقساط والمواعيد من قِبل المنظم.`,
        time: 'الآن',
        type: 'system',
        isRead: false,
        circleId: updatedCircle.id,
        createdAt: Date.now(),
      };
      try {
        const cleanObj = Object.fromEntries(
          Object.entries(memberNotif).filter(([_, v]) => v !== undefined)
        );
        await setDoc(doc(db, 'notifications', memberNotif.id), cleanObj);
      } catch {}
    });

    setToastMessage(`تم حفظ وتحديث جمعية "${updatedCircle.title}" بنجاح!`);
  };

  const handleCircleJoined = async (joinedCircle: SavingsCircle, selectedTurn: number) => {
    const updated: SavingsCircle = {
      ...joinedCircle,
      myTurnNumber: selectedTurn,
    };

    setCircles((prev) => {
      const exists = prev.some((c) => c.id === updated.id);
      if (exists) {
        return prev.map((c) => (c.id === updated.id ? updated : c));
      }
      return [updated, ...prev];
    });

    if (selectedCircle?.id === updated.id) {
      setSelectedCircle(updated);
    }

    try {
      await setDoc(doc(db, 'circles', updated.id), updated, { merge: true });
    } catch (err) {
      console.warn('Firestore join save warning:', err);
    }

    const newNotif: AppNotification = {
      id: `n-${Date.now()}`,
      title: 'انضممت لجمعية بنجاح 🌟',
      message: `تم تأكيد مقعدك في "${joinedCircle.title}". سيبدأ تذكيرك بمواعيد الأقساط وجدول الأدوار بدقة.`,
      time: 'الآن',
      type: 'turn_alert',
      isRead: false,
      circleId: joinedCircle.id,
    };

    setNotifications((prev) => [newNotif, ...prev]);
    setToastMessage(`مبارك! تم انضمامك لـ "${joinedCircle.title}"`);
  };

  const handleCircleDeleted = async (circleId: string) => {
    setCircles((prev) => prev.filter((c) => c.id !== circleId));
    if (selectedCircle?.id === circleId) {
      setSelectedCircle(null);
    }

    try {
      await deleteDoc(doc(db, 'circles', circleId));
      await logSystemEvent('warning', 'CircleDeleted', `تم حذف الجمعية (${circleId}) من قاعدة البيانات`);
    } catch (err) {
      console.warn('Firestore circle delete warning:', err);
    }

    const newNotif: AppNotification = {
      id: `n-${Date.now()}`,
      title: 'تم حذف الجمعية 🗑️',
      message: 'تم حذف الجمعية بنجاح من قاعدة البيانات وإلغاؤها.',
      time: 'الآن',
      type: 'system',
      isRead: false,
    };

    setNotifications((prev) => [newNotif, ...prev]);
    setToastMessage('تم حذف الجمعية بنجاح من قاعدة البيانات.');
    setCurrentView('home');
  };

  const handleMarkAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setToastMessage('تم تحديد كافة الإشعارات كمقروءة');
  };

  const handleClearAllNotifications = async () => {
    const toDelete = [...notifications];
    setNotifications([]);
    try {
      const deletePromises = toDelete.map((n) =>
        deleteDoc(doc(db, 'notifications', n.id)).catch(() => {})
      );
      await Promise.allSettled(deletePromises);
    } catch (err) {
      console.warn('Error clearing all notifications from Firestore:', err);
    }
    setToastMessage('تم مسح وتنظيف كافة الإشعارات بنجاح ✓');
  };

  const handleSignOut = async () => {
    try {
      await unregisterDevice().catch(() => {});
      await logoutUser();
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setCurrentView('home');
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getScreenTitle = () => {
    switch (currentView) {
      case 'create-circle':
        return 'إنشاء جمعية جديدة';
      case 'join-circle':
        return 'الانضمام لجمعية ادخار';
      case 'payment':
        return 'دفع القسط الشهري';
      case 'circle-detail':
        return selectedCircle?.title || 'تفاصيل الجمعية';
      case 'profile':
        return 'الإعدادات';
      case 'notifications':
        return 'مركز الإشعارات';
      case 'my-circles':
        return 'جمعياتي المشترك فيها';
      case 'admin-approvals':
        return 'لوحة تعميد واعتماد الأقساط';
      case 'super-admin':
        return 'لوحة تحكم الأدمن العام';
      default:
        return 'الرئيسية';
    }
  };

  return (
    <div className="app-shell bg-[#fcf9f3] text-[#1c1c18] flex justify-center antialiased selection:bg-[#ffdcbf] selection:text-[#2d1600]">
      {/* Seamless full mobile container for all phones */}
      <div className="app-frame bg-[#fcf9f3] flex flex-col relative shadow-sm">
        {/* Offline Alert if network drops */}
        {!isOnline && (
          <div className="bg-[#ba1a1a] text-white text-[11px] font-bold py-1.5 px-3 text-center shadow-sm flex items-center justify-center gap-1.5 z-50">
            <span className="material-symbols-outlined text-sm">wifi_off</span>
            <span>أنت تعمل حالياً في وضع عدم الاتصال (يتم حفظ بياناتك محلياً بأمان)</span>
          </div>
        )}

        {/* Global Announcement Banner from Super Admin */}
        {isAuthenticated && appSettings.announcementText && (
          <div className="bg-gradient-to-l from-[#894d0d] to-[#6d3a00] text-white text-[11px] font-bold py-2 px-3 text-center shadow-sm flex items-center justify-center gap-1.5 z-40">
            <span className="material-symbols-outlined text-sm text-[#ffdcbf]">campaign</span>
            <span>{appSettings.announcementText}</span>
          </div>
        )}

        {!isAuthenticated ? (
          /* Primary Landing View: Google Sign-in as requested by the user */
          <AuthView
            userProfile={userProfile}
            onLoginSuccess={async (updates) => {
              const loggedInEmail = updates?.email || auth.currentUser?.email || userProfile.email;
              let alreadyCompleted = false;

              if (auth.currentUser) {
                try {
                  const userRef = doc(db, 'users', auth.currentUser.uid);
                  const existingSnap = await getDoc(userRef);

                  if (existingSnap.exists()) {
                    const existingData = existingSnap.data() as UserProfile;
                    alreadyCompleted = isUserProfileComplete(existingData);
                    const merged: UserProfile = {
                      ...existingData,
                      id: auth.currentUser.uid,
                      email: existingData.email || loggedInEmail || '',
                      fullName: existingData.fullName || updates?.fullName || auth.currentUser.displayName || '',
                      avatar: existingData.avatar || updates?.avatar || auth.currentUser.photoURL || '/assets/aistudio/image_94928b82.png',
                    };
                    setUserProfile(merged);
                    await setDoc(userRef, merged, { merge: true });
                  } else if (updates) {
                    setUserProfile((prev) => ({ ...prev, ...updates }));
                  }
                } catch (e) {
                  console.warn('Check existing user profile notice:', e);
                }
              }

              setIsAuthenticated(true);
              if (!alreadyCompleted) {
                // First time ever entering the app -> Mandatory profile completion
                setCurrentView('profile');
                setToastMessage('مرحباً بك لأول مرة! يرجى إكمال وحفظ بيانات حسابك للمتابعة');
              } else {
                // Profile already saved 100% -> Go directly to Home
                setCurrentView('home');
                setToastMessage(
                  isSuperAdminEmail(loggedInEmail)
                    ? 'مرحباً بعودتك! يمكنك الوصول للوحة التحكم من صفحة الإعدادات 👑'
                    : 'مرحباً بعودتك! حسابك محفوظ وموثق ١٠٠% ✓'
                );
              }
            }}
          />
        ) : userProfile.isSuspended && !isSuperAdmin ? (
          /* Suspended Account Lock Screen */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#fcf9f3]">
            <div className="w-20 h-20 rounded-full bg-[#ba1a1a]/10 border-2 border-[#ba1a1a]/30 flex items-center justify-center text-[#ba1a1a] mb-4">
              <span className="material-symbols-outlined text-4xl">block</span>
            </div>
            <h2 className="text-xl font-black text-[#1c1c18] mb-2">تم إيقاف حسابك</h2>
            <p className="text-xs text-[#50443b] leading-relaxed mb-4 max-w-xs">
              تم إيقاف هذا الحساب من قِبل إدارة تطبيق هيا نجمعها.
            </p>
            {userProfile.suspendedReason && (
              <div className="w-full bg-[#ffdad6]/50 border border-[#ba1a1a]/30 rounded-xl p-3 mb-6 text-right">
                <p className="text-[10px] font-bold text-[#ba1a1a] mb-1">سبب الإيقاف المسجل:</p>
                <p className="text-xs font-bold text-[#1c1c18]">{userProfile.suspendedReason}</p>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="w-full py-3.5 rounded-xl bg-[#1c1c18] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        ) : appSettings.maintenanceMode && !isSuperAdmin ? (
          /* Global Maintenance Mode Lock Screen for Non-Admins */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#fcf9f3]">
            <div className="w-20 h-20 rounded-full bg-[#894d0d]/10 border-2 border-[#894d0d]/30 flex items-center justify-center text-[#894d0d] mb-4">
              <span className="material-symbols-outlined text-4xl">build_circle</span>
            </div>
            <h2 className="text-xl font-black text-[#1c1c18] mb-2">التطبيق في وضع الصيانة والتحديث</h2>
            <p className="text-xs text-[#50443b] leading-relaxed mb-6 max-w-xs">
              نقوم حالياً بإجراء تحديثات مجدولة على قاعدة البيانات لضمان أعلى مستوى من الأمان. سيعود التطبيق للعمل قريباً.
            </p>
            <button
              onClick={handleSignOut}
              className="px-6 py-3 rounded-xl bg-[#f0ede7] text-[#1c1c18] font-bold text-xs"
            >
              تسجيل الخروج
            </button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-w-0 bg-[#fcf9f3] relative">
            {/* Header */}
            <Header
              currentView={currentView}
              onNavigate={handleNavigate}
              userProfile={userProfile}
              onOpenSearch={() => setIsSearchOpen(true)}
              title={getScreenTitle()}
            />

            {/* Active Screen View */}
            <main className="app-content flex-1 w-full min-w-0 flex flex-col">
              {currentView === 'home' && (
                <HomeView
                  circles={myVisibleCircles}
                  pendingConfirmationCount={pendingConfirmationCount}
                  payments={payments}
                  userProfile={userProfile}
                  onNavigate={handleNavigate}
                  onSelectCircle={handleSelectCircle}
                  onPayDue={handlePayDue}
                  onOpenAdminApprovals={(circle) => {
                    if (circle) setSelectedCircle(circle);
                    handleNavigate('admin-approvals');
                  }}
                  selectedCurrency={selectedCurrency}
                  onSelectCurrency={setSelectedCurrency}
                  toastMessage={toastMessage}
                  onDismissToast={() => setToastMessage(null)}
                />
              )}

              {currentView === 'my-circles' && (
                <HomeView
                  circles={myVisibleCircles}
                  pendingConfirmationCount={pendingConfirmationCount}
                  payments={payments}
                  userProfile={userProfile}
                  onNavigate={handleNavigate}
                  onSelectCircle={handleSelectCircle}
                  onPayDue={handlePayDue}
                  onOpenAdminApprovals={(circle) => {
                    if (circle) setSelectedCircle(circle);
                    handleNavigate('admin-approvals');
                  }}
                  selectedCurrency={selectedCurrency}
                  onSelectCurrency={setSelectedCurrency}
                  toastMessage={toastMessage}
                  onDismissToast={() => setToastMessage(null)}
                />
              )}

              {currentView === 'create-circle' && (
                <CreateCircleView
                  userProfile={userProfile}
                  onCircleCreated={handleCircleCreated}
                  onNavigate={handleNavigate}
                />
              )}

              {currentView === 'join-circle' && (
                <JoinCircleView
                  initialCode={joinInitialCode}
                  onCircleJoined={handleCircleJoined}
                  onNavigate={handleNavigate}
                  userProfile={userProfile}
                  circles={circles}
                />
              )}

              {currentView === 'payment' && (
                <PaymentView
                  circle={selectedCircle || myVisibleCircles[0]}
                  payments={payments}
                  userProfile={userProfile}
                  onPaymentSubmitted={handlePaymentSubmitted}
                  onNavigate={handleNavigate}
                />
              )}

              {currentView === 'circle-detail' && (
                <CircleDetailView
                  circle={selectedCircle || myVisibleCircles[0]}
                  payments={payments}
                  userProfile={userProfile}
                  onNavigate={handleNavigate}
                  onPayDue={handlePayDue}
                  onUpdateCircle={handleCircleUpdated}
                  onDeleteCircle={handleCircleDeleted}
                />
              )}

              {currentView === 'profile' && (
                <ProfileView
                  userProfile={userProfile}
                  onUpdateProfile={async (updated) => {
                    setUserProfile(updated);
                    if (auth.currentUser) {
                      try {
                        await setDoc(doc(db, 'users', auth.currentUser.uid), updated, { merge: true });
                      } catch (err) {
                        handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}`);
                      }
                    }
                    setToastMessage('تم حفظ ملفك الشخصي والبنكي بنجاح!');
                  }}
                  onNavigate={handleNavigate}
                  onSignOut={handleSignOut}
                />
              )}

              {currentView === 'notifications' && (
                <NotificationsView
                  notifications={notifications}
                  onMarkAllRead={handleMarkAllNotifsRead}
                  onNavigate={handleNavigate}
                  onSelectCircleById={(id) => {
                    const target = myVisibleCircles.find((c) => c.id === id);
                    if (target) {
                      handleSelectCircle(target);
                    } else {
                      setToastMessage('هذه الجمعية لم يتم تعميدك فيها بعد من قِبل المنظم.');
                    }
                  }}
                  onOpenAdminApprovalsForCircle={(circleId) => {
                    const target = myVisibleCircles.find((c) => c.id === circleId);
                    if (target) setSelectedCircle(target);
                    handleNavigate('admin-approvals');
                  }}
                  circles={myVisibleCircles}
                  onDeleteNotification={(id) =>
                    setNotifications((prev) => prev.filter((n) => n.id !== id))
                  }
                  onClearAllNotifications={handleClearAllNotifications}
                />
              )}

              {currentView === 'admin-approvals' && (
                <AdminPaymentsView
                  circles={circles}
                  userProfile={userProfile}
                  selectedCircle={selectedCircle}
                  onNavigate={handleNavigate}
                  onUpdateCircle={handleCircleUpdated}
                  payments={payments}
                  notifications={notifications}
                />
              )}

              {currentView === 'super-admin' && (
                <SuperAdminView
                  circles={circles}
                  payments={payments}
                  notifications={notifications}
                  userProfile={userProfile}
                  onNavigate={handleNavigate}
                  onSelectCircle={handleSelectCircle}
                  onCircleDeletedFromDB={(id) =>
                    setCircles((prev) => prev.filter((c) => c.id !== id))
                  }
                />
              )}
            </main>

            {/* Bottom Tabs - Hidden ONLY during mandatory first-time profile setup */}
            {(currentView !== 'profile' || isUserProfileComplete(userProfile)) && (
              <BottomNav
                currentView={currentView}
                onNavigate={handleNavigate}
                unreadCount={unreadCount}
                userEmail={userProfile.email || auth.currentUser?.email || ''}
              />
            )}
          </div>
        )}

        {/* PWA Install Modal for Android & iPhone */}
        <PWAInstallModal
          isOpen={isInstallModalOpen}
          onClose={() => setIsInstallModalOpen(false)}
          defaultPlatform={installPlatform}
        />

        {/* Instant Search & Lookup Modal (Only searches user's own confirmed circles) */}
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          circles={myVisibleCircles}
          onSelectCircle={handleSelectCircle}
          onOpenJoinCircle={(code) => {
            if (code) setJoinInitialCode(code);
            handleNavigate('join-circle');
          }}
        />
      </div>
    </div>
  );
}

