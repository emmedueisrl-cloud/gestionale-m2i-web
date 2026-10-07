import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, ChevronDown, Clock3, Copy, Download, FilePlus2, FileText, Link2, MapPin, Paperclip, Pencil, Plus, UserRound, X } from 'lucide-react';
import NuovoPreventivoModal from './NuovoPreventivoModal';
import { recuperaElencoDipendenti } from '../../api/dipendenti';

const API = `${import.meta.env.VITE_API_URL || ''}/api/appuntamenti-preventivi`;
const emptyForm = { dataOra: '', nominativo: '', incaricato: '', luogo: '', note: '', stato: 'Programmato', esito: '' };
const STATO_RICHIESTO_MARKETING = 'Richiesto da Marketing';
const STATI = [STATO_RICHIESTO_MARKETING, 'Da svolgere', 'Passato', 'Programmato', 'Svolto', 'Annullato', 'Esitato'];

async function request(url, options) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Operazione non riuscita.');
  }
  return response.status === 204 ? null : response.json();
}

function formatDate(value) {
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  return {
    day: new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day)),
    time
  };
}

export default function AppuntamentiPreventivi() {
  const [appuntamenti, setAppuntamenti] = useState([]);
  const [preventivi, setPreventivi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [acceptForm, setAcceptForm] = useState(null);
  const [acceptError, setAcceptError] = useState('');
  const [esitoForm, setEsitoForm] = useState(null);
  const [rifissaForm, setRifissaForm] = useState(null);
  const [actionError, setActionError] = useState('');
  const [capisquadra, setCapisquadra] = useState([]);
  const [uploadForm, setUploadForm] = useState(null);
  const [linkForm, setLinkForm] = useState(null);
  const [newQuoteFor, setNewQuoteFor] = useState(null);
  const [statoInCima, setStatoInCima] = useState('Tutti');
  const [dettagliAperti, setDettagliAperti] = useState(null);
  const [publicToken, setPublicToken] = useState('');
  const [linkMessage, setLinkMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [appointments, quotes] = await Promise.all([request(API), request(`${import.meta.env.VITE_API_URL || ''}/api/preventivi`)]);
      setAppuntamenti(appointments);
      setPreventivi(quotes);
    }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/appuntamenti-public-link`, { credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Link non disponibile')))
      .then(result => setPublicToken(result.token))
      .catch(() => setLinkMessage('Link di inserimento non disponibile.'));
  }, []);

  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await request(form.id ? `${API}/${form.id}` : API, { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(form) });
      setForm(null);
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const apriAccettazione = async appointment => {
    setAcceptError('');
    setCapisquadra([]);
    setAcceptForm({ id: appointment.id, tipoCommerciale: '', commercialeId: '', commercialeNome: '', inAgenda: null });
    try {
      const dipendenti = await recuperaElencoDipendenti();
      setCapisquadra(dipendenti.filter(d => d.is_caposquadra === 1));
    } catch { setAcceptError('Impossibile caricare i caposquadra. Puoi inserire un commerciale manualmente.'); }
  };

  const accetta = async event => {
    event.preventDefault();
    if (acceptForm.tipoCommerciale === 'caposquadra' && typeof acceptForm.inAgenda !== 'boolean') {
      setAcceptError('Scegli se inserire l’appuntamento nell’Agenda Caposquadra.');
      return;
    }
    setSaving(true);
    setAcceptError('');
    try {
      await request(`${API}/${acceptForm.id}/accetta`, { method: 'POST', body: JSON.stringify(acceptForm) });
      setAcceptForm(null);
      await load();
    } catch (err) { setAcceptError(err.message); }
    finally { setSaving(false); }
  };

  const esita = async event => {
    event.preventDefault();
    setSaving(true);
    setActionError('');
    try {
      await request(`${API}/${esitoForm.id}/esita`, { method: 'POST', body: JSON.stringify({ esito: esitoForm.esito }) });
      setEsitoForm(null);
      await load();
    } catch (err) { setActionError(err.message); }
    finally { setSaving(false); }
  };

  const annullaAppuntamento = async appointment => {
    if (!window.confirm(`Eliminare l'appuntamento con ${appointment.nominativo}? Sarà segnato come Annullato e resterà nello storico.`)) return;
    setSaving(true);
    setError('');
    try {
      await request(`${API}/${appointment.id}/annulla`, { method: 'POST' });
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const rifissa = async event => {
    event.preventDefault();
    if (rifissaForm.commercialeDipendenteId && typeof rifissaForm.inAgenda !== 'boolean') {
      setActionError('Scegli se inserire l’appuntamento nell’Agenda Caposquadra.');
      return;
    }
    setSaving(true);
    setActionError('');
    try {
      const body = { dataOra: rifissaForm.dataOra };
      if (rifissaForm.commercialeDipendenteId) body.inAgenda = rifissaForm.inAgenda;
      await request(`${API}/${rifissaForm.id}/rifissa`, { method: 'POST', body: JSON.stringify(body) });
      setRifissaForm(null);
      await load();
    } catch (err) { setActionError(err.message); }
    finally { setSaving(false); }
  };

  const passaAMarketing = async appointment => {
    if (!window.confirm(`Rendere visibile l'appuntamento con ${appointment.nominativo} a chi possiede il link esterno?`)) return;
    setSaving(true);
    setError('');
    try {
      await request(`${API}/${appointment.id}/marketing`, { method: 'PATCH' });
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const uploadQuote = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', uploadForm.file);
      body.append('numeroPreventivo', uploadForm.numeroPreventivo);
      const response = await fetch(`${API}/${uploadForm.id}/preventivi`, { method: 'POST', credentials: 'same-origin', body });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Caricamento non riuscito.');
      setUploadForm(null);
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const linkQuote = async (idPreventivo, idAppuntamento) => {
    setSaving(true);
    setError('');
    try {
      await request(`${import.meta.env.VITE_API_URL || ''}/api/preventivi/${encodeURIComponent(idPreventivo)}/appuntamento`, { method: 'PUT', body: JSON.stringify({ appuntamentoId: idAppuntamento }) });
      setLinkForm(null);
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const now = new Date();
  const localNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isProssimo = a => ['Programmato', 'Da svolgere', STATO_RICHIESTO_MARKETING].includes(a.stato) && (a.senzaOrario || a.stato !== 'Programmato' ? a.dataOra.slice(0, 10) >= localNow.slice(0, 10) : a.dataOra >= localNow);
  const prossimi = appuntamenti.filter(isProssimo);
  const precedenti = appuntamenti.filter(a => !isProssimo(a)).reverse();
  const tuttiInOrdine = [...prossimi, ...precedenti];
  const appuntamentiInOrdine = statoInCima === 'Tutti' ? tuttiInOrdine : [
    ...tuttiInOrdine.filter(a => a.stato === statoInCima),
    ...tuttiInOrdine.filter(a => a.stato !== statoInCima)
  ];
  const publicUrl = publicToken ? `${window.location.origin}/inserisci-appuntamento/${publicToken}` : '';
  const copiaLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setLinkMessage('Link copiato. Chi lo possiede può inserire appuntamenti.');
    } catch { setLinkMessage('Impossibile copiare il link. Riprova.'); }
  };

  const renderList = (items, empty) => items.length ? <div className="space-y-2">
    {items.map(a => {
      const data = formatDate(a.dataOra);
      const aperto = dettagliAperti === a.id;
      const inLavorazione = ['Programmato', 'Da svolgere', 'Passato'].includes(a.stato);
      return <article key={a.id} className={`rounded-xl border bg-slate-800 shadow-sm ${aperto ? 'border-indigo-500/50' : 'border-slate-700'}`}>
        <div className="grid grid-cols-2 items-center gap-3 p-4 text-sm text-slate-100 lg:grid-cols-[100px_78px_minmax(120px,1.1fr)_minmax(120px,1.2fr)_minmax(120px,1fr)_95px_230px]">
          <span className="flex items-center gap-1.5 text-indigo-200"><CalendarDays size={15} className="shrink-0 lg:hidden" />{a.dataOra.slice(0, 10).split('-').reverse().join('/')}</span>
          <span className="flex items-center gap-1.5 text-slate-300"><Clock3 size={15} className="shrink-0 lg:hidden" />{a.senzaOrario ? 'In giornata' : data.time}</span>
          <div className="col-span-2 min-w-0 lg:col-span-1"><strong className="break-words">{a.nominativo}</strong><span className={`mt-1 block w-fit rounded px-2 py-0.5 text-[11px] font-bold ${a.marketing ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-slate-600/60 text-slate-200'}`}>{a.marketing ? 'Marketing' : 'Interno'}</span></div>
          <span className="col-span-2 flex min-w-0 items-start gap-1.5 break-words text-slate-300 lg:col-span-1"><MapPin size={15} className="mt-0.5 shrink-0 lg:hidden" />{a.luogo || '—'}</span>
          <span className="col-span-2 min-w-0 break-words text-slate-300 lg:col-span-1"><span className="mr-1 font-semibold text-slate-400 lg:hidden">Chi lo svolge:</span>{a.incaricato || '—'}</span>
          <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${a.stato === 'Svolto' ? 'bg-emerald-500/20 text-emerald-300' : a.stato === 'Annullato' ? 'bg-red-500/20 text-red-300' : a.stato === 'Esitato' ? 'bg-sky-500/20 text-sky-300' : a.stato === STATO_RICHIESTO_MARKETING ? 'bg-fuchsia-500/20 text-fuchsia-200' : a.stato === 'Passato' ? 'bg-slate-600/50 text-slate-200' : 'bg-amber-500/20 text-amber-300'}`}>{a.stato}</span>
          <div className="col-span-2 flex flex-wrap items-center gap-1.5 lg:col-span-1 lg:justify-end">
            <button type="button" onClick={() => setDettagliAperti(aperto ? null : a.id)} aria-expanded={aperto} aria-label={`${aperto ? 'Chiudi' : 'Apri'} dettagli di ${a.nominativo}`} title="Dettagli e preventivi" className="rounded-lg bg-slate-700 p-2 text-slate-200 hover:bg-slate-600"><ChevronDown size={16} className={`transition-transform ${aperto ? 'rotate-180' : ''}`} /></button>
            {a.stato === STATO_RICHIESTO_MARKETING ? <button type="button" onClick={() => apriAccettazione(a)} title="Accetta appuntamento" className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"><Check size={15} /> Accetta</button> : inLavorazione && <>
              <button type="button" onClick={() => { setActionError(''); setEsitoForm({ id: a.id, esito: '' }); }} className="rounded-lg bg-emerald-500/20 px-2 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30">Esita</button>
              <button type="button" onClick={() => { setActionError(''); setRifissaForm({ id: a.id, dataOra: a.dataOra, commercialeDipendenteId: a.commercialeDipendenteId || a.idCaposquadra, inAgenda: null }); }} className="rounded-lg bg-indigo-500/20 px-2 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/30">Rifissa</button>
              <button type="button" onClick={() => annullaAppuntamento(a)} disabled={saving} className="rounded-lg bg-red-500/15 px-2 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/25 disabled:opacity-50">Elimina</button>
            </>}
            {a.agendaImpegnoId ? <Link to={`/admin/ore/agenda?dipendente=${encodeURIComponent(a.idCaposquadra || '')}&data=${a.dataOra.slice(0, 10)}`} title="Gestisci dall’agenda" aria-label={`Gestisci dall’agenda ${a.nominativo}`} className="rounded-lg bg-indigo-500/15 p-2 text-indigo-200 hover:bg-indigo-500/25"><CalendarDays size={16} /></Link> : inLavorazione && !a.marketing && <>
              <button type="button" onClick={() => { setError(''); setForm({ ...a }); }} title="Modifica" aria-label={`Modifica ${a.nominativo}`} className="rounded-lg bg-indigo-500/15 p-2 text-indigo-200 hover:bg-indigo-500/25"><Pencil size={16} /></button>
            </>}
          </div>
        </div>
        {aperto && <div className="border-t border-slate-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-indigo-300">{a.marketing ? 'Visibile nel link esterno' : a.agendaImpegnoId ? 'Creato dall’Agenda Caposquadra' : 'Creato in Appuntamenti'}</p>{!a.marketing && <button type="button" onClick={() => passaAMarketing(a)} disabled={saving} className="rounded-lg bg-fuchsia-500/20 px-3 py-2 text-xs font-semibold text-fuchsia-100 hover:bg-fuchsia-500/30 disabled:opacity-50">Passa a Marketing</button>}</div>
        {a.schedaPdf && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 text-sm text-indigo-100"><FileText size={18} /><strong>Scheda appuntamento PDF</strong><a href={`${import.meta.env.VITE_API_URL || ''}${a.schedaPdf}`} target="_blank" rel="noreferrer" className="underline hover:text-white">Apri</a><a href={`${import.meta.env.VITE_API_URL || ''}${a.schedaPdf}`} download className="flex items-center gap-1 underline hover:text-white"><Download size={15} /> Scarica</a></div>}
        {a.attivita && <p className="mt-3 break-words text-sm text-slate-300"><strong>Attività:</strong> {a.attivita}</p>}
        {a.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-400">{a.note}</p>}
        {a.esito && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-sky-200"><strong>Esito:</strong> {a.esito}</p>}
        <div className="mt-4 border-t border-slate-700 pt-3">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Preventivi collegati</h4>
          {preventivi.filter(p => p.appuntamento_id === a.id).map(p => <div key={p.id} className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/60 px-3 py-2 text-sm">
            <span className="font-semibold text-slate-200">{p.numero_preventivo}</span>
            <div className="flex items-center gap-2">
              {p.allegato_preventivo && <><a href={`${import.meta.env.VITE_API_URL || ''}${p.allegato_preventivo}`} target="_blank" rel="noreferrer" className="text-indigo-200 hover:text-white">Apri PDF</a><a href={`${import.meta.env.VITE_API_URL || ''}${p.allegato_preventivo}`} download className="flex items-center gap-1 text-indigo-200 hover:text-white"><Download size={15} /> Scarica</a></>}
              <button type="button" onClick={() => linkQuote(p.id, null)} disabled={saving} className="text-xs text-slate-400 hover:text-red-300">Scollega</button>
            </div>
          </div>)}
          {!preventivi.some(p => p.appuntamento_id === a.id) && <p className="text-sm text-slate-500">Nessun preventivo collegato.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setError(''); setUploadForm({ id: a.id, file: null, numeroPreventivo: '' }); }} className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600"><Paperclip size={15} /> Allega PDF</button>
            <button type="button" onClick={() => setNewQuoteFor(a)} className="flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-3 py-2 text-sm text-indigo-100 hover:bg-indigo-500/30"><FilePlus2 size={15} /> Crea preventivo</button>
            <button type="button" onClick={() => { setError(''); setLinkForm({ id: a.id, preventivoId: '' }); }} className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600"><Link2 size={15} /> Collega esistente</button>
          </div>
        </div>
        </div>}
      </article>;
    })}
  </div> : <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">{empty}</p>;

  return <div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-slate-50">Appuntamenti</h2>
          <button type="button" onClick={copiaLink} disabled={!publicUrl} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"><Copy size={15} /> COPIA LINK INSERIMENTO APP</button>
        </div>
        <p className="text-sm text-slate-400">Crea appuntamenti qui, senza aggiungerli all’Agenda Caposquadra.</p>
        {linkMessage && <p role="status" className="mt-1 text-xs text-slate-300">{linkMessage}</p>}
      </div>
      <button type="button" onClick={() => { setError(''); setForm({ ...emptyForm }); }} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-500"><Plus size={18} /> Crea appuntamento</button>
    </div>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    {loading ? <p className="text-slate-400">Caricamento appuntamenti...</p> : <section>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Ordina gli appuntamenti per stato">
        <span className="mr-1 text-sm font-semibold text-slate-300">Stato · metti prima:</span>
        {['Tutti', ...STATI].map(stato => <button key={stato} type="button" aria-pressed={statoInCima === stato} onClick={() => setStatoInCima(stato)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${statoInCima === stato ? 'border-indigo-400 bg-indigo-500/25 text-white' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{stato} <span className="text-xs opacity-75">{stato === 'Tutti' ? appuntamenti.length : appuntamenti.filter(a => a.stato === stato).length}</span></button>)}
      </div>
      <div className="mb-2 hidden grid-cols-[100px_78px_minmax(120px,1.1fr)_minmax(120px,1.2fr)_minmax(120px,1fr)_95px_230px] gap-3 px-4 text-xs font-bold uppercase tracking-wide text-slate-400 lg:grid"><span>Data</span><span>Ora</span><span>Cliente</span><span>Via</span><span>Chi lo svolge</span><span>Stato</span><span className="text-right">Azioni</span></div>
      {renderList(appuntamentiInOrdine, 'Nessun appuntamento.')}
    </section>}

    {form && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={() => { if (!saving) setForm(null); }}>
      <form onSubmit={save} role="dialog" aria-modal="true" aria-label={form.id ? 'Modifica appuntamento' : 'Nuovo appuntamento'} onMouseDown={event => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{form.id ? 'Modifica appuntamento' : 'Nuovo appuntamento'}</h2><button type="button" onClick={() => setForm(null)} disabled={saving} aria-label="Chiudi" className="rounded p-1 hover:bg-slate-700"><X size={20} /></button></div>
        {!form.id && <p className="text-sm text-slate-300">L’appuntamento sarà salvato solo in questa sezione, senza comparire nell’Agenda Caposquadra.</p>}
        {error && <p role="alert" className="rounded-lg bg-red-500/10 p-2 text-sm text-red-300">{error}</p>}
        <label className="block text-sm font-medium">Data e ora<input required type="datetime-local" value={form.dataOra} onChange={event => setForm({ ...form, dataOra: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="block text-sm font-medium">Cliente o potenziale cliente<div className="relative mt-1"><UserRound size={17} className="absolute left-3 top-3 text-slate-400" /><input required maxLength={255} value={form.nominativo} onChange={event => setForm({ ...form, nominativo: event.target.value })} className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 pl-10" /></div></label>
        <label className="block text-sm font-medium">Chi lo svolge<input required maxLength={200} value={form.incaricato || ''} onChange={event => setForm({ ...form, incaricato: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="block text-sm font-medium">Luogo<input maxLength={500} value={form.luogo} onChange={event => setForm({ ...form, luogo: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="block text-sm font-medium">Note<textarea rows={3} maxLength={2000} value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setForm(null)} disabled={saving} className="rounded-lg border border-slate-600 px-4 py-2 hover:bg-slate-700">Annulla</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{saving ? 'Salvataggio...' : 'Salva'}</button></div>
      </form>
    </div>}

    {acceptForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={() => { if (!saving) setAcceptForm(null); }}>
      <form onSubmit={accetta} role="dialog" aria-modal="true" aria-label="Accetta appuntamento da Marketing" onMouseDown={event => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Accetta appuntamento</h2><button type="button" onClick={() => setAcceptForm(null)} disabled={saving} aria-label="Chiudi" className="rounded p-1 hover:bg-slate-700"><X size={20} /></button></div>
        <p className="text-sm text-slate-300">Scegli il commerciale che svolgerà l’appuntamento.</p>
        {acceptError && <p role="alert" className="rounded-lg bg-red-500/10 p-2 text-sm text-red-300">{acceptError}</p>}
        <label className="block text-sm font-medium">Tipo di commerciale<select required value={acceptForm.tipoCommerciale} onChange={event => setAcceptForm({ ...acceptForm, tipoCommerciale: event.target.value, commercialeId: '', commercialeNome: '', inAgenda: null })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2"><option value="">Seleziona</option><option value="caposquadra">Caposquadra</option><option value="manuale">Altro commerciale</option></select></label>
        {acceptForm.tipoCommerciale === 'caposquadra' && <>
          <label className="block text-sm font-medium">Caposquadra<select required value={acceptForm.commercialeId} onChange={event => setAcceptForm({ ...acceptForm, commercialeId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2"><option value="">Seleziona caposquadra</option>{capisquadra.map(d => <option key={d.id} value={d.id}>{d.nomeCompleto}</option>)}</select></label>
          <fieldset className="rounded-lg border border-slate-600 p-3"><legend className="px-1 text-sm font-medium">Inserire nell’Agenda Caposquadra?</legend><div className="mt-2 flex gap-6"><label className="flex items-center gap-2 text-sm"><input type="radio" name="inAgenda" checked={acceptForm.inAgenda === true} onChange={() => setAcceptForm({ ...acceptForm, inAgenda: true })} /> Sì</label><label className="flex items-center gap-2 text-sm"><input type="radio" name="inAgenda" checked={acceptForm.inAgenda === false} onChange={() => setAcceptForm({ ...acceptForm, inAgenda: false })} /> No</label></div></fieldset>
        </>}
        {acceptForm.tipoCommerciale === 'manuale' && <label className="block text-sm font-medium">Nome del commerciale<input required maxLength={200} value={acceptForm.commercialeNome} onChange={event => setAcceptForm({ ...acceptForm, commercialeNome: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setAcceptForm(null)} disabled={saving} className="rounded-lg border border-slate-600 px-4 py-2 hover:bg-slate-700">Annulla</button><button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50">{saving ? 'Salvataggio...' : 'Accetta appuntamento'}</button></div>
      </form>
    </div>}

    {esitoForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={() => { if (!saving) setEsitoForm(null); }}>
      <form onSubmit={esita} role="dialog" aria-modal="true" aria-label="Esita appuntamento" onMouseDown={event => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-5 text-slate-100 shadow-2xl">
        <h2 className="text-xl font-bold">Esita appuntamento</h2>
        {actionError && <p role="alert" className="text-sm text-red-300">{actionError}</p>}
        <label className="block text-sm font-medium">Esito<textarea required rows={4} maxLength={2000} value={esitoForm.esito} onChange={event => setEsitoForm({ ...esitoForm, esito: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" placeholder="Descrivi l’esito dell’appuntamento" /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setEsitoForm(null)} disabled={saving} className="rounded-lg border border-slate-600 px-4 py-2">Annulla</button><button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold disabled:opacity-50">{saving ? 'Salvataggio...' : 'Salva esito'}</button></div>
      </form>
    </div>}

    {rifissaForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={() => { if (!saving) setRifissaForm(null); }}>
      <form onSubmit={rifissa} role="dialog" aria-modal="true" aria-label="Rifissa appuntamento" onMouseDown={event => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-5 text-slate-100 shadow-2xl">
        <h2 className="text-xl font-bold">Rifissa appuntamento</h2>
        {actionError && <p role="alert" className="text-sm text-red-300">{actionError}</p>}
        <label className="block text-sm font-medium">Nuova data e ora<input required type="datetime-local" value={rifissaForm.dataOra} onChange={event => setRifissaForm({ ...rifissaForm, dataOra: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        {rifissaForm.commercialeDipendenteId && <fieldset className="rounded-lg border border-slate-600 p-3"><legend className="px-1 text-sm font-medium">Inserire nell’Agenda Caposquadra?</legend><div className="mt-2 flex gap-6"><label className="flex items-center gap-2 text-sm"><input type="radio" name="rifissaInAgenda" checked={rifissaForm.inAgenda === true} onChange={() => setRifissaForm({ ...rifissaForm, inAgenda: true })} /> Sì</label><label className="flex items-center gap-2 text-sm"><input type="radio" name="rifissaInAgenda" checked={rifissaForm.inAgenda === false} onChange={() => setRifissaForm({ ...rifissaForm, inAgenda: false })} /> No</label></div></fieldset>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setRifissaForm(null)} disabled={saving} className="rounded-lg border border-slate-600 px-4 py-2">Annulla</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-50">{saving ? 'Salvataggio...' : 'Conferma nuova data'}</button></div>
      </form>
    </div>}


    {uploadForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={() => { if (!saving) setUploadForm(null); }}>
      <form onSubmit={uploadQuote} role="dialog" aria-modal="true" aria-label="Allega preventivo PDF" onMouseDown={event => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-5 text-slate-100 shadow-2xl">
        <h2 className="text-xl font-bold">Allega preventivo PDF</h2>
        <p className="text-sm text-slate-400">Il file sarà visibile anche nella sezione Preventivi.</p>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <label className="block text-sm font-medium">Numero preventivo (facoltativo)<input maxLength={80} value={uploadForm.numeroPreventivo} onChange={event => setUploadForm({ ...uploadForm, numeroPreventivo: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="block text-sm font-medium">File PDF<input required type="file" accept="application/pdf,.pdf" onChange={event => setUploadForm({ ...uploadForm, file: event.target.files[0] || null })} className="mt-1 w-full text-sm" /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setUploadForm(null)} disabled={saving} className="rounded-lg border border-slate-600 px-4 py-2">Annulla</button><button type="submit" disabled={saving || !uploadForm.file} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-50">Carica</button></div>
      </form>
    </div>}

    {linkForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={() => { if (!saving) setLinkForm(null); }}>
      <div role="dialog" aria-modal="true" aria-label="Collega preventivo esistente" onMouseDown={event => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-5 text-slate-100 shadow-2xl">
        <h2 className="text-xl font-bold">Collega preventivo esistente</h2>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <label className="block text-sm font-medium">Preventivo<select value={linkForm.preventivoId} onChange={event => setLinkForm({ ...linkForm, preventivoId: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2"><option value="">Seleziona preventivo</option>{preventivi.filter(p => !p.appuntamento_id).map(p => <option key={p.id} value={p.id}>{p.numero_preventivo} · {p.ragione_sociale_prospect}</option>)}</select></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setLinkForm(null)} disabled={saving} className="rounded-lg border border-slate-600 px-4 py-2">Annulla</button><button type="button" onClick={() => linkQuote(linkForm.preventivoId, linkForm.id)} disabled={saving || !linkForm.preventivoId} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-50">Collega</button></div>
      </div>
    </div>}

    {newQuoteFor && <NuovoPreventivoModal appuntamento={newQuoteFor} onClose={() => setNewQuoteFor(null)} onSuccess={async () => { setNewQuoteFor(null); await load(); }} />}
  </div>;
}
