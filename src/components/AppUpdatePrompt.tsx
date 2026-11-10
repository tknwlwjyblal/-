import { useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { AppUpdater, requestUpdateCheck, supportsAppUpdates, type UpdateInfo } from '../services/appUpdater';

type Phase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'permission' | 'installing' | 'installer' | 'current' | 'error';

export function CheckForUpdatesButton() {
  if (!supportsAppUpdates()) return null;
  return <button type="button" onClick={requestUpdateCheck} className="w-full min-h-12 rounded-xl border border-[#e5d9c8] bg-white px-4 text-xs font-semibold text-[#714a23] flex items-center justify-between gap-2"><span>التحقق من تحديث التطبيق</span><span className="material-symbols-outlined text-xl">system_update</span></button>;
}

export function AppUpdatePrompt() {
  const [open, setOpenState] = useState(false);
  const openRef = useRef(false);
  const dismissed = useRef(0);
  function setOpen(value: boolean) { openRef.current = value; setOpenState(value); }
  function close() { dismissed.current++; setOpen(false); }
  const [phase, setPhase] = useState<Phase>('idle');
  const [update, setUpdate] = useState<UpdateInfo>();
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');
  const phaseRef = useRef<Phase>('idle');
  const lastChecked = useRef(0);
  const setState = (next: Phase) => { phaseRef.current = next; setPhase(next); };

  useEffect(() => {
    if (!supportsAppUpdates()) return;
    let disposed = false;
    const listeners: PluginListenerHandle[] = [];
    async function check(manual = false) {
      if (['downloading','ready','permission','installing','installer'].includes(phaseRef.current)) { if (manual) setOpen(true); return; }
      if (!manual && openRef.current) return;
      if (phaseRef.current === 'checking') { if (manual) setOpen(true); return; }
      if (!manual && Date.now() - lastChecked.current < 15 * 60 * 1000) return;
      const generation = dismissed.current;
      lastChecked.current = Date.now(); setState('checking'); setError('');
      if (manual) setOpen(true);
      try {
        const info = await AppUpdater.checkForUpdate();
        if (disposed) return;
        setUpdate(info);
        if (info.available) { setState('available'); if (generation === dismissed.current) setOpen(true); }
        else { setState('current'); if (manual && generation === dismissed.current) setOpen(true); }
      } catch {
        if (disposed) return;
        setState('error'); setError('تعذر فحص التحديثات. تأكد من اتصالك بالإنترنت وحاول مجددًا.');
        if (manual && generation === dismissed.current) setOpen(true);
      }
    }
    const manual = () => { void check(true); };
    window.addEventListener('check-for-app-update', manual);
    window.addEventListener('dismiss-app-update', close);
    const timer = window.setTimeout(() => { void check(); }, 1500);
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void check(); }, 15 * 60 * 1000);
    void AppUpdater.addListener('downloadProgress', progress => {
      if (!disposed && progress.total > 0) setPercent(Math.max(0, Math.min(100, Math.floor(progress.bytes / progress.total * 100))));
    }).then(handle => { if (disposed) void handle.remove(); else listeners.push(handle); }).catch(() => {});
    void App.addListener('appStateChange', state => { if (state.isActive) void check(); }).then(handle => { if (disposed) void handle.remove(); else listeners.push(handle); }).catch(() => {});
    return () => { disposed = true; clearTimeout(timer); clearInterval(interval); window.removeEventListener('check-for-app-update', manual); window.removeEventListener('dismiss-app-update', close); for (const handle of listeners) void handle.remove(); };
  }, []);

  async function download() {
    if (!update || phaseRef.current === 'downloading') return;
    setPercent(0); setError(''); setState('downloading');
    try { await AppUpdater.downloadUpdate({ versionCode: update.versionCode }); setState('ready'); }
    catch { setState('available'); setError('تعذر تنزيل التحديث أو التحقق من سلامته. لم يبدأ التثبيت. أعد المحاولة.'); }
  }
  async function install() {
    if (phaseRef.current === 'installing') return;
    setError(''); setState('installing');
    try { const result = await AppUpdater.installUpdate(); setState(result.status === 'permission_required' ? 'permission' : 'installer'); }
    catch { setState('available'); setError('تعذر تجهيز الملف للتثبيت. أعد تنزيل التحديث وحاول مجددًا.'); }
  }
  async function settings() {
    try { await AppUpdater.openInstallSettings(); }
    catch { setError('افتح إعدادات الهاتف ثم اسمح لهيا نجمعها بتثبيت التطبيقات.'); }
  }
  function retry() { setState('idle'); window.setTimeout(requestUpdateCheck, 0); }

  if (!open || !supportsAppUpdates()) return null;
  const downloadable = phase === 'available';
  const installable = ['ready','permission','installer'].includes(phase);
  return <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="app-update-title" data-app-update-dialog className="app-update-dialog w-full max-w-sm rounded-3xl bg-[#fcf9f3] border border-[#e5d9c8] shadow-2xl p-5 text-right" dir="rtl">
      <div className="flex justify-between items-center gap-2"><span className="material-symbols-outlined w-11 h-11 rounded-2xl bg-[#eee3d2] text-[#714a23] flex items-center justify-center text-2xl">system_update</span><button type="button" onClick={close} aria-label="إغلاق نافذة التحديث" className="w-10 h-10 rounded-full flex items-center justify-center text-[#8b7c69]"><span className="material-symbols-outlined text-xl">close</span></button></div>
      <h2 id="app-update-title" className="text-base font-bold mt-4">{phase === 'checking' ? 'جارٍ فحص التحديثات' : phase === 'current' ? 'تطبيقك محدّث' : phase === 'error' ? 'تعذر فحص التحديث' : 'لديك تحديث جديد للتطبيق'}</h2>
      {update && phase !== 'error' && phase !== 'checking' && <p className="text-xs text-[#8b7c69] mt-2">الإصدار {update.versionName}{update.available ? ` · ${(update.sizeBytes / 1024 / 1024).toFixed(1)} ميجابايت` : ''}</p>}
      {update?.available && <p className="text-xs leading-7 text-[#625443] mt-3 whitespace-pre-line">{update.notes}</p>}
      {phase === 'checking' && <p role="status" className="text-xs text-[#8b7c69] my-4">يرجى الانتظار…</p>}
      {phase === 'downloading' && <div className="my-4"><div role="progressbar" aria-label="تنزيل التحديث" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-2 rounded-full overflow-hidden bg-[#e9dfd1]"><div className="h-full bg-[#714a23] transition-all" style={{width:`${percent}%`}} /></div><p role="status" className="text-xs text-[#8b7c69] mt-2">جارٍ التنزيل… {percent}%</p></div>}
      {phase === 'ready' && <p className="text-xs leading-6 mt-3 text-[#2D6A4F]">اكتمل التنزيل والتحقق. اضغط تثبيت للمتابعة في نافذة Android.</p>}
      {phase === 'permission' && <p className="text-xs leading-6 mt-3 text-[#8b6335]">اسمح لهيا نجمعها بتثبيت التطبيقات من إعدادات الهاتف، ثم ارجع واضغط «تثبيت التحديث».</p>}
      {phase === 'installer' && <p role="status" className="text-xs leading-6 mt-3 text-[#625443]">فُتحت نافذة Android. أكمل التثبيت منها؛ يمكنك فتحها مجددًا إذا أغلقتها.</p>}
      {error && <p role="alert" className="text-xs leading-6 text-[#9b392a] mt-3">{error}</p>}
      <div className="flex flex-col gap-2 mt-5">
        {downloadable && <button type="button" onClick={download} className="min-h-12 rounded-xl bg-[#714a23] text-white font-bold text-sm">تحديث الآن</button>}
        {phase === 'permission' && <button type="button" onClick={settings} className="min-h-11 rounded-xl bg-[#eee3d2] text-[#714a23] font-bold text-xs">السماح بالتثبيت</button>}
        {installable && <button type="button" onClick={install} className="min-h-12 rounded-xl bg-[#714a23] text-white font-bold text-sm">{phase === 'installer' ? 'فتح نافذة التثبيت مجددًا' : 'تثبيت التحديث'}</button>}
        {phase === 'installing' && <p role="status" className="text-xs">جارٍ فتح نافذة التثبيت…</p>}
        {phase === 'error' && <button type="button" onClick={retry} className="min-h-11 rounded-xl bg-[#714a23] text-white font-semibold text-xs">إعادة الفحص</button>}
        <button type="button" onClick={close} className="min-h-10 text-xs text-[#8b7c69]">{['current','error','installer'].includes(phase) ? 'إغلاق' : 'لاحقًا'}</button>
      </div>
    </section>
  </div>;
}
