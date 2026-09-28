import { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { SAVE_NOTIFICATION_EVENT } from '../utils/saveNotifications';

export default function SaveConfirmation() {
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    const onSaved = event => setNotice({ message: event.detail, id: Date.now() });
    window.addEventListener(SAVE_NOTIFICATION_EVENT, onSaved);
    return () => window.removeEventListener(SAVE_NOTIFICATION_EVENT, onSaved);
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  if (!notice) return null;
  return (
    <div role="status" aria-live="polite" className="fixed right-4 top-20 z-[10000] flex max-w-sm items-center gap-3 rounded-xl border border-emerald-500/50 bg-slate-800 px-4 py-3 text-slate-50 shadow-2xl">
      <CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0 text-emerald-400" />
      <span className="text-sm font-semibold">{notice.message}</span>
      <button type="button" aria-label="Chiudi conferma" onClick={() => setNotice(null)} className="ml-2 rounded p-1 text-slate-300 hover:text-white"><X className="h-4 w-4" /></button>
    </div>
  );
}
