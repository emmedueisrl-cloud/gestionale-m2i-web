import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, FileUp, RefreshCw } from 'lucide-react';

const initialForm = { dataOra: '', nominativo: '', incaricato: '', luogo: '', note: '' };
const API = import.meta.env.VITE_API_URL || '';

async function caricaAppuntamenti(token) {
  const response = await fetch(`${API}/api/public/appuntamenti/${token}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 404 ? 'Questo link non è valido.' : 'Impossibile caricare gli appuntamenti.');
  return response.json();
}

export default function InserisciAppuntamentoPubblico() {
  const { token } = useParams();
  const [linkValido, setLinkValido] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [scheda, setScheda] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [appuntamenti, setAppuntamenti] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [listError, setListError] = useState('');

  useEffect(() => {
    let active = true;
    caricaAppuntamenti(token)
      .then(result => { if (active) { setLinkValido(true); setAppuntamenti(result.appuntamenti || []); } })
      .catch(err => { if (active) { setLinkValido(false); setError(err.message); } });
    return () => { active = false; };
  }, [token]);

  const aggiornaElenco = async () => {
    setUpdating(true);
    setListError('');
    try {
      const result = await caricaAppuntamenti(token);
      setAppuntamenti(result.appuntamenti || []);
    } catch (err) { setListError(err.message); }
    finally { setUpdating(false); }
  };

  const save = async event => {
    event.preventDefault();
    setError('');
    if (scheda && (scheda.type !== 'application/pdf' && !scheda.name.toLowerCase().endsWith('.pdf'))) {
      setError('Seleziona un file PDF.');
      return;
    }
    if (scheda?.size > 10 * 1024 * 1024) {
      setError('Il PDF supera 10 MB.');
      return;
    }
    setSaving(true);
    try {
      const body = new FormData();
      for (const [key, value] of Object.entries(form)) body.append(key, value);
      if (scheda) body.append('scheda', scheda);
      const response = await fetch(`${API}/api/public/appuntamenti/${token}`, { method: 'POST', body });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Invio non riuscito.');
      setSaved(true);
      setForm(initialForm);
      setScheda(null);
      await aggiornaElenco();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 sm:py-12">
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl bg-indigo-500/20 p-3 text-indigo-300"><CalendarDays size={25} /></div>
        <div><h1 className="text-2xl font-bold">Nuovo appuntamento</h1><p className="text-sm text-slate-400">Compila la scheda e inviala a M2I.</p></div>
      </div>
      {linkValido === null ? <p className="rounded-2xl border border-slate-700 bg-slate-800 p-6">Verifica del link...</p>
        : !linkValido ? <p role="alert" className="rounded-2xl border border-red-500/30 bg-slate-800 p-6 text-red-200">{error || 'Questo link non è valido.'}</p>
          : saved ? <div role="status" className="rounded-2xl border border-emerald-500/30 bg-slate-800 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-300" size={38} />
            <h2 className="text-xl font-bold">Appuntamento inviato</h2>
            <p className="mt-2 text-sm text-slate-300">La scheda è stata salvata nella sezione Appuntamenti.</p>
            <button type="button" onClick={() => { setSaved(false); setError(''); }} className="mt-6 rounded-lg bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-500">Inserisci un altro appuntamento</button>
          </div> : <form onSubmit={save} className="space-y-5 rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-xl sm:p-7">
            {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
            <label className="block text-sm font-semibold">Data e ora<input required type="datetime-local" value={form.dataOra} onChange={event => setForm({ ...form, dataOra: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base text-white" /></label>
            <label className="block text-sm font-semibold">Cliente o potenziale cliente<input required maxLength={255} value={form.nominativo} onChange={event => setForm({ ...form, nominativo: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base text-white" /></label>
            <label className="block text-sm font-semibold">Chi lo svolge<input required maxLength={200} value={form.incaricato} onChange={event => setForm({ ...form, incaricato: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base text-white" /></label>
            <label className="block text-sm font-semibold">Luogo / via<input maxLength={500} value={form.luogo} onChange={event => setForm({ ...form, luogo: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base text-white" /></label>
            <label className="block text-sm font-semibold">Note<textarea rows={4} maxLength={2000} value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base text-white" /></label>
            <label className="block text-sm font-semibold">Scheda appuntamento PDF (facoltativa)<span className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-slate-500 bg-slate-900 p-3 text-slate-300"><FileUp size={20} />{scheda?.name || 'Seleziona PDF · massimo 10 MB'}</span><input type="file" accept="application/pdf,.pdf" onChange={event => setScheda(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm text-slate-300" /></label>
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-60">{saving ? 'Invio in corso...' : 'Invia appuntamento'}</button>
          </form>}
      {linkValido && <section className="mt-8" aria-labelledby="appuntamenti-inviati-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="appuntamenti-inviati-title" className="text-xl font-bold">Appuntamenti inviati</h2><p className="text-sm text-slate-400">Qui puoi seguire lo stato e leggere l’esito degli appuntamenti inseriti da questo link.</p></div>
          <button type="button" onClick={aggiornaElenco} disabled={updating} className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"><RefreshCw size={16} className={updating ? 'animate-spin' : ''} /> Aggiorna</button>
        </div>
        {listError && <p role="alert" className="mb-3 text-sm text-red-300">{listError}</p>}
        {appuntamenti.length ? <div className="space-y-3">{appuntamenti.map(item => <article key={item.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><strong className="break-words text-base">{item.nominativo}</strong><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.stato === 'Esitato' || item.stato === 'Svolto' ? 'bg-emerald-500/20 text-emerald-200' : item.stato === 'Annullato' ? 'bg-red-500/20 text-red-200' : item.stato === 'Richiesto da Marketing' ? 'bg-fuchsia-500/20 text-fuchsia-200' : item.stato === 'Passato' ? 'bg-slate-600/50 text-slate-200' : 'bg-amber-500/20 text-amber-200'}`}>{item.stato}</span></div>
          <p className="mt-2 text-sm text-slate-300">{new Date(`${item.dataOra}:00`).toLocaleString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          {item.incaricato && <p className="mt-1 text-sm text-slate-300">Chi lo svolge: {item.incaricato}</p>}
          {item.esito && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-sky-500/10 p-3 text-sm text-sky-100"><strong>Esito:</strong> {item.esito}</p>}
        </article>)}</div> : <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">Nessun appuntamento inviato da questo link.</p>}
      </section>}
    </div>
  </main>;
}
