import { useEffect, useState } from 'react';
import { disablePhoneNotifications, enablePhoneNotifications, notificationStatus, testPhoneNotification } from '../services/deviceNotifications';

export function PhoneNotificationSettings() {
  const [status, setStatus] = useState({ available: false, granted: false, enabled: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pushError, setPushError] = useState('');
  useEffect(() => {
    const update = () => { void notificationStatus().then(setStatus).catch(() => {}); setPushError(localStorage.getItem('haya:push-error') || ''); };
    update(); window.addEventListener('phone-notifications-changed', update);
    return () => window.removeEventListener('phone-notifications-changed', update);
  }, []);
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage('');
    try { await action(); setStatus(await notificationStatus()); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر تغيير إعداد الإشعارات.'); }
    finally { setBusy(false); }
  }
  return <section className="bg-white rounded-2xl p-4 border border-[#e5e2dc] flex flex-col gap-3" aria-label="إشعارات الهاتف">
    <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#714a23]">notifications_active</span><div className="min-w-0"><h3 className="text-sm font-bold">إشعارات الهاتف</h3><p className="text-xs text-[#50453b] mt-1">عرض تنبيهات الحساب في لوحة إشعارات جوالك</p></div></div>
    {!status.available ? <p className="text-xs text-[#50453b]">هذه الميزة متاحة من تطبيق Android. تبقى تنبيهات حسابك متاحة داخل التطبيق.</p> : <>
      <p className="text-xs">{status.granted && status.enabled ? 'مسموح بإشعارات الهاتف' : 'إشعارات الهاتف غير مفعّلة'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => run(status.enabled && status.granted ? disablePhoneNotifications : enablePhoneNotifications, status.enabled && status.granted ? 'تم إيقاف إشعارات الهاتف.' : 'تم السماح بإشعارات الهاتف. جرّب إرسال إشعار.')} className="min-h-11 rounded-xl px-4 bg-[#714a23] text-white text-xs font-bold disabled:opacity-50">{busy ? 'جارٍ التنفيذ…' : status.enabled && status.granted ? 'إيقاف الإشعارات' : 'تفعيل إشعارات الهاتف'}</button>
        {status.enabled && status.granted && <button type="button" disabled={busy} onClick={() => run(testPhoneNotification, 'سيظهر إشعار تجريبي في لوحة الهاتف.')} className="min-h-11 rounded-xl px-4 bg-[#f0ede7] text-xs font-bold disabled:opacity-50">إرسال إشعار تجريبي</button>}
      </div>
      {pushError && <p role="status" className="text-xs text-amber-800">{pushError}</p>}
    </>}
    {message && <p role="status" className="text-xs leading-relaxed">{message}</p>}
  </section>;
}
