import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowDownUp, ArrowUp, CalendarDays, Check, ChevronDown, Clock3, Copy, Download, FilePlus2, FileText, Link2, MapPin, Paperclip, Pencil, Plus, Printer, Search, Trash2, UserRound, X } from 'lucide-react';
import NuovoPreventivoModal from './NuovoPreventivoModal';
import { recuperaElencoDipendenti } from '../../api/dipendenti';
import { notePostAppuntamento } from '../../utils/noteAppuntamento';
import { sortRows } from '../../utils/sortRows';

const API = `${import.meta.env.VITE_API_URL || ''}/api/appuntamenti-preventivi`;
const emptyForm = { dataOra: '', nominativo: '', referente: '', telefono: '', email: '', incaricato: '', operatore: '', attivita: '', luogo: '', note: '', stato: 'Programmato', esito: '', senzaOrario: false, marketing: false };
const STATO_RICHIESTO_MARKETING = 'Richiesto da Marketing';
const STATI = [STATO_RICHIESTO_MARKETING, 'Da svolgere', 'Passato', 'Programmato', 'Svolto', 'Annullato', 'Esitato'];
const COLONNE_APPUNTAMENTI = [
  { key: 'dataOra', label: 'Data e ora', value: item => item.dataOra },
  { key: 'nominativo', label: 'Azienda', value: item => item.nominativo },
  { key: 'origine', label: 'Origine', value: item => item.marketing ? 'Marketing' : 'Interno' },
  { key: 'luogo', label: 'Via', value: item => item.luogo },
  { key: 'incaricato', label: 'Commerciale', value: item => item.incaricato },
  { key: 'stato', label: 'Stato', value: item => item.stato }
];

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
  const [searchParams] = useSearchParams();
  const targetAppointmentId = Number(searchParams.get('appuntamento'));
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
  const [quoteToEdit, setQuoteToEdit] = useState(null);
  const [ordinamentoAppuntamenti, setOrdinamentoAppuntamenti] = useState(null);
  const [ricercaAppuntamenti, setRicercaAppuntamenti] = useState('');
  const [dettagliAperti, setDettagliAperti] = useState(null);
  const [publicToken, setPublicToken] = useState('');
  const [linkMessage, setLinkMessage] = useState('');
  const [notaTesto, setNotaTesto] = useState('');
  const [notaInModifica, setNotaInModifica] = useState(null);
  const [notaError, setNotaError] = useState('');
  const [riferimenti, setRiferimenti] = useState(null);
  const [riferimentiError, setRiferimentiError] = useState('');

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

  useEffect(() => {
    if (targetAppointmentId > 0) load();
  }, [targetAppointmentId]);

  useEffect(() => {
    if (!targetAppointmentId || !appuntamenti.some(item => item.id === targetAppointmentId)) return;
    setDettagliAperti(targetAppointmentId);
    const timer = window.setTimeout(() => document.getElementById(`appuntamento-${targetAppointmentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    return () => window.clearTimeout(timer);
  }, [targetAppointmentId, appuntamenti]);

  const apriRiferimenti = async () => {
    setRiferimentiError('');
    try { setRiferimenti(await request(`${import.meta.env.VITE_API_URL || ''}/api/riferimenti-aziendali`)); }
    catch (err) { setError(err.message); }
  };

  const salvaRiferimenti = async event => {
    event.preventDefault();
    setSaving(true);
    setRiferimentiError('');
    try {
      await request(`${import.meta.env.VITE_API_URL || ''}/api/riferimenti-aziendali`, { method: 'PUT', body: JSON.stringify(riferimenti) });
      setRiferimenti(null);
    } catch (err) { setRiferimentiError(err.message); }
    finally { setSaving(false); }
  };

  const salvaNota = async (event, id) => {
    event.preventDefault();
    setSaving(true);
    setNotaError('');
    try {
      const nota = await request(`${API}/${id}/note`, { method: 'POST', body: JSON.stringify({ testo: notaTesto }) });
      setAppuntamenti(previous => previous.map(item => item.id === id ? { ...item, noteStoriche: [...(item.noteStoriche || []), nota] } : item));
      setNotaTesto('');
    } catch (err) { setNotaError(err.message); }
    finally { setSaving(false); }
  };

  const salvaModificaNota = async event => {
    event.preventDefault();
    setSaving(true);
    setNotaError('');
    try {
      const aggiornata = await request(`${API}/${notaInModifica.appuntamentoId}/note/${notaInModifica.id}`, { method: 'PUT', body: JSON.stringify({ testo: notaInModifica.testo }) });
      setAppuntamenti(previous => previous.map(item => item.id === notaInModifica.appuntamentoId ? { ...item, noteStoriche: item.noteStoriche.map(note => note.id === aggiornata.id ? aggiornata : note) } : item));
      setNotaInModifica(null);
    } catch (err) { setNotaError(err.message); }
    finally { setSaving(false); }
  };

  const eliminaNota = async (appointmentId, noteId = null) => {
    if (!window.confirm(noteId === null ? 'Eliminare la nota della scheda appuntamento?' : 'Eliminare questa nota post appuntamento?')) return;
    setSaving(true);
    setNotaError('');
    try {
      await request(noteId === null ? `${API}/${appointmentId}/note-scheda` : `${API}/${appointmentId}/note/${noteId}`, { method: 'DELETE' });
      if (noteId === null) await load();
      else setAppuntamenti(previous => previous.map(item => item.id === appointmentId ? { ...item, noteStoriche: item.noteStoriche.filter(note => note.id !== noteId) } : item));
    } catch (err) { setNotaError(err.message); }
    finally { setSaving(false); }
  };

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
    if (!window.confirm(`Annullare l'appuntamento con ${appointment.nominativo}? Resterà nello storico.`)) return;
    setSaving(true);
    setError('');
    try {
      await request(`${API}/${appointment.id}/annulla`, { method: 'POST' });
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const eliminaAppuntamento = async appointment => {
    if (!window.confirm(`Eliminare definitivamente l'appuntamento con ${appointment.nominativo}? La scheda, le note${appointment.agendaImpegnoId ? ' e l’impegno in Agenda' : ''} non saranno recuperabili.`)) return;
    setSaving(true);
    setError('');
    try {
      await request(`${API}/${appointment.id}`, { method: 'DELETE' });
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
  const appuntamentiInOrdine = ordinamentoAppuntamenti
    ? sortRows(appuntamenti, COLONNE_APPUNTAMENTI.find(colonna => colonna.key === ordinamentoAppuntamenti.key).value, ordinamentoAppuntamenti.direction)
    : tuttiInOrdine;
  const ricerca = ricercaAppuntamenti.trim().toLocaleLowerCase('it-IT');
  const appuntamentiVisibili = ricerca ? appuntamentiInOrdine.filter(a => [a.nominativo, a.referente, a.telefono, a.email, a.luogo, a.incaricato, a.operatore, a.stato, a.dataOra]
    .some(value => String(value || '').toLocaleLowerCase('it-IT').includes(ricerca))) : appuntamentiInOrdine;
  const cambiaOrdinamento = key => {
    setOrdinamentoAppuntamenti(previous => ({ key, direction: previous?.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }));
  };
  const publicUrl = publicToken ? `${window.location.origin}/inserisci-appuntamento/${publicToken}` : '';
  const copiaLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setLinkMessage('Link copiato. Chi lo possiede può inserire appuntamenti.');
    } catch { setLinkMessage('Impossibile copiare il link. Riprova.'); }
  };

  const renderList = (items, empty) => items.length ? <div className="space-y-5 pb-1">
    {items.map(a => {
      const data = formatDate(a.dataOra);
      const aperto = dettagliAperti === a.id;
      const notePost = notePostAppuntamento(a.note, a.noteStoriche);
      const inLavorazione = ['Programmato', 'Da svolgere', 'Passato'].includes(a.stato);
      return <article key={a.id} id={`appuntamento-${a.id}`} className={`overflow-hidden rounded-2xl border-2 border-l-[6px] bg-[#23324b] shadow-[0_10px_26px_rgba(0,0,0,0.35)] transition-colors ${aperto ? 'border-indigo-400 border-l-indigo-300' : `border-[#52637e] hover:border-slate-300/70 ${a.stato === 'Annullato' ? 'border-l-rose-400' : a.stato === 'Esitato' || a.stato === 'Svolto' ? 'border-l-emerald-400' : a.stato === STATO_RICHIESTO_MARKETING ? 'border-l-fuchsia-400' : 'border-l-amber-400'}`}`}>
        <div className="grid grid-cols-2 items-start gap-x-4 gap-y-4 px-5 py-5 text-sm text-slate-100 lg:grid-cols-[125px_minmax(170px,1.2fr)_105px_minmax(170px,1.2fr)_minmax(145px,1fr)_145px] lg:items-center lg:gap-x-5 lg:py-6">
          <div className="col-span-2 min-w-0 lg:col-span-1"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Data e ora</span><span className="flex items-center gap-2 font-semibold text-white"><CalendarDays size={16} className="shrink-0 text-indigo-300" />{a.dataOra.slice(0, 10).split('-').reverse().join('/')}</span><span className="ml-6 mt-1 flex items-center gap-1 text-slate-300"><Clock3 size={14} className="lg:hidden" />{a.senzaOrario ? 'In giornata' : data.time}</span></div>
          <div className="col-span-2 min-w-0 lg:col-span-1"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Azienda</span><strong className="block break-words text-base leading-snug text-white" title={a.nominativo}>{a.nominativo}</strong></div>
          <div className="min-w-0"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Origine</span><span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${a.marketing ? 'bg-fuchsia-500/15 text-fuchsia-200' : 'bg-slate-600/60 text-slate-200'}`}>{a.marketing ? 'Marketing' : 'Interno'}</span>{a.numeroAppuntamento > 1 && <span className="mt-1 block text-xs font-semibold text-indigo-200">{a.numeroAppuntamento}° app</span>}</div>
          <div className="min-w-0"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Indirizzo</span><span className="flex items-start gap-1.5 break-words leading-snug text-slate-200" title={a.luogo || ''}><MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />{a.luogo || '—'}</span></div>
          <div className="min-w-0"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Commerciale</span><span className="block break-words font-medium leading-snug text-slate-200" title={a.incaricato || ''}>{a.incaricato || '—'}</span></div>
          <div className="min-w-0"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400 lg:hidden">Stato</span><span className={`inline-flex max-w-full rounded-full px-3 py-1.5 text-xs font-bold leading-tight ${a.stato === 'Svolto' ? 'bg-emerald-500/20 text-emerald-300' : a.stato === 'Annullato' ? 'bg-red-500/20 text-red-300' : a.stato === 'Esitato' ? 'bg-sky-500/20 text-sky-300' : a.stato === STATO_RICHIESTO_MARKETING ? 'bg-fuchsia-500/20 text-fuchsia-200' : a.stato === 'Passato' ? 'bg-slate-600/50 text-slate-200' : 'bg-amber-500/20 text-amber-300'}`}>{a.stato}</span></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[#52637e] bg-[#17243a] px-5 py-3.5">
          <button type="button" onClick={() => { setDettagliAperti(aperto ? null : a.id); setNotaTesto(''); setNotaError(''); }} aria-expanded={aperto} aria-label={`${aperto ? 'Chiudi' : 'Apri'} dettagli di ${a.nominativo}`} className="flex items-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/20"><ChevronDown size={16} className={`transition-transform ${aperto ? 'rotate-180' : ''}`} /> {aperto ? 'Chiudi dettagli' : 'Dettagli e note'}</button>
          <a href={`${API}/${a.id}/stampa`} target="_blank" rel="noreferrer" title="Apri scheda appuntamento e presentazione aziendale in PDF" className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/70 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-600"><Printer size={16} /> Stampa</a>
          {a.stato === STATO_RICHIESTO_MARKETING ? <button type="button" onClick={() => apriAccettazione(a)} className="flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30"><Check size={16} /> Accetta</button> : inLavorazione && <>
            <button type="button" onClick={() => { setActionError(''); setEsitoForm({ id: a.id, esito: '' }); }} className="rounded-lg bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30">Esita</button>
            <button type="button" onClick={() => annullaAppuntamento(a)} disabled={saving} className="rounded-lg bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/25 disabled:opacity-50">Annulla app</button>
          </>}
          {a.stato !== 'Esitato' && !a.esito && <button type="button" onClick={() => eliminaAppuntamento(a)} disabled={saving} className="rounded-lg border border-red-400/40 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50"><Trash2 size={15} className="inline" /> Elimina definitivamente</button>}
          <button type="button" onClick={() => { setActionError(''); setRifissaForm({ id: a.id, dataOra: a.dataOra, commercialeDipendenteId: a.commercialeDipendenteId || a.idCaposquadra, inAgenda: Boolean(a.agendaImpegnoId) }); }} className="rounded-lg bg-indigo-500/15 px-3 py-2 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/25">Rifissa</button>
          {a.agendaImpegnoId && <Link to={`/admin/ore/agenda?dipendente=${encodeURIComponent(a.idCaposquadra || '')}&data=${a.dataOra.slice(0, 10)}`} className="flex items-center gap-2 rounded-lg bg-slate-700/70 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600"><CalendarDays size={16} /> Agenda</Link>}
          <button type="button" onClick={() => { setError(''); setForm({ ...a, marketing: Boolean(a.marketing), senzaOrario: Boolean(a.senzaOrario) }); }} aria-label={`Modifica ${a.nominativo}`} className="ml-auto flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"><Pencil size={16} /> Modifica</button>
        </div>
        {aperto && <div className="border-t border-[#52637e] bg-[#1c2a40] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-indigo-300">{a.marketing ? 'Visibile nel link esterno' : a.agendaImpegnoId ? 'Creato dall’Agenda Caposquadra' : 'Creato in Appuntamenti'}</p>{!a.marketing && <button type="button" onClick={() => passaAMarketing(a)} disabled={saving} className="rounded-lg bg-fuchsia-500/20 px-3 py-2 text-xs font-semibold text-fuchsia-100 hover:bg-fuchsia-500/30 disabled:opacity-50">Passa a Marketing</button>}</div>
        {a.schedaPdf && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 text-sm text-indigo-100"><FileText size={18} /><strong>Scheda appuntamento PDF</strong><a href={`${import.meta.env.VITE_API_URL || ''}${a.schedaPdf}`} target="_blank" rel="noreferrer" className="underline hover:text-white">Apri</a><a href={`${import.meta.env.VITE_API_URL || ''}${a.schedaPdf}`} download className="flex items-center gap-1 underline hover:text-white"><Download size={15} /> Scarica</a></div>}
        {a.referente && <p className="mt-3 break-words text-sm text-slate-300"><strong>Referente:</strong> {a.referente}</p>}
        {a.telefono && <p className="mt-2 break-words text-sm text-slate-300"><strong>Telefono:</strong> <a href={`tel:${a.telefono.replace(/[^\d+]/g, '')}`} className="text-indigo-200 underline">{a.telefono}</a></p>}
        {a.email && <p className="mt-2 break-words text-sm text-slate-300"><strong>Email:</strong> <a href={`mailto:${a.email}`} className="text-indigo-200 underline">{a.email}</a></p>}
        {a.operatore && <p className="mt-2 break-words text-sm text-slate-300"><strong>Operatore:</strong> {a.operatore}</p>}
        {a.attivita && <p className="mt-3 break-words text-sm text-slate-300"><strong>Attività:</strong> {a.attivita}</p>}
        <div className="mt-4 border-t border-slate-700 pt-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Note appuntamento</h4>
          {a.note ? <div className="mt-2 flex items-start justify-between gap-3 rounded-lg bg-slate-900/60 px-3 py-2 text-sm"><p className="whitespace-pre-wrap break-words text-slate-200">{a.note}</p><div className="flex shrink-0 gap-1"><button type="button" onClick={() => { setError(''); setForm({ ...a, marketing: Boolean(a.marketing), senzaOrario: Boolean(a.senzaOrario) }); }} disabled={saving} className="rounded p-1 text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50" title="Modifica nota appuntamento" aria-label="Modifica nota appuntamento"><Pencil size={16} /></button><button type="button" onClick={() => eliminaNota(a.id)} disabled={saving} className="rounded p-1 text-red-300 hover:bg-red-500/20 disabled:opacity-50" title="Elimina nota appuntamento" aria-label="Elimina nota appuntamento"><Trash2 size={16} /></button></div></div> : <p className="mt-2 text-sm text-slate-500">Nessuna nota nella scheda appuntamento.</p>}
          <div className="mt-5 space-y-2 border-t border-slate-700 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Note post appuntamento</h4>
            {notePost.map(note => <div key={note.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-900/60 px-3 py-2 text-sm">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-indigo-200"><time dateTime={note.creataIl}>{new Date(note.creataIl).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time><span>Autore: {note.autore || 'Marketing'}</span></div><p className="mt-1 whitespace-pre-wrap break-words text-slate-200">{note.testo}</p>{note.modificataIl && <p className="mt-1 text-xs text-slate-400">Modificata il {new Date(note.modificataIl).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })} da {note.modificataDa}</p>}</div>
              <div className="flex shrink-0 gap-1"><button type="button" onClick={() => { setNotaError(''); setNotaInModifica({ appuntamentoId: a.id, id: note.id, testo: note.testo }); }} disabled={saving} className="rounded p-1 text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50" title="Modifica nota" aria-label={`Modifica nota di ${note.autore || 'Marketing'}`}><Pencil size={16} /></button><button type="button" onClick={() => eliminaNota(a.id, note.id)} disabled={saving} className="rounded p-1 text-red-300 hover:bg-red-500/20 disabled:opacity-50" title="Elimina nota post appuntamento" aria-label={`Elimina nota di ${note.autore || 'Marketing'} del ${new Date(note.creataIl).toLocaleDateString('it-IT')}`}><Trash2 size={16} /></button></div>
            </div>)}
            {notePost.length === 0 && <p className="text-sm text-slate-500">Nessuna nota post appuntamento.</p>}
          </div>
          <form onSubmit={event => salvaNota(event, a.id)} className="pt-4"><label className="block text-sm font-semibold text-slate-300">Aggiungi nota post appuntamento<textarea required maxLength={2000} rows={3} value={notaTesto} onChange={event => setNotaTesto(event.target.value)} placeholder="Scrivi una nota post appuntamento…" className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-slate-100" /></label><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-400">Data, ora e autore verranno registrati automaticamente.</span><button type="submit" disabled={saving || !notaTesto.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">Salva nota</button></div>{notaError && <p role="alert" className="mt-2 text-sm text-red-300">{notaError}</p>}</form>
        </div>
        {a.esito && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-sky-200"><strong>Esito:</strong> {a.esito}</p>}
        <div className="mt-4 border-t border-slate-700 pt-3">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Preventivi collegati</h4>
          {preventivi.filter(p => p.appuntamento_id === a.id).map(p => <div key={p.id} className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/60 px-3 py-2 text-sm">
            <span className="font-semibold text-slate-200">{p.numero_preventivo}</span>
            <div className="flex items-center gap-2">
              {p.allegato_preventivo && <><a href={`${import.meta.env.VITE_API_URL || ''}${p.allegato_preventivo}`} target="_blank" rel="noreferrer" className="text-indigo-200 hover:text-white">Apri PDF</a><a href={`${import.meta.env.VITE_API_URL || ''}${p.allegato_preventivo}`} download className="flex items-center gap-1 text-indigo-200 hover:text-white"><Download size={15} /> Scarica</a></>}
              {p.tipo_prezzo !== 'Allegato' && <button type="button" onClick={() => setQuoteToEdit(p)} className="flex items-center gap-1 text-indigo-200 hover:text-white"><Pencil size={15} /> Modifica</button>}
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

  return <div className="space-y-4">
    <div className="rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-800 via-slate-800 to-indigo-950/40 px-4 py-3.5 shadow-[0_12px_30px_rgba(2,6,23,0.12)] sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-300">Gestione commerciale</p><h2 className="text-xl font-extrabold tracking-tight text-white">Appuntamenti</h2></div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copiaLink} disabled={!publicUrl} className="flex items-center gap-2 rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-3 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/25 disabled:opacity-50"><Copy size={15} /> Copia link inserimento</button>
          <button type="button" onClick={apriRiferimenti} className="rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700">Riferimenti aziendali</button>
          <button type="button" onClick={() => { setError(''); setForm({ ...emptyForm }); }} className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-400"><Plus size={17} /> Crea appuntamento</button>
        </div>
      </div>
      {linkMessage && <p role="status" className="mt-2 text-xs text-slate-300">{linkMessage}</p>}
    </div>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    {loading ? <p className="text-slate-400">Caricamento appuntamenti...</p> : <section>
      <div className="mb-3 flex items-center gap-2 lg:hidden"><label className="text-sm font-semibold text-slate-200">Ordina per <select value={ordinamentoAppuntamenti?.key || ''} onChange={event => event.target.value ? cambiaOrdinamento(event.target.value) : setOrdinamentoAppuntamenti(null)} className="ml-2 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-slate-100"><option value="">Ordine predefinito</option>{COLONNE_APPUNTAMENTI.map(colonna => <option key={colonna.key} value={colonna.key}>{colonna.label}</option>)}</select></label><button type="button" disabled={!ordinamentoAppuntamenti} onClick={() => setOrdinamentoAppuntamenti(previous => ({ ...previous, direction: previous.direction === 'asc' ? 'desc' : 'asc' }))} className="rounded-lg border border-slate-600 px-2 py-1.5 text-sm text-slate-200 disabled:opacity-50">{ordinamentoAppuntamenti?.direction === 'desc' ? 'Decrescente' : 'Crescente'}</button></div>
      <div className="rounded-2xl border border-slate-700/80 bg-slate-950/70 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 px-1"><div><h3 className="text-lg font-bold text-white">Elenco appuntamenti</h3><p className="mt-0.5 text-sm text-slate-400">Apri un appuntamento per consultare note e preventivi.</p></div></div>
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-600/80 bg-slate-800/80 px-4 py-3 focus-within:border-indigo-400">
          <Search size={20} className="shrink-0 text-indigo-300" />
          <input type="search" aria-label="Ricerca veloce appuntamenti" placeholder="Ricerca veloce: azienda, referente, via, commerciale, stato..." value={ricercaAppuntamenti} onChange={event => setRicercaAppuntamenti(event.target.value)} className="min-w-[220px] flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400" />
          {ricerca && <span className="text-xs font-semibold text-slate-300">{appuntamentiVisibili.length} risultati</span>}
          {ricerca && <button type="button" onClick={() => setRicercaAppuntamenti('')} aria-label="Cancella ricerca" className="rounded-lg p-1 text-slate-300 hover:bg-slate-700 hover:text-white"><X size={17} /></button>}
        </div>
        <div className="overflow-x-auto"><div className="min-w-0 lg:min-w-[1030px]">
          <div className="mb-2 hidden grid-cols-[125px_minmax(170px,1.2fr)_105px_minmax(170px,1.2fr)_minmax(145px,1fr)_145px] gap-x-5 rounded-xl border border-slate-700/70 bg-slate-800/80 px-5 py-3 text-sm font-bold text-slate-200 lg:grid">{COLONNE_APPUNTAMENTI.map(colonna => <button key={colonna.key} type="button" onClick={() => cambiaOrdinamento(colonna.key)} aria-label={`Ordina per ${colonna.label}, ${ordinamentoAppuntamenti?.key === colonna.key && ordinamentoAppuntamenti.direction === 'asc' ? 'decrescente' : 'crescente'}`} className="flex items-center gap-1.5 text-left hover:text-indigo-200">{colonna.label}{ordinamentoAppuntamenti?.key === colonna.key ? ordinamentoAppuntamenti.direction === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} /> : <ArrowDownUp size={15} className="opacity-60" />}</button>)}</div>
          {renderList(appuntamentiVisibili, ricerca ? 'Nessun appuntamento corrisponde alla ricerca.' : 'Nessun appuntamento.')}
        </div></div>
      </div>
    </section>}

    {riferimenti && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={() => { if (!saving) setRiferimenti(null); }}>
      <form onSubmit={salvaRiferimenti} role="dialog" aria-modal="true" aria-label="Riferimenti aziendali" onMouseDown={event => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Riferimenti aziendali</h2><button type="button" onClick={() => setRiferimenti(null)} aria-label="Chiudi" className="rounded p-1 hover:bg-slate-700"><X size={20} /></button></div>
        <p className="text-sm text-slate-400">Questi recapiti compariranno nella presentazione allegata alla stampa di ogni appuntamento.</p>
        {[
          ['commerciale1Nome', 'Primo commerciale'], ['commerciale1Telefono', 'Telefono primo commerciale'],
          ['commerciale2Nome', 'Secondo commerciale'], ['commerciale2Telefono', 'Telefono secondo commerciale'],
          ['ufficioTelefono', 'Telefono ufficio'], ['email', 'Email']
        ].map(([key, label]) => <label key={key} className="block text-sm font-semibold">{label}<input required maxLength={255} type={key === 'email' ? 'email' : key.includes('Telefono') ? 'tel' : 'text'} value={riferimenti[key] || ''} onChange={event => setRiferimenti(previous => ({ ...previous, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100" /></label>)}
        {riferimentiError && <p role="alert" className="text-sm text-red-300">{riferimentiError}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 disabled:opacity-50">Salva riferimenti</button>
      </form>
    </div>}

    {form && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={() => { if (!saving) setForm(null); }}>
      <form onSubmit={save} role="dialog" aria-modal="true" aria-label={form.id ? 'Modifica appuntamento' : 'Nuovo appuntamento'} onMouseDown={event => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{form.id ? 'Modifica appuntamento' : 'Nuovo appuntamento'}</h2><button type="button" onClick={() => setForm(null)} disabled={saving} aria-label="Chiudi" className="rounded p-1 hover:bg-slate-700"><X size={20} /></button></div>
        {!form.id && <p className="text-sm text-slate-300">L’appuntamento sarà salvato solo in questa sezione, senza comparire nell’Agenda Caposquadra.</p>}
        {error && <p role="alert" className="rounded-lg bg-red-500/10 p-2 text-sm text-red-300">{error}</p>}
        <label className="block text-sm font-medium">Data e ora<input required type="datetime-local" value={form.dataOra} onChange={event => setForm({ ...form, dataOra: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.senzaOrario)} onChange={event => setForm({ ...form, senzaOrario: event.target.checked })} /> Senza orario preciso (in giornata)</label>
        <label className="block text-sm font-medium">Cliente o potenziale cliente<div className="relative mt-1"><UserRound size={17} className="absolute left-3 top-3 text-slate-400" /><input required maxLength={255} value={form.nominativo} onChange={event => setForm({ ...form, nominativo: event.target.value })} className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 pl-10" /></div></label>
        <label className="block text-sm font-medium">Referente<input maxLength={255} value={form.referente || ''} onChange={event => setForm({ ...form, referente: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="block text-sm font-medium">Telefono<input type="tel" autoComplete="tel" maxLength={50} value={form.telefono || ''} onChange={event => setForm({ ...form, telefono: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="block text-sm font-medium">Email<input type="email" autoComplete="email" maxLength={254} value={form.email || ''} onChange={event => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="block text-sm font-medium">Chi lo svolge<input maxLength={200} value={form.incaricato || ''} onChange={event => setForm({ ...form, incaricato: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="block text-sm font-medium">Operatore (facoltativo)<input maxLength={200} value={form.operatore || ''} onChange={event => setForm({ ...form, operatore: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        {form.agendaImpegnoId && <p className="text-xs text-amber-200">Se cambi il commerciale con un nome diverso dal caposquadra assegnato, l’appuntamento verrà scollegato dall’Agenda Caposquadra.</p>}
        <label className="block text-sm font-medium">Attività<input maxLength={300} value={form.attivita || ''} onChange={event => setForm({ ...form, attivita: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="block text-sm font-medium">Luogo<input maxLength={500} value={form.luogo} onChange={event => setForm({ ...form, luogo: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="block text-sm font-medium">Note<textarea rows={3} maxLength={2000} value={form.note} onChange={event => setForm({ ...form, note: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="block text-sm font-medium">Stato<select value={form.stato} onChange={event => setForm({ ...form, stato: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2">{STATI.map(stato => <option key={stato} value={stato}>{stato}</option>)}</select></label>
        {form.stato === 'Esitato' && <label className="block text-sm font-medium">Esito<textarea required rows={3} maxLength={2000} value={form.esito || ''} onChange={event => setForm({ ...form, esito: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" /></label>}
        {form.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.marketing)} onChange={event => setForm({ ...form, marketing: event.target.checked })} /> Visibile nel link Marketing</label>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setForm(null)} disabled={saving} className="rounded-lg border border-slate-600 px-4 py-2 hover:bg-slate-700">Annulla</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{saving ? 'Salvataggio...' : 'Salva'}</button></div>
      </form>
    </div>}

    {notaInModifica && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={() => { if (!saving) setNotaInModifica(null); }}>
      <form onSubmit={salvaModificaNota} role="dialog" aria-modal="true" aria-label="Modifica nota" onMouseDown={event => event.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-5 text-slate-100 shadow-2xl">
        <h2 className="text-xl font-bold">Modifica nota</h2>
        <label className="block text-sm font-medium">Testo<textarea required maxLength={2000} rows={5} value={notaInModifica.testo} onChange={event => setNotaInModifica({ ...notaInModifica, testo: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" /></label>
        {notaError && <p role="alert" className="text-sm text-red-300">{notaError}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setNotaInModifica(null)} disabled={saving} className="rounded-lg border border-slate-600 px-4 py-2">Annulla</button><button type="submit" disabled={saving || !notaInModifica.testo.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-50">Salva nota</button></div>
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
    {quoteToEdit && <NuovoPreventivoModal preventivo={quoteToEdit} onClose={() => setQuoteToEdit(null)} onSuccess={async () => { setQuoteToEdit(null); await load(); }} />}
  </div>;
}
