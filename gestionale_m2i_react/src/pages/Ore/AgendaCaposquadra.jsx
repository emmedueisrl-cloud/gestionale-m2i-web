import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Plus, Trash2, Pencil, Loader2, Clock, Shield, Download, Eraser, Link2, Copy, Sparkles, Paintbrush, Users, MapPin, PackageCheck, Building2, ShoppingCart } from 'lucide-react';
import { recuperaElencoDipendenti, impostaCaposquadra } from '../../api/dipendenti';
import { recuperaElencoClienti } from '../../api/clienti';
import { recuperaDatiAgenda, salvaImpegnoAgenda, modificaImpegnoAgenda, eliminaImpegnoAgenda, importaProgrammaFissoAgenda, svuotaSettimanaAgenda } from '../../api/ore';
import ModernModal from '../../components/ui/ModernModal';
import { nomeClienteAgenda } from '../../utils/nomeClienteAgenda';
import { inizioSettimanaAgenda, trovaSovrapposizioniAgenda } from '../../utils/sovrapposizioniAgenda';

const TIPI_IMPEGNO = ['Pulizie Ordinarie', 'Sgrosso', 'Affiancamento', 'Sopralluogo', 'Consegna prodotti', 'Ufficio', 'Acquisto prodotti'];
const SCELTE_IMPEGNO = [
  { nome: 'Pulizie Ordinarie', icona: Sparkles, stile: 'border-sky-500/50 bg-sky-500/15 text-sky-200' },
  { nome: 'Sgrosso', icona: Paintbrush, stile: 'border-orange-500/50 bg-orange-500/15 text-orange-200' },
  { nome: 'Affiancamento', icona: Users, stile: 'border-violet-500/50 bg-violet-500/15 text-violet-200' },
  { nome: 'Sopralluogo', icona: MapPin, stile: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' },
  { nome: 'Consegna prodotti', icona: PackageCheck, stile: 'border-amber-500/50 bg-amber-500/15 text-amber-200' },
  { nome: 'Ufficio', icona: Building2, stile: 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200' },
  { nome: 'Acquisto prodotti', icona: ShoppingCart, stile: 'border-pink-500/50 bg-pink-500/15 text-pink-200' }
];
const COLORI_IMPEGNO = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function CampiImpegno({ impegno, onChange, capisquadra, clienti, error, allowModeChange = false }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <label className="block text-sm font-medium text-slate-200 sm:col-span-2">Tipo di impegno
      <select value={impegno.tipoImpegno} onChange={event => onChange('tipoImpegno', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-100">
        <option value="">-- Seleziona il tipo --</option>
        {TIPI_IMPEGNO.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
      </select>
    </label>
    <label className="block text-sm font-medium text-slate-200">Caposquadra
      <select value={impegno.idDipendente} onChange={event => onChange('idDipendente', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-100">
        <option value="">-- Seleziona caposquadra --</option>
        {capisquadra.map(d => <option key={d.id} value={d.id}>{d.nomeCompleto}</option>)}
      </select>
    </label>
    <label className="block text-sm font-medium text-slate-200">Data
      <input type="date" value={impegno.data} onChange={event => onChange('data', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-100" />
    </label>
    <div className="sm:col-span-2">
      <span className="block text-sm font-medium text-slate-200">Modalità</span>
      {allowModeChange ? <div className="mt-1 flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange('senzaOrario', false)} className={`rounded-lg px-3 py-2 text-sm ${!impegno.senzaOrario ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>Con orario programmato</button>
        <button type="button" onClick={() => onChange('senzaOrario', true)} className={`rounded-lg px-3 py-2 text-sm ${impegno.senzaOrario ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>Da fare in giornata</button>
      </div> : <p className="mt-1 text-sm text-indigo-200">{impegno.senzaOrario ? 'Da fare in giornata · senza orario' : 'Con orario programmato'}</p>}
    </div>
    {!impegno.senzaOrario && <>
      <label className="block text-sm font-medium text-slate-200">Inizio
        <input type="time" value={impegno.oraInizio} onChange={event => onChange('oraInizio', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-100" />
      </label>
      <label className="block text-sm font-medium text-slate-200">Fine (facoltativa)
        <input type="time" value={impegno.oraFine || ''} onChange={event => onChange('oraFine', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-100" />
      </label>
    </>}
    {impegno.tipoImpegno === 'Sopralluogo' ? <>
      <label className="block text-sm font-medium text-slate-200 sm:col-span-2">Attività
        <input type="text" value={impegno.attivita || ''} onChange={event => onChange('attivita', event.target.value)} maxLength={300} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-100" />
      </label>
      <label className="block text-sm font-medium text-slate-200 sm:col-span-2">Nome referente
        <input type="text" value={impegno.nomeReferente || ''} onChange={event => onChange('nomeReferente', event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-100" />
      </label>
      <label className="block text-sm font-medium text-slate-200 sm:col-span-2">Indirizzo
        <input type="text" value={impegno.indirizzo || ''} onChange={event => onChange('indirizzo', event.target.value)} maxLength={500} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-100" />
      </label>
    </> : impegno.tipoImpegno === 'Ufficio' ? <p className="sm:col-span-2 rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-slate-200">Destinazione: <strong>Ufficio M2I</strong></p>
      : impegno.tipoImpegno === 'Acquisto prodotti' ? <label className="block text-sm font-medium text-slate-200 sm:col-span-2">Luogo (facoltativo)
        <input type="text" value={impegno.luogoAcquisto || ''} onChange={event => onChange('luogoAcquisto', event.target.value)} maxLength={300} placeholder="Dove acquistare i prodotti" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-100" />
      </label> : <label className="block text-sm font-medium text-slate-200 sm:col-span-2">Cliente / destinazione
        <select value={impegno.idCliente} onChange={event => onChange('idCliente', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-100">
          <option value="">-- Nessun Cliente --</option>
          {clienti.map(c => <option key={c.id} value={c.id}>{c.ragione_sociale}</option>)}
        </select>
      </label>}
    <label className="block text-sm font-medium text-slate-200 sm:col-span-2">Note
      <textarea value={impegno.note} onChange={event => onChange('note', event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-100" />
    </label>
    <div className="sm:col-span-2">
      <span className="block text-sm font-medium text-slate-200">Colore</span>
      <div className="mt-2 flex flex-wrap gap-3">
        {COLORI_IMPEGNO.map(color => <button key={color} type="button" onClick={() => onChange('colore', color)} aria-label={`Colore ${color}`} aria-pressed={impegno.colore === color} className={`h-8 w-8 rounded-full border-2 ${impegno.colore === color ? 'border-white ring-2 ring-indigo-400' : 'border-transparent'}`} style={{ backgroundColor: color }} />)}
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-red-400 sm:col-span-2">{error}</p>}
  </div>;
}

export default function AgendaCaposquadra() {
  const [searchParams] = useSearchParams();
  const [linkedDate] = useState(() => searchParams.get('data'));
  const [dipendenti, setDipendenti] = useState([]);
  const [clienti, setClienti] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGestioneCapisquadraOpen, setIsGestioneCapisquadraOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [publicToken, setPublicToken] = useState('');
  const [linkMessage, setLinkMessage] = useState('');
  
  const [idDipendente, setIdDipendente] = useState(() => searchParams.get('dipendente') || 'all');
  // Gestione data: lunedì della settimana in visualizzazione
  const [dataInizioSettimana, setDataInizioSettimana] = useState('');
  
  const [impegni, setImpegni] = useState([]);
  const [modalState, setModalState] = useState({ isOpen: false, type: '', message: '' });

  // Nuovo impegno
  const [isSceltaImpegnoOpen, setIsSceltaImpegnoOpen] = useState(false);
  const [tipoScelto, setTipoScelto] = useState('');
  const [nuovoImpegno, setNuovoImpegno] = useState(null);
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [impegnoInModifica, setImpegnoInModifica] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [sovrapposizione, setSovrapposizione] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/agenda-public-link`, { credentials: 'same-origin' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Link non disponibile')))
      .then(result => setPublicToken(result.token))
      .catch(() => setLinkMessage('Link pubblico non disponibile.'));
    // Imposta dataInizioSettimana al lunedì della settimana corrente
    const requestedDate = linkedDate && /^\d{4}-\d{2}-\d{2}$/.test(linkedDate) ? new Date(`${linkedDate}T12:00:00`) : null;
    const today = requestedDate && !Number.isNaN(requestedDate.getTime()) ? requestedDate : new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const lunedi = new Date(today.setDate(diff));
    const getLocalISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDataInizioSettimana(getLocalISODate(lunedi));

    async function loadFiltri() {
      try {
        const [dips, clis] = await Promise.all([
          recuperaElencoDipendenti(),
          recuperaElencoClienti()
        ]);
        setDipendenti(dips || []);
        setClienti(clis || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadFiltri();
  }, [linkedDate]);

  useEffect(() => {
    if (idDipendente && dataInizioSettimana) {
      caricaAgenda();
    } else {
      setImpegni([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDipendente, dataInizioSettimana]);

  async function caricaAgenda() {
    setIsLoading(true);
    try {
      const dati = await recuperaDatiAgenda(idDipendente, dataInizioSettimana);
      setImpegni(dati || []);
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore nel caricamento dell\'agenda.' });
    } finally {
      setIsLoading(false);
    }
  }

  const apriAggiungi = () => {
    setTipoScelto('');
    setIsSceltaImpegnoOpen(true);
  };

  const scegliModalita = senzaOrario => {
    setAddError('');
    setNuovoImpegno({ idDipendente: idDipendente === 'all' ? '' : idDipendente, tipoImpegno: tipoScelto, senzaOrario, data: dataInizioSettimana, oraInizio: senzaOrario ? '' : '08:00', oraFine: '', idCliente: '', attivita: '', nomeReferente: '', indirizzo: '', luogoAcquisto: '', note: '', colore: '#4f46e5' });
    setIsSceltaImpegnoOpen(false);
  };

  const aggiornaAggiungi = (campo, valore) => setNuovoImpegno(prev => ({ ...prev, [campo]: valore }));

  const mostraImpegno = async imp => {
    const lunedi = inizioSettimanaAgenda(imp.data);
    if ((idDipendente !== 'all' && imp.idDipendente !== idDipendente) || lunedi !== dataInizioSettimana) {
      if (idDipendente !== 'all') setIdDipendente(imp.idDipendente);
      setDataInizioSettimana(lunedi);
    } else await caricaAgenda();
  };

  const salvaConControlloOrario = async (imp, modalita, salvaComunque = false) => {
    const modifica = modalita === 'modifica';
    const setSaving = modifica ? setIsSavingEdit : setIsAdding;
    const setError = modifica ? setEditError : setAddError;
    setSaving(true);
    setError('');
    try {
      if (!salvaComunque && !imp.senzaOrario) {
        const esistenti = await recuperaDatiAgenda(imp.idDipendente, inizioSettimanaAgenda(imp.data));
        const sovrapposti = trovaSovrapposizioniAgenda(imp, esistenti || []);
        if (sovrapposti.length) {
          setSovrapposizione({ imp, modalita, sovrapposti });
          return;
        }
      }
      if (modifica) await modificaImpegnoAgenda(imp.id, imp);
      else await salvaImpegnoAgenda(imp);
      if (modifica) setImpegnoInModifica(null);
      else setNuovoImpegno(null);
      await mostraImpegno(imp);
    } catch (err) {
      console.error(err);
      setError(err.message || (modifica ? 'Errore durante la modifica dell’impegno.' : 'Errore nel salvataggio.'));
    } finally {
      setSaving(false);
    }
  };

  const handleAggiungi = async () => {
    if (!nuovoImpegno?.tipoImpegno || !nuovoImpegno.idDipendente || !nuovoImpegno.data || (!nuovoImpegno.senzaOrario && !nuovoImpegno.oraInizio)) {
      setAddError('Compila tipo, caposquadra, data e, se previsto, ora di inizio.');
      return;
    }
    if (nuovoImpegno.tipoImpegno === 'Sopralluogo' && (!nuovoImpegno.attivita.trim() || !nuovoImpegno.nomeReferente.trim() || !nuovoImpegno.indirizzo.trim())) {
      setAddError('Per il sopralluogo compila attività, nome referente e indirizzo.');
      return;
    }
    await salvaConControlloOrario(nuovoImpegno, 'aggiungi');
  };

  const handleElimina = async (idImpegno) => {
    try {
      await eliminaImpegnoAgenda(idImpegno);
      await caricaAgenda();
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore durante l\'eliminazione.' });
    }
  };

  const apriModifica = imp => {
    setEditError('');
    setImpegnoInModifica({
      id: imp.id, idDipendente: imp.idDipendente, data: imp.data, tipoImpegno: imp.tipoImpegno || '',
      senzaOrario: Boolean(imp.senzaOrario), oraInizio: imp.oraInizio, oraFine: imp.oraFine || '',
      idCliente: imp.idCliente || '', attivita: imp.attivita || '', nomeReferente: imp.nomeReferente || '', indirizzo: imp.indirizzo || '', luogoAcquisto: imp.luogoAcquisto || '', colore: imp.colore || '#4f46e5', note: imp.note || ''
    });
  };

  const aggiornaModifica = (campo, valore) => setImpegnoInModifica(prev => campo === 'senzaOrario'
    ? (prev.senzaOrario === valore ? prev : { ...prev, senzaOrario: valore, oraInizio: valore ? '' : '08:00', oraFine: '' })
    : { ...prev, [campo]: valore });

  const handleModifica = async () => {
    if (!impegnoInModifica) return;
    const imp = impegnoInModifica;
    if (!imp.tipoImpegno || !imp.data || !imp.idDipendente || (!imp.senzaOrario && !imp.oraInizio)) {
      setEditError('Compila tipo, caposquadra, data e, se previsto, ora di inizio.');
      return;
    }
    if (imp.tipoImpegno === 'Sopralluogo' && (!imp.attivita.trim() || !imp.nomeReferente.trim() || !imp.indirizzo.trim())) {
      setEditError('Per il sopralluogo compila attività, nome referente e indirizzo.');
      return;
    }
    await salvaConControlloOrario(imp, 'modifica');
  };

  // Costruisci array dei 7 giorni
  const giorniSettimana = [];
  if (dataInizioSettimana) {
    const start = new Date(dataInizioSettimana);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      giorniSettimana.push(d);
    }
  }

  const cambiaSettimana = (offset) => {
    const d = new Date(dataInizioSettimana);
    d.setDate(d.getDate() + (offset * 7));
    const getLocalISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDataInizioSettimana(getLocalISODate(d));
  };

  const handleToggleCaposquadra = async (id, currentState) => {
    setIsToggling(true);
    try {
      await impostaCaposquadra(id, !currentState);
      const dips = await recuperaElencoDipendenti();
      setDipendenti(dips || []);
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore durante l\'aggiornamento.' });
    } finally {
      setIsToggling(false);
    }
  };

  const handleImportaProgramma = async () => {
    if (!idDipendente || !dataInizioSettimana) return;
    if (!window.confirm('Vuoi importare il programma fisso per questa settimana? Gli impegni verranno aggiunti a quelli esistenti.')) return;
    
    setIsImporting(true);
    try {
      await importaProgrammaFissoAgenda(idDipendente, dataInizioSettimana);
      await caricaAgenda();
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore durante l\'importazione del programma.' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSvuotaSettimana = async () => {
    if (!idDipendente || !dataInizioSettimana) return;
    if (!window.confirm('Attenzione: sei sicuro di voler ELIMINARE TUTTI gli impegni di questa settimana per questo dipendente?')) return;
    
    setIsImporting(true);
    try {
      await svuotaSettimanaAgenda(idDipendente, dataInizioSettimana);
      await caricaAgenda();
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore durante lo svuotamento della settimana.' });
    } finally {
      setIsImporting(false);
    }
  };

  const capisquadra = dipendenti.filter(d => d.is_caposquadra === 1);
  const publicUrl = publicToken ? `${window.location.origin}/agenda/${publicToken}` : '';

  const copiaLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setLinkMessage('Link copiato. Chi lo possiede può visualizzare gli impegni.');
    } catch {
      setLinkMessage('Copia il link dal campo qui sotto.');
    }
  };

  return (
    <div className="p-6 w-full mx-auto">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 rounded-xl">
            <Calendar className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-50">Agenda Caposquadra</h1>
            <p className="text-slate-400 text-sm">Pianificazione puntuale settimanale</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={apriAggiungi} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500">
            <Plus className="h-4 w-4" /> Aggiungi impegno
          </button>
          <select 
            value={idDipendente} 
            onChange={(e) => setIdDipendente(e.target.value)}
            className="p-2 bg-slate-800 border border-slate-600 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[250px] shadow-sm"
          >
            <option value="all">Tutti i caposquadra</option>
            {capisquadra.map(d => (
              <option key={d.id} value={d.id}>{d.nomeCompleto} ({d.id})</option>
            ))}
          </select>
          <button
            onClick={() => setIsGestioneCapisquadraOpen(true)}
            className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl hover:bg-indigo-600/30 transition-colors"
            title="Gestione Capisquadra"
          >
            <Shield className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-100"><Link2 className="h-4 w-4" /> Agenda pubblica per i caposquadra <span className="font-normal text-slate-400">· sola lettura</span></div>
          <button type="button" onClick={copiaLink} disabled={!publicUrl} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Copy className="h-4 w-4" /> Copia link</button>
        </div>
        {publicUrl && <input aria-label="Link agenda pubblica" readOnly onFocus={event => event.target.select()} value={publicUrl} className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs text-slate-300" />}
        {linkMessage && <p role="status" className="mt-2 text-xs text-slate-300">{linkMessage}</p>}
      </div>

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-800/70 z-10 flex items-center justify-center text-indigo-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}

        {!idDipendente ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-slate-400">
            <Calendar className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Seleziona un dipendente per visualizzare l'agenda</p>
          </div>
        ) : (
          <div>
            
            {/* Calendario Visivo */}
            <div>
              {/* Header Navigazione */}
              <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
                  <button onClick={() => cambiaSettimana(-1)} className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded hover:bg-slate-700 text-sm font-medium transition-colors">Precedente</button>
                  <button onClick={() => cambiaSettimana(1)} className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded hover:bg-slate-700 text-sm font-medium transition-colors">Successiva</button>
                </div>
                
                <div className="font-bold text-slate-200">
                  Settimana dal {giorniSettimana[0]?.toLocaleDateString('it-IT')} al {giorniSettimana[6]?.toLocaleDateString('it-IT')}
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                  {idDipendente !== 'all' && <><button
                    onClick={handleSvuotaSettimana}
                    disabled={isImporting} 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 text-red-400 border border-red-500/30 rounded hover:bg-red-600/30 text-sm font-medium transition-colors disabled:opacity-50"
                    title="Pulisci settimana"
                  >
                    <Eraser className="w-4 h-4" /> 
                    <span className="hidden md:inline">Svuota</span>
                  </button>
                  <button 
                    onClick={handleImportaProgramma}
                    disabled={isImporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded hover:bg-indigo-600/30 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="hidden md:inline">Importa Prog.</span>
                  </button></>}
                </div>
              </div>

              {/* Colonne Giorni */}
              <div className="flex overflow-x-auto">
                {giorniSettimana.map((giorno, idx) => {
                  const formatLocalISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const dataStr = formatLocalISODate(giorno);
                  const impegniGiorno = impegni.filter(i => i.data === dataStr).sort((a, b) => Number(a.senzaOrario) - Number(b.senzaOrario) || a.oraInizio.localeCompare(b.oraInizio));
                  const isToday = dataStr === formatLocalISODate(new Date());

                  return (
                    <div key={idx} className={`flex-1 min-w-[225px] border-r border-slate-800 flex flex-col ${isToday ? 'bg-indigo-500/10/30' : ''}`}>
                      <div className={`p-1.5 md:p-2 text-center border-b border-slate-700 ${isToday ? 'bg-indigo-500/20 text-indigo-800' : 'bg-slate-900/50 text-slate-300'}`}>
                        <div className="text-[10px] md:text-xs uppercase font-bold tracking-wider">{giorno.toLocaleDateString('it-IT', { weekday: 'short' })}</div>
                        <div className="text-base md:text-lg font-black">{giorno.getDate()}</div>
                      </div>
                      <div className="p-1 md:p-2 space-y-1 md:space-y-2">
                        {impegniGiorno.map((imp, impIndex) => (
                          <React.Fragment key={imp.id}>
                          {imp.senzaOrario && (impIndex === 0 || !impegniGiorno[impIndex - 1].senzaOrario) && <div className="border-t border-slate-600 pt-2 text-[10px] font-bold uppercase tracking-wide text-indigo-200">Da fare in giornata</div>}
                          <div
                            className="p-1.5 md:p-2 rounded border shadow-sm text-[10px] 2xl:text-xs relative group cursor-default break-words"
                            style={{ backgroundColor: `${imp.colore}15`, borderColor: `${imp.colore}40`, borderLeftWidth: '4px', borderLeftColor: imp.colore }}
                          >
                            <div className="font-bold mb-0.5 md:mb-1 text-slate-50 flex items-center gap-1 whitespace-nowrap">
                              {!imp.senzaOrario && <Clock className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" />}
                              <span>{imp.senzaOrario ? 'Senza orario' : `${imp.oraInizio}${imp.oraFine ? ` - ${imp.oraFine}` : ''}`}</span>
                              <span title={imp.tipoImpegno || 'Modifica l’impegno per assegnare un tipo'} className="rounded-full bg-indigo-500/25 px-1.5 py-0.5 text-[9px] font-semibold leading-tight text-indigo-100">{imp.tipoImpegno || 'Da classificare'}</span>
                            </div>
                            {idDipendente === 'all' && <div className="mb-1 text-[10px] font-bold text-indigo-200 break-words">{imp.nomeCaposquadra}</div>}
                            {imp.tipoImpegno === 'Sopralluogo' && imp.statoAppuntamento && imp.statoAppuntamento !== 'Programmato' && <div className="mb-1 text-[10px] font-semibold text-amber-200">{imp.statoAppuntamento}</div>}
                            <div className="font-medium text-slate-200 leading-tight break-words" style={{ wordBreak: 'break-word', hyphens: 'auto' }}>
                              {imp.tipoImpegno === 'Sopralluogo' ? <>
                                {imp.attivita && <div>Attività: {imp.attivita}</div>}
                                {imp.nomeReferente && <div>Referente: {imp.nomeReferente}</div>}
                                {imp.indirizzo && <div>Indirizzo: {imp.indirizzo}</div>}
                              </> : imp.tipoImpegno === 'Ufficio' ? 'Ufficio M2I'
                                : imp.tipoImpegno === 'Acquisto prodotti' ? (imp.luogoAcquisto ? `Luogo: ${imp.luogoAcquisto}` : '')
                                  : <span title={imp.cliente}>{nomeClienteAgenda(imp.cliente)}</span>}
                            </div>
                            {imp.note && <div className="text-[9px] 2xl:text-[10px] text-slate-400 mt-1 italic leading-tight break-words">{imp.note}</div>}
                            <div className="mt-2 flex justify-end gap-1 border-t border-slate-600/50 pt-1">
                              <button type="button" onClick={() => apriModifica(imp)} aria-label={`Modifica impegno del ${imp.data}${imp.senzaOrario ? ' senza orario' : ` dalle ${imp.oraInizio}`}`} title="Modifica impegno" className="flex h-7 w-7 items-center justify-center rounded text-indigo-200 hover:bg-indigo-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"><Pencil className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => handleElimina(imp.id)} aria-label={`Elimina impegno del ${imp.data}${imp.senzaOrario ? ' senza orario' : ` dalle ${imp.oraInizio}`}`} title="Elimina impegno" className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-red-500/20 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>

      <ModernModal
        isOpen={isSceltaImpegnoOpen}
        onClose={() => setIsSceltaImpegnoOpen(false)}
        type={null}
        title="Che impegno vuoi aggiungere?"
        maxWidth="max-w-xl"
        textAlign="text-left"
        secondaryAction={{ label: 'Annulla', onClick: () => setIsSceltaImpegnoOpen(false) }}
      >
        <div role="group" aria-label="Tipo di impegno" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SCELTE_IMPEGNO.map(({ nome, icona: Icona, stile }) => <button
            key={nome}
            type="button"
            aria-pressed={tipoScelto === nome}
            onClick={() => setTipoScelto(nome)}
            className={`flex aspect-square min-h-28 flex-col items-center justify-center gap-3 rounded-xl border-2 p-3 text-center text-sm font-semibold leading-tight transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${stile} ${tipoScelto === nome ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-slate-800' : ''}`}
          ><Icona className="h-7 w-7 shrink-0" aria-hidden="true" /><span>{nome}</span></button>)}
        </div>
        {tipoScelto && <div className="mt-6 space-y-3">
          <p className="text-sm font-semibold text-slate-200">Come va programmato?</p>
          <button type="button" onClick={() => scegliModalita(false)} className="w-full rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-4 text-left text-sm font-semibold text-indigo-100 hover:bg-indigo-500/20">Con orario programmato<span className="mt-1 block font-normal text-slate-400">Indica l’ora di inizio e, se serve, quella di fine.</span></button>
          <button type="button" onClick={() => scegliModalita(true)} className="w-full rounded-xl border border-slate-600 bg-slate-900/60 p-4 text-left text-sm font-semibold text-slate-100 hover:bg-slate-700">Senza orario · da fare in giornata<span className="mt-1 block font-normal text-slate-400">Compare in fondo agli impegni del giorno.</span></button>
        </div>}
      </ModernModal>

      <ModernModal
        isOpen={Boolean(nuovoImpegno) && !sovrapposizione}
        onClose={() => { if (!isAdding) setNuovoImpegno(null); }}
        type={null}
        title="Aggiungi impegno"
        maxWidth="max-w-xl"
        textAlign="text-left"
        primaryAction={{ label: isAdding ? 'Salvataggio...' : 'Salva impegno', onClick: handleAggiungi, disabled: isAdding }}
        secondaryAction={{ label: 'Annulla', onClick: () => setNuovoImpegno(null), disabled: isAdding }}
      >
        {nuovoImpegno && <CampiImpegno impegno={nuovoImpegno} onChange={aggiornaAggiungi} capisquadra={capisquadra} clienti={clienti} error={addError} />}
      </ModernModal>

      <ModernModal
        isOpen={Boolean(impegnoInModifica) && !sovrapposizione}
        onClose={() => { if (!isSavingEdit) setImpegnoInModifica(null); }}
        type={null}
        title="Modifica impegno"
        maxWidth="max-w-xl"
        textAlign="text-left"
        primaryAction={{ label: isSavingEdit ? 'Salvataggio...' : 'Salva modifiche', onClick: handleModifica, disabled: isSavingEdit }}
        secondaryAction={{ label: 'Annulla', onClick: () => setImpegnoInModifica(null), disabled: isSavingEdit }}
      >
        {impegnoInModifica && <CampiImpegno impegno={impegnoInModifica} onChange={aggiornaModifica} capisquadra={capisquadra} clienti={clienti} error={editError} allowModeChange />}
      </ModernModal>

      <ModernModal
        isOpen={Boolean(sovrapposizione)}
        onClose={() => { if (!isAdding && !isSavingEdit) setSovrapposizione(null); }}
        type="warning"
        title="Orario già occupato"
        maxWidth="max-w-xl"
        textAlign="text-left"
        primaryAction={{ label: 'Salva comunque', onClick: async () => {
          const scelta = sovrapposizione;
          setSovrapposizione(null);
          await salvaConControlloOrario(scelta.imp, scelta.modalita, true);
        }, disabled: isAdding || isSavingEdit }}
        secondaryAction={{ label: 'Cambia orario', onClick: () => setSovrapposizione(null), disabled: isAdding || isSavingEdit }}
      >
        {sovrapposizione && <div className="space-y-3 text-sm text-slate-200">
          <p>Il {new Date(`${sovrapposizione.imp.data}T12:00:00`).toLocaleDateString('it-IT')} {capisquadra.find(d => d.id === sovrapposizione.imp.idDipendente)?.nomeCompleto || 'la caposquadra'} ha già {sovrapposizione.sovrapposti.length === 1 ? 'un impegno' : `${sovrapposizione.sovrapposti.length} impegni`} in questo orario:</p>
          <ul className="space-y-2">
            {sovrapposizione.sovrapposti.map(imp => <li key={imp.id} className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"><strong>{imp.tipoImpegno || 'Impegno'}</strong> · {imp.oraInizio}{imp.oraFine ? ` – ${imp.oraFine}` : ' (senza ora di fine)'}</li>)}
          </ul>
          <p>Puoi modificare l’orario oppure salvare comunque i due impegni sovrapposti.</p>
        </div>}
      </ModernModal>

      <ModernModal 
        isOpen={isGestioneCapisquadraOpen}
        type="info"
        title="Gestione Capisquadra"
        subtitle="Seleziona i dipendenti abilitati come Capisquadra"
        content={
          <div className="max-h-[60vh] overflow-y-auto pr-2 mt-4 space-y-2">
            {dipendenti.length === 0 ? (
              <p className="text-slate-400 text-center py-4">Nessun dipendente trovato.</p>
            ) : (
              dipendenti.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-200">{d.nomeCompleto}</span>
                    <span className="text-xs text-slate-400">{d.id} - {d.codiceFiscale}</span>
                  </div>
                  <button
                    onClick={() => handleToggleCaposquadra(d.id, d.is_caposquadra === 1)}
                    disabled={isToggling}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      d.is_caposquadra === 1 ? 'bg-indigo-600' : 'bg-slate-600'
                    } ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        d.is_caposquadra === 1 ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))
            )}
          </div>
        }
        primaryAction={{
          label: 'Chiudi',
          onClick: () => setIsGestioneCapisquadraOpen(false)
        }}
        onClose={() => setIsGestioneCapisquadraOpen(false)}
      />

      <ModernModal 
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.type === 'error' ? 'Errore' : 'Avviso'}
        message={modalState.message}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />
    </div>
  );
}
