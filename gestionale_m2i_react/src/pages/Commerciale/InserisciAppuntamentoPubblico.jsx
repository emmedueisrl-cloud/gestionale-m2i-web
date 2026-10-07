import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, FileUp, RefreshCw } from 'lucide-react';

const initialForm = { dataOra: '', nominativo: '', referente: '', telefono: '', email: '', incaricato: '', luogo: '', note: '' };
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
  const [noteForm, setNoteForm] = useState(null);
  const [rebookForm, setRebookForm] = useState(null);
  const [actionError, setActionError] = useState('');

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

  const salvaNota = async event => {
    event.preventDefault();
    setSaving(true);
    setActionError('');
    try {
      const response = await fetch(`${API}/api/public/appuntamenti/${token}/${noteForm.id}/note`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ testo: noteForm.testo })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Nota non salvata.');
      setNoteForm(null);
      await aggiornaElenco();
    } catch (err) { setActionError(err.message); }
    finally { setSaving(false); }
  };

  const rifissa = async event => {
    event.preventDefault();
    setSaving(true);
    setActionError('');
    try {
      const response = await fetch(`${API}/api/public/appuntamenti/${token}/${rebookForm.id}/rifissa`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataOra: rebookForm.dataOra, testo: rebookForm.testo })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Impossibile rifissare l’appuntamento.');
      setRebookForm(null);
      await aggiornaElenco();
    } catch (err) { setActionError(err.message); }
    finally { setSaving(false); }
  };

  const formatTimestamp = value => new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
            <label className="block text-sm font-semibold">Referente<input required maxLength={255} value={form.referente} onChange={event => setForm({ ...form, referente: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base text-white" /></label>
            <label className="block text-sm font-semibold">Telefono<input required type="tel" autoComplete="tel" maxLength={50} value={form.telefono} onChange={event => setForm({ ...form, telefono: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base text-white" /></label>
            <label className="block text-sm font-semibold">Email<input required type="email" autoComplete="email" maxLength={254} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base text-white" /></label>
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
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><strong className="break-words text-base">{item.nominativo}</strong>{item.numeroAppuntamento > 1 && <span className="rounded bg-indigo-500/25 px-2 py-1 text-xs font-bold text-indigo-100">{item.numeroAppuntamento}° app</span>}</div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.stato === 'Esitato' || item.stato === 'Svolto' ? 'bg-emerald-500/20 text-emerald-200' : item.stato === 'Annullato' ? 'bg-red-500/20 text-red-200' : item.stato === 'Richiesto da Marketing' ? 'bg-fuchsia-500/20 text-fuchsia-200' : item.stato === 'Passato' ? 'bg-slate-600/50 text-slate-200' : 'bg-amber-500/20 text-amber-200'}`}>{item.stato}</span></div>
          <p className="mt-2 text-sm text-slate-300">{new Date(`${item.dataOra}:00`).toLocaleString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          {item.referente && <p className="mt-1 text-sm text-slate-300">Referente: {item.referente}</p>}
          {item.telefono && <p className="mt-1 text-sm text-slate-300">Telefono: <a href={`tel:${item.telefono.replace(/[^\d+]/g, '')}`} className="text-indigo-200 underline">{item.telefono}</a></p>}
          {item.email && <p className="mt-1 break-words text-sm text-slate-300">Email: <a href={`mailto:${item.email}`} className="text-indigo-200 underline">{item.email}</a></p>}
          {item.incaricato && <p className="mt-1 text-sm text-slate-300">Chi lo svolge: {item.incaricato}</p>}
          {item.esito && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-sky-500/10 p-3 text-sm text-sky-100"><strong>Esito:</strong> {item.esito}</p>}
          {item.noteStoriche?.length > 0 && <div className="mt-3 space-y-2"><h3 className="text-xs font-bold uppercase text-slate-400">Note</h3>{item.noteStoriche.map(note => <div key={note.id} className="rounded-lg bg-slate-900/70 p-3 text-sm"><time dateTime={note.creataIl} className="block text-xs font-semibold text-indigo-200">{formatTimestamp(note.creataIl)}</time><p className="mt-1 whitespace-pre-wrap break-words text-slate-200">{note.testo}</p></div>)}</div>}
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { setActionError(''); setNoteForm({ id: item.id, testo: '' }); }} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600">Aggiungi nota</button>{item.stato === 'Esitato' && !appuntamenti.some(next => next.appuntamentoPrecedenteId === item.id) && <button type="button" onClick={() => { setActionError(''); setRebookForm({ id: item.id, numeroAppuntamento: (item.numeroAppuntamento || 1) + 1, dataOra: '', testo: '' }); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold hover:bg-indigo-500">Rifissa</button>}</div>
        </article>)}</div> : <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">Nessun appuntamento inviato da questo link.</p>}
      </section>}
      {noteForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><form onSubmit={salvaNota} role="dialog" aria-modal="true" aria-label="Aggiungi nota" className="w-full max-w-md space-y-4 rounded-2xl border border-slate-600 bg-slate-800 p-5 shadow-2xl"><h2 className="text-xl font-bold">Aggiungi nota</h2><p className="text-sm text-slate-300">La data e l’ora saranno registrate automaticamente.</p>{actionError && <p role="alert" className="text-sm text-red-300">{actionError}</p>}<label className="block text-sm font-semibold">Nota<textarea required maxLength={2000} rows={4} value={noteForm.testo} onChange={event => setNoteForm({ ...noteForm, testo: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" /></label><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setNoteForm(null)} className="rounded-lg border border-slate-600 px-4 py-2">Annulla</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-60">Salva nota</button></div></form></div>}
      {rebookForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><form onSubmit={rifissa} role="dialog" aria-modal="true" aria-label="Rifissa appuntamento" className="w-full max-w-md space-y-4 rounded-2xl border border-slate-600 bg-slate-800 p-5 shadow-2xl"><h2 className="text-xl font-bold">Rifissa appuntamento</h2><p className="text-sm text-slate-300">Invierai una nuova richiesta Marketing con il tag “{rebookForm.numeroAppuntamento}° app”. L’appuntamento precedente resterà nello storico.</p>{actionError && <p role="alert" className="text-sm text-red-300">{actionError}</p>}<label className="block text-sm font-semibold">Nuova data e ora<input required type="datetime-local" value={rebookForm.dataOra} onChange={event => setRebookForm({ ...rebookForm, dataOra: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" /></label><label className="block text-sm font-semibold">Note obbligatorie<textarea required maxLength={2000} rows={4} value={rebookForm.testo} onChange={event => setRebookForm({ ...rebookForm, testo: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" /></label><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setRebookForm(null)} className="rounded-lg border border-slate-600 px-4 py-2">Annulla</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-60">Invia nuova richiesta</button></div></form></div>}
    </div>
  </main>;
}
