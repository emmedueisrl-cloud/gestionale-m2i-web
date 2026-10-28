import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, CalendarDays, CheckCircle2, ChevronDown, Clock3, FilePlus2, FileUp, Filter, Mail, MapPin, Phone, RefreshCw, Search, UserRound, X } from 'lucide-react';
import { TAG_COMMERCIALI, tagCommerciale, stileTagCommerciale } from '../../utils/tagCommercialeAppuntamento';

const initialForm = { dataOra: '', nominativo: '', referente: '', telefono: '', email: '', incaricato: '', operatore: '', luogo: '', note: '' };
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
  const [expandedId, setExpandedId] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [listError, setListError] = useState('');
  const [noteForm, setNoteForm] = useState(null);
  const [rebookForm, setRebookForm] = useState(null);
  const [actionError, setActionError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [notifiche, setNotifiche] = useState([]);
  const [lastReadId, setLastReadId] = useState(0);
  const [popup, setPopup] = useState(null);
  const [view, setView] = useState('tutti');
  const [query, setQuery] = useState('');
  const lastReadRef = useRef(0);

  const applyResult = result => {
    setAppuntamenti(result.appuntamenti || []);
    const recent = result.notifiche || [];
    setNotifiche(recent);
    const newestUnread = recent.find(item => item.id > lastReadRef.current);
    if (newestUnread) setPopup(previous => previous || newestUnread);
  };

  useEffect(() => {
    let active = true;
    const stored = Number(localStorage.getItem(`m2i-appuntamenti-notifiche-lette-${token}`)) || 0;
    lastReadRef.current = stored;
    setLastReadId(stored);
    caricaAppuntamenti(token)
      .then(result => { if (active) { setLinkValido(true); applyResult(result); } })
      .catch(err => { if (active) { setLinkValido(false); setError(err.message); } });
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') caricaAppuntamenti(token).then(result => { if (active) applyResult(result); }).catch(() => {});
    }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [token]);

  const segnaLette = id => {
    const next = Math.max(lastReadRef.current, id);
    lastReadRef.current = next;
    setLastReadId(next);
    localStorage.setItem(`m2i-appuntamenti-notifiche-lette-${token}`, String(next));
    setPopup(null);
  };

  const aggiornaElenco = async () => {
    setUpdating(true);
    setListError('');
    try {
      const result = await caricaAppuntamenti(token);
      applyResult(result);
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
      setShowForm(false);
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

  const cambiaTagCommerciale = async (appointment, nuovoTag) => {
    setSaving(true);
    setListError('');
    try {
      const response = await fetch(`${API}/api/public/appuntamenti/${token}/${appointment.id}/tag-commerciale`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tagCommerciale: nuovoTag })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Tag non aggiornato.');
      const result = await response.json();
      setAppuntamenti(previous => previous.map(item => item.id === appointment.id ? { ...item, tagCommerciale: result.tagCommerciale } : item));
    } catch (err) { setListError(err.message); }
    finally { setSaving(false); }
  };

  const formatTimestamp = value => new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatAppointment = value => new Date(`${value}:00`).toLocaleString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const unread = notifiche.filter(item => item.id > lastReadId).length;
  const pending = appuntamenti.filter(item => !['Esitato', 'Svolto', 'Annullato'].includes(item.stato)).length;
  const completed = appuntamenti.length - pending;
  const visibleAppointments = appuntamenti.filter(item => {
    const matchesView = view === 'tutti' || (view === 'aperti' ? !['Esitato', 'Svolto', 'Annullato'].includes(item.stato) : ['Esitato', 'Svolto', 'Annullato'].includes(item.stato));
    return matchesView && `${item.nominativo} ${item.referente || ''} ${item.incaricato || ''} ${item.stato} ${tagCommerciale(item)}`.toLocaleLowerCase('it-IT').includes(query.trim().toLocaleLowerCase('it-IT'));
  });
  const statusClass = stato => stato === 'Esitato' || stato === 'Svolto' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : stato === 'Annullato' ? 'border-rose-400/25 bg-rose-400/10 text-rose-200' : stato === 'Richiesto da Marketing' ? 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-200' : stato === 'Passato' ? 'border-slate-500/40 bg-slate-500/15 text-slate-200' : 'border-amber-400/25 bg-amber-400/10 text-amber-200';
  const openNewAppointment = () => { setSaved(false); setError(''); setShowForm(true); };

  return <main className="min-h-screen bg-[#080e20] text-slate-100">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(79,70,229,0.15),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(14,165,233,0.07),transparent_40%)]" />
    <div className="relative mx-auto w-full max-w-[1920px] px-6 pb-14 pt-7 xl:px-10 2xl:px-14">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-7">
        <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/15 text-indigo-200 shadow-lg shadow-indigo-950/30"><CalendarDays size={27} /></div><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">Area condivisa · M2I</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-white xl:text-4xl">Appuntamenti condivisi</h1><p className="mt-1 text-sm text-slate-400">Tutti gli incontri e gli aggiornamenti in un unico spazio.</p></div></div>
        {linkValido && <div className="flex items-center gap-3"><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200">Link attivo</span><button type="button" onClick={openNewAppointment} className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-950/40 hover:bg-indigo-400"><FilePlus2 size={18} /> Nuovo appuntamento</button></div>}
      </header>

      {linkValido === null && <div className="rounded-2xl border border-white/10 bg-slate-800/70 p-8 text-slate-300">Verifica del link...</div>}
      {linkValido === false && <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-8 text-rose-100">{error || 'Questo link non è valido.'}</div>}
      {linkValido && <>
        <div className="mb-7 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-800/70 p-5 shadow-xl shadow-black/10"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Appuntamenti inviati</p><div className="mt-3 flex items-end justify-between"><strong className="text-4xl font-bold text-white">{appuntamenti.length}</strong><CalendarDays className="text-indigo-300" size={27} /></div><p className="mt-2 text-sm text-slate-400">Schede presenti in questo link</p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-800/70 p-5 shadow-xl shadow-black/10"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Da seguire</p><div className="mt-3 flex items-end justify-between"><strong className="text-4xl font-bold text-white">{pending}</strong><Clock3 className="text-amber-300" size={27} /></div><p className="mt-2 text-sm text-slate-400">In attesa o in lavorazione</p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-800/70 p-5 shadow-xl shadow-black/10"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Conclusi</p><div className="mt-3 flex items-end justify-between"><strong className="text-4xl font-bold text-white">{completed}</strong><CheckCircle2 className="text-emerald-300" size={27} /></div><p className="mt-2 text-sm text-slate-400">Esitati, svolti o annullati</p></div>
        </div>

        {saved && <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4"><div className="flex items-center gap-3"><CheckCircle2 className="text-emerald-300" size={22} /><p className="font-semibold text-emerald-100">Appuntamento inviato e salvato correttamente.</p></div><button type="button" onClick={openNewAppointment} className="text-sm font-bold text-emerald-100 underline">Inserisci un altro</button></div>}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_370px] 2xl:grid-cols-[minmax(0,1fr)_410px]">
          <section aria-labelledby="appuntamenti-inviati-title" className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-slate-800/55 shadow-2xl shadow-black/15">
            <div className="border-b border-white/10 px-6 py-6 xl:px-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Panoramica</p><h2 id="appuntamenti-inviati-title" className="mt-1 text-2xl font-bold text-white">Elenco appuntamenti</h2><p className="mt-1 text-sm text-slate-400">Apri una scheda per consultare contatti, note ed esito.</p></div><button type="button" onClick={aggiornaElenco} disabled={updating} className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"><RefreshCw size={16} className={updating ? 'animate-spin' : ''} /> Aggiorna</button></div>
              <div className="mt-6 flex flex-wrap items-center gap-3"><div className="flex flex-wrap gap-2" role="group" aria-label="Filtra appuntamenti"><Filter size={17} className="mr-1 self-center text-slate-400" />{[['tutti', 'Tutti'], ['aperti', 'Da seguire'], ['conclusi', 'Conclusi']].map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`rounded-lg px-3.5 py-2 text-sm font-semibold ${view === key ? 'bg-indigo-500 text-white shadow-md shadow-indigo-950/30' : 'bg-slate-900/70 text-slate-300 hover:bg-slate-700'}`}>{label}</button>)}</div><label className="ml-auto flex min-w-[230px] flex-1 items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-2.5 text-slate-300 2xl:max-w-xs"><Search size={17} className="shrink-0" /><input aria-label="Cerca appuntamenti" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cerca cliente o referente" className="min-w-0 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" /></label></div>
            </div>
            {listError && <p role="alert" className="mx-6 mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{listError}</p>}
            <div className="max-h-[calc(100vh-290px)] min-h-[340px] space-y-3 overflow-y-auto p-5 xl:px-8 xl:py-6">
              {visibleAppointments.length ? visibleAppointments.map(item => <article id={`appuntamento-${item.id}`} key={item.id} className={`overflow-hidden rounded-2xl border bg-slate-900/65 transition-colors ${expandedId === item.id ? 'border-indigo-400/50' : 'border-white/10 hover:border-slate-500/70'}`}>
                <button type="button" aria-expanded={expandedId === item.id} aria-controls={`appuntamento-dettagli-${item.id}`} onClick={() => setExpandedId(previous => previous === item.id ? null : item.id)} className="grid w-full grid-cols-[minmax(0,1fr)_180px_170px_24px] items-center gap-5 px-5 py-5 text-left xl:grid-cols-[minmax(0,1fr)_220px_190px_24px]">
                  <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="break-words text-base font-bold text-white xl:text-lg">{item.nominativo}</strong>{item.numeroAppuntamento > 1 && <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-100">{item.numeroAppuntamento}° app.</span>}</span><span className="mt-1 block text-sm text-slate-400">{item.referente || 'Nessun referente'}</span></span>
                  <span className="text-sm font-medium text-slate-200">{formatAppointment(item.dataOra)}</span>
                  <span className="flex flex-wrap gap-1.5"><span className={`inline-flex w-fit max-w-full rounded-full border px-3 py-1.5 text-xs font-bold ${statusClass(item.stato)}`}>{item.stato}</span><span className={`inline-flex w-fit max-w-full rounded-full border px-2.5 py-1 text-xs font-bold ${stileTagCommerciale(tagCommerciale(item))}`}>{tagCommerciale(item)}</span></span>
                  <ChevronDown size={20} className={`text-indigo-200 transition-transform ${expandedId === item.id ? 'rotate-180' : ''}`} />
                </button>
                <div id={`appuntamento-dettagli-${item.id}`} hidden={expandedId !== item.id} className="border-t border-white/10 px-5 py-5">
                  <label className="mb-5 block max-w-xs text-sm font-semibold text-slate-200">Tag commerciale<select value={tagCommerciale(item)} onChange={event => cambiaTagCommerciale(item, event.target.value)} disabled={saving || item.stato === 'Annullato'} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 p-2.5 text-white disabled:opacity-60">{TAG_COMMERCIALI.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label>
                  {item.stato === 'Annullato' && <p className="mb-5 text-xs text-rose-200">Gli appuntamenti annullati hanno il tag KO.</p>}
                  <div className="grid gap-5 md:grid-cols-2"><div><h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Contatto</h3><div className="space-y-2.5 text-sm text-slate-200">{item.referente && <p className="flex items-center gap-2"><UserRound size={16} className="text-indigo-300" />{item.referente}</p>}{item.telefono && <p className="flex items-center gap-2"><Phone size={16} className="text-indigo-300" /><a href={`tel:${item.telefono.replace(/[^\d+]/g, '')}`} className="hover:text-white hover:underline">{item.telefono}</a></p>}{item.email && <p className="flex items-center gap-2 break-all"><Mail size={16} className="shrink-0 text-indigo-300" /><a href={`mailto:${item.email}`} className="hover:text-white hover:underline">{item.email}</a></p>}</div></div><div><h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Incarico</h3><div className="space-y-2.5 text-sm text-slate-200">{item.incaricato && <p><span className="text-slate-400">Chi lo svolge:</span> {item.incaricato}</p>}{item.operatore && <p><span className="text-slate-400">Operatore:</span> {item.operatore}</p>}{item.luogo && <p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-indigo-300" />{item.luogo}</p>}</div></div></div>
                  {item.esito && <div className="mt-5 rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-100"><strong className="block">Esito</strong><p className="mt-1 whitespace-pre-wrap break-words">{item.esito}</p></div>}
                  <div className="mt-5 border-t border-white/10 pt-5"><h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Note appuntamento</h3>{item.noteStoriche?.length ? <div className="space-y-2">{item.noteStoriche.map(note => <div key={note.id} className="rounded-xl bg-slate-800/70 p-3.5 text-sm"><div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-indigo-200"><time dateTime={note.creataIl}>{formatTimestamp(note.creataIl)}</time><span>{note.autore || (note.tipo === 'scheda' ? 'Marketing' : 'M2I')}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-slate-200">{note.testo}</p></div>)}</div> : <p className="text-sm text-slate-400">Nessuna nota presente.</p>}</div>
                  <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => { setActionError(''); setNoteForm({ id: item.id, testo: '' }); }} className="rounded-lg border border-slate-600 bg-slate-700/60 px-4 py-2.5 text-sm font-semibold hover:bg-slate-700">Aggiungi nota</button><button type="button" onClick={() => { setActionError(''); setRebookForm({ id: item.id, dataOra: item.dataOra, testo: '' }); }} className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400">Rifissa appuntamento</button></div>
                </div>
              </article>) : <div className="rounded-2xl border border-dashed border-slate-600 p-10 text-center"><CalendarDays className="mx-auto text-slate-500" size={32} /><p className="mt-3 font-semibold text-slate-200">Nessun appuntamento trovato</p><p className="mt-1 text-sm text-slate-400">Prova un altro filtro oppure crea un nuovo appuntamento.</p></div>}
            </div>
          </section>

          <aside aria-label="Notifiche dal gestionale" className="overflow-hidden rounded-3xl border border-white/10 bg-slate-800/55 shadow-2xl shadow-black/15 xl:sticky xl:top-7">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5"><div className="flex items-center gap-3"><button type="button" aria-label={`Notifiche non lette: ${unread}`} onClick={() => document.getElementById('notifiche-elenco')?.focus()} className="relative rounded-xl border border-indigo-400/25 bg-indigo-500/15 p-2.5 text-indigo-200"><Bell size={22} />{unread > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">{unread}</span>}</button><div><h2 className="font-bold text-white">Ultime notifiche</h2><p className="text-xs text-slate-400">Aggiornamenti dal gestionale</p></div></div></div>
            <div id="notifiche-elenco" tabIndex={-1} className="max-h-[calc(100vh-235px)] min-h-[300px] space-y-2 overflow-y-auto p-4">{notifiche.length ? notifiche.slice(0, 12).map(item => <button key={item.id} type="button" onClick={() => { segnaLette(item.id); setView('tutti'); setQuery(''); setExpandedId(item.appuntamentoId); setTimeout(() => document.getElementById(`appuntamento-${item.appuntamentoId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); }} className={`w-full rounded-xl border p-3.5 text-left transition-colors ${item.id > lastReadId ? 'border-indigo-400/30 bg-indigo-500/10 hover:bg-indigo-500/20' : 'border-white/5 bg-slate-900/50 hover:bg-slate-900'}`}><span className="flex items-center justify-between gap-2"><strong className="break-words text-sm text-white">{item.nominativo}</strong>{item.id > lastReadId && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-400" />}</span><span className="mt-1 block text-sm leading-relaxed text-slate-300">{item.testo}</span><time className="mt-2 block text-xs text-slate-500">{formatTimestamp(item.creataIl)}</time></button>) : <div className="px-3 py-12 text-center"><Bell className="mx-auto text-slate-500" size={29} /><p className="mt-3 text-sm text-slate-400">Nessuna modifica ricevuta.</p></div>}</div>
            {unread > 0 && <div className="border-t border-white/10 p-4"><button type="button" onClick={() => segnaLette(notifiche[0].id)} className="w-full rounded-xl border border-slate-600 px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700">Segna tutte come lette</button></div>}
          </aside>
        </div>
      </>}
    </div>

    {showForm && linkValido && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#030713]/85 p-5 backdrop-blur-sm"><form onSubmit={save} role="dialog" aria-modal="true" aria-label="Nuovo appuntamento" className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-indigo-400/25 bg-slate-800 p-7 shadow-2xl shadow-black/50 xl:p-9"><div className="mb-7 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Nuova scheda</p><h2 className="mt-1 text-2xl font-bold text-white">Nuovo appuntamento</h2><p className="mt-1 text-sm text-slate-400">Compila i dettagli dell’incontro e inviali a M2I.</p></div><button type="button" onClick={() => setShowForm(false)} disabled={saving} aria-label="Chiudi" className="rounded-xl border border-slate-600 p-2 text-slate-300 hover:bg-slate-700"><X size={21} /></button></div>
      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
      <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">{[
        ['dataOra', 'Data e ora', 'datetime-local', true], ['nominativo', 'Cliente o potenziale cliente', 'text', true],
        ['referente', 'Referente', 'text', true], ['telefono', 'Telefono', 'tel', true],
        ['email', 'Email (facoltativa)', 'email', false], ['incaricato', 'Chi lo svolge', 'text', true],
        ['operatore', 'Operatore (facoltativo)', 'text', false], ['luogo', 'Luogo / via', 'text', false]
      ].map(([key, label, type, required]) => <label key={key} className="block text-sm font-semibold text-slate-200">{label}<input required={required} type={type} autoComplete={key === 'telefono' ? 'tel' : key === 'email' ? 'email' : undefined} maxLength={{ nominativo: 255, referente: 255, telefono: 50, email: 254, incaricato: 200, operatore: 200, luogo: 500 }[key]} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-base text-white outline-none focus:border-indigo-400" /></label>)}</div>
      <div className="mt-5 grid items-start gap-5 md:grid-cols-2"><label className="block text-sm font-semibold text-slate-200">Note<textarea rows={5} maxLength={2000} value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-base text-white outline-none focus:border-indigo-400" /></label><label className="block text-sm font-semibold text-slate-200">Scheda appuntamento PDF (facoltativa)<span className="mt-2 flex min-h-32 items-center gap-3 rounded-xl border border-dashed border-slate-500 bg-slate-900/70 p-4 text-slate-300"><FileUp size={24} className="shrink-0 text-indigo-300" />{scheda?.name || 'Seleziona un PDF · massimo 10 MB'}</span><input type="file" accept="application/pdf,.pdf" onChange={event => setScheda(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm text-slate-300" /></label></div>
      <div className="mt-7 flex justify-end gap-3 border-t border-white/10 pt-6"><button type="button" onClick={() => setShowForm(false)} disabled={saving} className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700">Annulla</button><button type="submit" disabled={saving} className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-60">{saving ? 'Invio in corso...' : 'Invia appuntamento'}</button></div>
    </form></div>}

    {popup && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4"><div role="alertdialog" aria-modal="true" aria-label="Nuova notifica appuntamento" className="w-full max-w-lg rounded-2xl border border-indigo-400/40 bg-slate-800 p-7 shadow-2xl"><Bell className="mb-3 text-indigo-300" size={28} /><h2 className="text-xl font-bold">Modifica dal gestionale</h2><p className="mt-3 font-semibold">{popup.nominativo}</p><p className="mt-2 text-slate-200">{popup.testo}</p><time className="mt-2 block text-xs text-slate-400">{formatTimestamp(popup.creataIl)}</time><button type="button" onClick={() => segnaLette(popup.id)} className="mt-6 w-full rounded-xl bg-indigo-500 px-4 py-3 font-semibold hover:bg-indigo-400">Ho letto</button></div></div>}
    {noteForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><form onSubmit={salvaNota} role="dialog" aria-modal="true" aria-label="Aggiungi nota" className="w-full max-w-md space-y-4 rounded-2xl border border-slate-600 bg-slate-800 p-5 shadow-2xl"><h2 className="text-xl font-bold">Aggiungi nota</h2><p className="text-sm text-slate-300">La data e l’ora saranno registrate automaticamente.</p>{actionError && <p role="alert" className="text-sm text-red-300">{actionError}</p>}<label className="block text-sm font-semibold">Nota<textarea required maxLength={2000} rows={4} value={noteForm.testo} onChange={event => setNoteForm({ ...noteForm, testo: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" /></label><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setNoteForm(null)} className="rounded-lg border border-slate-600 px-4 py-2">Annulla</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-60">Salva nota</button></div></form></div>}
    {rebookForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><form onSubmit={rifissa} role="dialog" aria-modal="true" aria-label="Rifissa appuntamento" className="w-full max-w-md space-y-4 rounded-2xl border border-slate-600 bg-slate-800 p-5 shadow-2xl"><h2 className="text-xl font-bold">Rifissa appuntamento</h2><p className="text-sm text-slate-300">Aggiornerai la data dello stesso appuntamento. La data iniziale e quella nuova saranno registrate automaticamente nelle note.</p>{actionError && <p role="alert" className="text-sm text-red-300">{actionError}</p>}<label className="block text-sm font-semibold">Nuova data e ora<input required type="datetime-local" value={rebookForm.dataOra} onChange={event => setRebookForm({ ...rebookForm, dataOra: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" /></label><label className="block text-sm font-semibold">Note obbligatorie<textarea required maxLength={2000} rows={4} value={rebookForm.testo} onChange={event => setRebookForm({ ...rebookForm, testo: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" /></label><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setRebookForm(null)} className="rounded-lg border border-slate-600 px-4 py-2">Annulla</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-60">Aggiorna data</button></div></form></div>}
  </main>;
}
