import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Building2, 
  FileText, 
  Upload, 
  Trash2, 
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { 
  recuperaDatiAzienda, 
  salvaDatiAzienda, 
  recuperaDocumentiAzienda, 
  uploadDocumentoAzienda 
} from '../../api/azienda';
import ModernModal from '../../components/ui/ModernModal';
import { companyStampUrl } from '../../utils/companyStampUrl';
import { workflowRequest } from '../../api/workflowElaborati';
import { campiVisuraAzienda, campiAziendaDaVisura } from './visuraAziendaCampi';

const campiVisuraAggiuntivi = campiVisuraAzienda.filter(([key]) => !campiAziendaDaVisura.includes(key));

export default function SchedaAzienda() {
  const [loading, setLoading] = useState(true);
  const [dati, setDati] = useState({
    ragioneSociale: '',
    sedeLegale: '',
    sedeOperativa: '',
    pec: '',
    email: '',
    telefono: '',
    rea: '',
    partitaIva: '',
    codiceFiscale: '',
    formaGiuridica: '',
    dataCostituzione: '',
    amministratoreUnico: '',
    capitaleSociale: '',
    codiceAteco: '',
    visuraDati: {},
    posizioneInps: '',
    posizioneInail: '',
    numeroPolizzaRct: '2021/03/2430364',
    compagniaPolizzaRct: '',
    timbro_path: '',
    logo_path: '',
    legaleRappresentante: '',
    indirizzoRappresentante: '',
    fatturazione_indirizzo: '', fatturazione_cap: '', fatturazione_citta: '',
    fatturazione_provincia: '', fatturazione_paese: '', fatturazione_id_paese_iva: '', fatturazione_regime: '',
    fatturazione_iban: '', fatturazione_banca: '', fatturazione_ufficio_rea: '', fatturazione_numero_rea: '',
    fatturazione_socio_unico: '', fatturazione_stato_liquidazione: ''
  });
  
  const [documenti, setDocumenti] = useState([]);
  const [salvataggio, setSalvataggio] = useState(false);
  const [messaggio, setMessaggio] = useState(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });
  const [visuraFile, setVisuraFile] = useState(null);
  const [visuraAnteprima, setVisuraAnteprima] = useState(null);
  const [visuraInLettura, setVisuraInLettura] = useState(false);
  const [visuraInSalvataggio, setVisuraInSalvataggio] = useState(false);
  const [visuraErrore, setVisuraErrore] = useState('');

  useEffect(() => {
    caricaDati();
  }, []);

  const caricaDati = async () => {
    try {
      setLoading(true);
      const resDati = await recuperaDatiAzienda();
      if (resDati) {
        setDati({
          ragioneSociale: resDati.ragione_sociale || '',
          sedeLegale: resDati.sede_legale || '',
          sedeOperativa: resDati.sede_operativa || '',
          pec: resDati.pec || '',
          email: resDati.email || '',
          telefono: resDati.telefono || '',
          rea: resDati.rea || '',
          partitaIva: resDati.partita_iva || '',
          codiceFiscale: resDati.codice_fiscale || '',
          formaGiuridica: resDati.forma_giuridica || '',
          dataCostituzione: resDati.data_costituzione || '',
          amministratoreUnico: resDati.amministratore_unico || '',
          capitaleSociale: resDati.capitale_sociale || '',
          codiceAteco: resDati.codice_ateco || '',
          visuraDati: (() => { try { return JSON.parse(resDati.visura_dati_json || '{}'); } catch { return {}; } })(),
          posizioneInps: resDati.posizione_inps || '',
          posizioneInail: resDati.posizione_inail || '',
          numeroPolizzaRct: resDati.numero_polizza_rct || '2021/03/2430364',
          compagniaPolizzaRct: resDati.compagnia_polizza_rct || '',
          timbro_path: resDati.timbro_path || '',
          logo_path: resDati.logo_path || '',
          ...Object.fromEntries(['fatturazione_indirizzo', 'fatturazione_cap', 'fatturazione_citta', 'fatturazione_provincia', 'fatturazione_paese', 'fatturazione_id_paese_iva', 'fatturazione_regime', 'fatturazione_iban', 'fatturazione_banca', 'fatturazione_ufficio_rea', 'fatturazione_numero_rea', 'fatturazione_socio_unico', 'fatturazione_stato_liquidazione'].map(key => [key, resDati[key] || '']))
        });
      }
      const resDocs = await recuperaDocumentiAzienda();
      setDocumenti(resDocs || []);
    } catch (error) {
      console.error("Errore caricamento dati azienda:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDati(prev => ({ ...prev, [name]: value }));
  };

  const handleVisura = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setVisuraErrore('');
    if (!/\.pdf$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
      setVisuraErrore('Carica una visura PDF di massimo 10 MB.'); return;
    }
    setVisuraFile(file); setVisuraInLettura(true);
    try {
      const body = new FormData(); body.append('file', file);
      const result = await workflowRequest('azienda/visura/anteprima', { method: 'POST', body });
      setVisuraAnteprima(result);
    } catch (error) { setVisuraErrore(error.message || 'Impossibile leggere la visura.'); }
    finally { setVisuraInLettura(false); }
  };

  const confermaVisura = async () => {
    if (!visuraAnteprima || !visuraFile || visuraInSalvataggio) return;
    const values = visuraAnteprima.dati;
    if (dati.partitaIva && values.partitaIva && dati.partitaIva.replace(/\D/g, '') !== values.partitaIva.replace(/\D/g, '')) {
      setVisuraErrore('La Partita IVA della visura è diversa da quella nella scheda M2I. Verifica di aver caricato il documento corretto.');
      return;
    }
    setVisuraInSalvataggio(true); setVisuraErrore('');
    let datiSalvati = false;
    try {
      const updates = Object.fromEntries(campiAziendaDaVisura.filter(key => String(values[key] || '').trim())
        .map(key => [key, String(values[key]).trim()]));
      const next = { ...dati, ...updates, visuraDati: { ...dati.visuraDati, ...values } };
      await salvaDatiAzienda(next);
      datiSalvati = true;
      setDati(next);
      await uploadDocumentoAzienda(visuraFile, `Visura camerale M2I ${values.dataVisura || ''}`.trim());
      setDocumenti(await recuperaDocumentiAzienda());
      setVisuraAnteprima(null); setVisuraFile(null);
      setMessaggio({ tipo: 'success', testo: 'Visura allegata e dati M2I aggiornati.' });
    } catch (error) {
      setVisuraErrore(datiSalvati
        ? 'I dati sono stati salvati, ma il PDF non è stato allegato. Riprova il caricamento.'
        : error.message || 'Impossibile salvare i dati della visura.');
    } finally { setVisuraInSalvataggio(false); }
  };

  const handleSalva = async () => {
    try {
      setSalvataggio(true);
      await salvaDatiAzienda(dati);
      setMessaggio({ tipo: 'success', testo: 'Dati azienda salvati con successo!' });
      setTimeout(() => setMessaggio(null), 3000);
    } catch  {
      setMessaggio({ tipo: 'error', testo: 'Errore nel salvataggio.' });
    } finally {
      setSalvataggio(false);
    }
  };

  const handleUploadTimbro = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const res = await uploadDocumentoAzienda(file, 'Timbro Aziendale');
      const newPath = res.path;
      // Aggiorniamo subito il db
      await salvaDatiAzienda({ ...dati, timbro_path: newPath });
      setDati(prev => ({ ...prev, timbro_path: newPath }));
      setMessaggio({ tipo: 'success', testo: 'Timbro aggiornato con successo!' });
      setTimeout(() => setMessaggio(null), 3000);
    } catch  {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Attenzione',
        content: 'Errore caricamento timbro',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
    }
  };

  const handleUploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!/\.(png|jpe?g)$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
      setMessaggio({ tipo: 'error', testo: 'Carica un logo PNG o JPG fino a 10 MB, compatibile con PDF e Word.' });
      return;
    }
    try {
      const result = await uploadDocumentoAzienda(file, 'Logo Aziendale', false);
      await salvaDatiAzienda({ ...dati, logo_path: result.path });
      setDati(current => ({ ...current, logo_path: result.path }));
      setMessaggio({ tipo: 'success', testo: 'Logo aziendale aggiornato.' });
    } catch {
      setMessaggio({ tipo: 'error', testo: 'Impossibile caricare il logo aziendale.' });
    }
  };

  const handleUploadDocumento = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const nomePersonalizzato = prompt("Inserisci il nome del documento (es. Visura Camerale):", file.name);
    if (!nomePersonalizzato) return;

    try {
      await uploadDocumentoAzienda(file, nomePersonalizzato);
      await caricaDati();
      setMessaggio({ tipo: 'success', testo: 'Documento caricato con successo!' });
      setTimeout(() => setMessaggio(null), 3000);
    } catch  {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Attenzione',
        content: 'Errore caricamento documento',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
    }
  };

  const handleEliminaDocumento = async (id) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo documento?")) return;
    try {
      await eliminaDocumentoAzienda(id);
      await caricaDati();
    } catch  {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Attenzione',
        content: 'Errore eliminazione documento',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
    }
  };

  if (loading) return <div className="p-8 text-slate-300">Caricamento dati azienda...</div>;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto pb-24">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-indigo-400" />
            Dati e Documenti M2I
          </h1>
          <p className="text-slate-400 mt-2">
            Gestisci i dati della società e i documenti ufficiali (Visura, Statuto, etc.)
          </p>
        </div>
        
        <button 
          onClick={handleSalva}
          disabled={salvataggio}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {salvataggio ? 'Salvataggio...' : 'Salva Modifiche'}
        </button>
      </div>

      {messaggio && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${messaggio.tipo === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{messaggio.testo}</span>
        </div>
      )}

      <section className="mb-8 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-5 text-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="text-lg font-bold">Visura camerale M2I</h2>
            <p className="mt-1 text-sm text-slate-300">Carica il PDF, verifica i campi letti e conferma. I dati non trovati restano come sono; la visura viene conservata negli allegati.</p></div>
          <label className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500">
            <Upload size={16} className="mr-2 inline" />{visuraInLettura ? 'Lettura in corso…' : 'Carica visura M2I'}
            <input type="file" accept="application/pdf,.pdf" onChange={handleVisura} disabled={visuraInLettura || visuraInSalvataggio} className="hidden" />
          </label>
        </div>
        {visuraErrore && !visuraAnteprima && <p role="alert" className="mt-3 text-sm text-red-200">{visuraErrore}</p>}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Dati */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-sm">
            <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700 flex items-center gap-3">
              <FileText className="w-5 h-5 text-indigo-400" />
              <h2 className="font-bold text-slate-100 uppercase tracking-wide">Dati Societari (Estratti da Visura)</h2>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Ragione Sociale</label>
                <input type="text" name="ragioneSociale" value={dati.ragioneSociale} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-100 font-bold" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Sede Legale</label>
                <input type="text" name="sedeLegale" value={dati.sedeLegale} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">Sede Operativa</label>
                <input type="text" name="sedeOperativa" value={dati.sedeOperativa} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Partita IVA</label>
                <input type="text" name="partitaIva" value={dati.partitaIva} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200 font-mono" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Codice Fiscale</label>
                <input type="text" name="codiceFiscale" value={dati.codiceFiscale} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200 font-mono" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Numero REA</label>
                <input type="text" name="rea" value={dati.rea} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200 uppercase" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Forma Giuridica</label>
                <input type="text" name="formaGiuridica" value={dati.formaGiuridica} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Data Costituzione</label>
                <input type="text" name="dataCostituzione" value={dati.dataCostituzione} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Amministratore Unico</label>
                <input type="text" name="amministratoreUnico" value={dati.amministratoreUnico} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Capitale Sociale</label>
                <input type="text" name="capitaleSociale" value={dati.capitaleSociale} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Codice ATECO</label>
                <input type="text" name="codiceAteco" value={dati.codiceAteco} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Posizione INPS</label>
                <input type="text" name="posizioneInps" value={dati.posizioneInps} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200 font-mono" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Posizione INAIL</label>
                <input type="text" name="posizioneInail" value={dati.posizioneInail} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200 font-mono" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Numero polizza RCT</label>
                <input type="text" name="numeroPolizzaRct" value={dati.numeroPolizzaRct} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200 font-mono" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Compagnia polizza RCT</label>
                <input type="text" name="compagniaPolizzaRct" value={dati.compagniaPolizzaRct} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">PEC</label>
                <input type="email" name="pec" value={dati.pec} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email Ordinaria</label>
                <input type="email" name="email" value={dati.email} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Telefono Aziendale</label>
                <input type="text" name="telefono" value={dati.telefono} onChange={handleChange} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6">
            <h2 className="mb-2 font-bold text-slate-100">Altri dati della visura</h2>
            <p className="mb-5 text-sm text-slate-400">Queste caselle restano modificabili anche dopo il caricamento.</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{campiVisuraAggiuntivi.map(([key, label, type]) =>
              <label key={key} className={`text-sm text-slate-300 ${type === 'textarea' ? 'md:col-span-2' : ''}`}>{label}
                {type === 'textarea' ? <textarea rows={key === 'oggettoSociale' ? 6 : 3} value={dati.visuraDati?.[key] || ''}
                  onChange={event => setDati(current => ({ ...current, visuraDati: { ...current.visuraDati, [key]: event.target.value } }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2 text-slate-100" /> :
                  <input value={dati.visuraDati?.[key] || ''}
                    onChange={event => setDati(current => ({ ...current, visuraDati: { ...current.visuraDati, [key]: event.target.value } }))}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2 text-slate-100" />}
              </label>)}</div>
          </div>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <h2 className="mb-4 font-bold text-slate-100">Dati fatturazione elettronica M2I</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['fatturazione_indirizzo', 'Indirizzo fiscale'], ['fatturazione_cap', 'CAP'],
                ['fatturazione_citta', 'Comune'], ['fatturazione_provincia', 'Provincia'],
                ['fatturazione_paese', 'Paese (es. IT)'], ['fatturazione_id_paese_iva', 'Paese partita IVA (es. IT)'],
                ['fatturazione_regime', 'Regime fiscale (es. RF01)'],
                ['fatturazione_iban', 'IBAN incasso'], ['fatturazione_banca', 'Banca per incassi'],
                ['fatturazione_ufficio_rea', 'Ufficio REA'],
                ['fatturazione_numero_rea', 'Numero REA'], ['fatturazione_socio_unico', 'Socio unico'],
                ['fatturazione_stato_liquidazione', 'Stato liquidazione']
              ].map(([key, label]) => <label key={key} className="text-sm text-slate-300">{label}
                <input name={key} value={dati[key] || ''} onChange={handleChange} maxLength={key === 'fatturazione_banca' ? 80 : undefined} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2 text-slate-100" />
              </label>)}
            </div>
          </div>
        </div>

        {/* Sidebar Destra: Timbro e Documenti */}
        <div className="space-y-8">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-sm">
            <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-indigo-400" />
                <h2 className="font-bold text-slate-100 uppercase tracking-wide">Logo aziendale</h2>
              </div>
              <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition-colors" title="Carica o sostituisci il logo">
                <Upload className="w-4 h-4 text-slate-300" />
                <input type="file" className="hidden" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={handleUploadLogo} aria-label="Carica logo aziendale" />
              </label>
            </div>
            <div className="p-6 flex flex-col items-center justify-center min-h-[180px] bg-slate-900/30">
              {companyStampUrl(dati.logo_path) ?
                <img src={companyStampUrl(dati.logo_path)} alt="Logo aziendale M2I" className="max-h-40 max-w-full object-contain rounded-lg bg-white p-3" /> :
                <p className="text-sm text-slate-400">Nessun logo caricato</p>}
              <p className="mt-3 text-xs text-slate-400">PNG o JPG · massimo 10 MB</p>
            </div>
          </div>
          
          {/* Timbro Aziendale */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-sm">
            <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-emerald-400" />
                <h2 className="font-bold text-slate-100 uppercase tracking-wide">Timbro e Firma</h2>
              </div>
              <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition-colors" title="Carica nuovo timbro">
                <Upload className="w-4 h-4 text-slate-300" />
                <input type="file" className="hidden" accept="image/*" onChange={handleUploadTimbro} />
              </label>
            </div>
            <div className="p-6 flex flex-col items-center justify-center min-h-[200px] bg-slate-900/30">
              {dati.timbro_path ? (
                <div className="relative group">
                  <img src={`/${dati.timbro_path}?t=${new Date().getTime()}`} alt="Timbro Aziendale" className="max-h-48 object-contain bg-white p-2 rounded-lg" />
                </div>
              ) : (
                <div className="text-center text-slate-500 flex flex-col items-center gap-2">
                  <ImageIcon className="w-12 h-12 opacity-30" />
                  <p className="text-sm font-medium">Nessun timbro caricato</p>
                </div>
              )}
            </div>
          </div>

          {/* Documenti Aziendali */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-sm">
            <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-amber-400" />
                <h2 className="font-bold text-slate-100 uppercase tracking-wide">Allegati</h2>
              </div>
              <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition-colors" title="Carica documento">
                <Upload className="w-4 h-4 text-slate-300" />
                <input type="file" className="hidden" onChange={handleUploadDocumento} />
              </label>
            </div>
            
            <div className="p-4 flex flex-col gap-3 max-h-[400px] overflow-y-auto">
              {documenti.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Nessun documento allegato.</p>
              ) : (
                documenti.map(doc => (
                  <div key={doc.id} className="bg-slate-900/50 p-3 border border-slate-700 rounded-xl flex items-center justify-between group">
                    <a href={`/${doc.file_path}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-indigo-400 text-slate-300 transition-colors flex-1 overflow-hidden">
                      <div className="p-2 bg-slate-800 rounded-lg shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="truncate text-sm font-medium">
                        {doc.nome}
                      </div>
                    </a>
                    <button 
                      onClick={() => handleEliminaDocumento(doc.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                      title="Elimina Documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>
      </div>
      <ModernModal 
        {...alertModal}
        onClose={() => setAlertModal({ isOpen: false })}
      />
      {visuraAnteprima && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-5">
        <div role="dialog" aria-modal="true" aria-label="Verifica visura camerale M2I" className="max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-5 text-slate-100 shadow-2xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Verifica dati della visura M2I</h2>
            <p className="mt-1 text-sm text-slate-300">{visuraFile?.name} · {visuraAnteprima.pagine} pagine. {visuraAnteprima.letturaOcr ? 'Lettura OCR: controlla con attenzione.' : 'Correggi i campi prima di salvare.'}</p></div>
            <button type="button" onClick={() => { setVisuraAnteprima(null); setVisuraFile(null); setVisuraErrore(''); }} disabled={visuraInSalvataggio} className="rounded-lg bg-slate-700 px-4 py-2 font-semibold disabled:opacity-50">Chiudi</button></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{campiVisuraAzienda.map(([key, label, type]) =>
            <label key={key} className={`text-sm font-semibold ${type === 'textarea' ? 'sm:col-span-2 lg:col-span-3' : ''}`}>{label}
              {type === 'textarea' ? <textarea rows={key === 'oggettoSociale' ? 6 : 3} value={visuraAnteprima.dati[key] || ''}
                onChange={event => setVisuraAnteprima(current => ({ ...current, dati: { ...current.dati, [key]: event.target.value } }))}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white" /> :
                <input value={visuraAnteprima.dati[key] || ''}
                  onChange={event => setVisuraAnteprima(current => ({ ...current, dati: { ...current.dati, [key]: event.target.value } }))}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white" />}
            </label>)}</div>
          {visuraErrore && <p role="alert" className="mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-200">{visuraErrore}</p>}
          <button type="button" onClick={confermaVisura} disabled={visuraInSalvataggio} className="mt-5 rounded-lg bg-indigo-600 px-5 py-3 font-bold hover:bg-indigo-500 disabled:opacity-50">{visuraInSalvataggio ? 'Salvataggio…' : 'Salva dati e allega PDF'}</button>
        </div>
      </div>}
    </div>
  );
}
