import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, CalendarDays, MessageSquareText } from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/marketing-notifiche`;

export default function MarketingNotifications() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(API, { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) return;
        const result = await response.json();
        if (active) setEvents(result);
      } catch { /* Il prossimo controllo riproverà. */ }
    };
    refresh();
    const timer = window.setInterval(refresh, 10000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, []);

  const current = events[0];
  if (!current) return null;

  const confirm = async openAppointment => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API}/${current.id}/letto`, { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Impossibile confermare la lettura. Riprova.');
      setEvents(previous => previous.filter(item => item.id !== current.id));
      if (openAppointment) navigate(`/admin/preventivi?sezione=appuntamenti&appuntamento=${current.appuntamentoId}`);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const isNote = current.tipo === 'nota';
  return <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/80 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="marketing-notification-title" className="w-full max-w-md rounded-2xl border border-indigo-400/50 bg-slate-800 p-6 text-slate-100 shadow-2xl">
      <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-indigo-500/20 p-3 text-indigo-200"><BellRing size={24} /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Avviso Marketing {events.length > 1 && `· ${events.length} da leggere`}</p><h2 id="marketing-notification-title" className="text-xl font-bold">{isNote ? 'Nuova nota da Marketing' : 'Nuovo appuntamento da Marketing'}</h2></div></div>
      <p className="text-lg font-semibold">{current.azienda}</p>
      {isNote && <p className="mt-3 max-h-44 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900/70 p-3 text-sm text-slate-200">{current.testo}</p>}
      <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">{isNote ? <MessageSquareText size={15} /> : <CalendarDays size={15} />}{new Date(current.creataIl).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" disabled={saving} onClick={() => confirm(false)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-600 disabled:opacity-50">Segna come letto</button><button type="button" disabled={saving} onClick={() => confirm(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">Apri appuntamento</button></div>
    </div>
  </div>;
}
