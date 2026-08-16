import React, { useState, useEffect } from 'react';
import { FileText, UploadCloud, CheckCircle2, AlertCircle, Download, RefreshCw, Save, Trash2, Mail, X } from 'lucide-react';
import FileUploader from '../../components/ui/FileUploader';
import ModernModal from '../../components/ui/ModernModal';
import { recuperaElencoDipendenti } from '../../api/dipendenti';
import { recuperaTuttiIDipendenti } from '../../api/dipendenti';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api';

export default function BustePaga() {
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [anno, setAnno] = useState(new Date().getFullYear());
  
  const [activeTab, setActiveTab] = useState('upload'); // upload, list

  const mesi = [
    { val: 1, label: 'Gennaio' }, { val: 2, label: 'Febbraio' }, { val: 3, label: 'Marzo' },
    { val: 4, label: 'Aprile' }, { val: 5, label: 'Maggio' }, { val: 6, label: 'Giugno' },
    { val: 7, label: 'Luglio' }, { val: 8, label: 'Agosto' }, { val: 9, label: 'Settembre' },
    { val: 10, label: 'Ottobre' }, { val: 11, label: 'Novembre' }, { val: 12, label: 'Dicembre' }
  ];

  // Upload state
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [dbDipendenti, setDbDipendenti] = useState([]);
  const [statoUpload, setStatoUpload] = useState('idle'); // idle, preview, done

  // List state
  const [busteCaricate, setBusteCaricate] = useState([]);
  const [isLoadingBuste, setIsLoadingBuste] = useState(false);

  // Selection & Email state
  const [selectedBusteIds, setSelectedBusteIds] = useState(new Set());
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showMissingEmailModal, setShowMissingEmailModal] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', content: '', primaryAction: null });
  const [busteSenzaEmail, setBusteSenzaEmail] = useState([]);
  const [busteConEmail, setBusteConEmail] = useState([]);
  const [emailManualInput, setEmailManualInput] = useState({});
  const [sendResultModal, setSendResultModal] = useState(null);
  const [allDipendentiMap, setAllDipendentiMap] = useState({});

  useEffect(() => {
    // Carica dipendenti per la tendina
    recuperaElencoDipendenti()
      .then(data => setDbDipendenti(data || []))
      .catch(err => console.error(err));
    // Carica mappa dipendenti con email
    recuperaTuttiIDipendenti()
      .then(data => {
        const map = {};
        (data || []).forEach(d => { map[d.id] = d; });
        setAllDipendentiMap(map);
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (activeTab === 'list') {
      caricaBusteMese();
    }
    setSelectedBusteIds(new Set());
  }, [activeTab, mese, anno]);

  // Selection helpers
  const toggleSelectBusta = (id) => {
    setSelectedBusteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedBusteIds.size === busteCaricate.length) {
      setSelectedBusteIds(new Set());
    } else {
      setSelectedBusteIds(new Set(busteCaricate.map(b => b.id)));
    }
  };

  // Email sending flow
  const handleInviaPerEmail = () => {
    const selected = busteCaricate.filter(b => selectedBusteIds.has(b.id));
    if (selected.length === 0) return;

    const conEmail = [];
    const senzaEmail = [];

    selected.forEach(b => {
      const dip = allDipendentiMap[b.id_dipendente];
      const email = dip?.email;
      if (email && email.trim() !== '') {
        conEmail.push({ ...b, email, dipendente: `${b.cognome} ${b.nome}` });
      } else {
        senzaEmail.push({ ...b, dipendente: `${b.cognome} ${b.nome}`, id_dipendente: b.id_dipendente });
      }
    });

    setBusteConEmail(conEmail);
    setBusteSenzaEmail(senzaEmail);
    setEmailManualInput({});

    if (senzaEmail.length > 0) {
      setShowMissingEmailModal(true);
    } else {
      inviaEmailEffettivo(conEmail);
    }
  };

  const handleConfirmMissingEmail = () => {
    const extraBuste = [];
    const emailUpdates = [];
    busteSenzaEmail.forEach(b => {
      const manualEmail = emailManualInput[b.id];
      if (manualEmail && manualEmail.trim() !== '') {
        extraBuste.push({ ...b, email: manualEmail.trim() });
        emailUpdates.push({ id_dipendente: b.id_dipendente, email: manualEmail.trim() });
      }
      // else ignored
    });
    setShowMissingEmailModal(false);
    inviaEmailEffettivo([...busteConEmail, ...extraBuste], emailUpdates);
  };

  const inviaEmailEffettivo = async (busteToSend, emailDipendentiUpdate = []) => {
    if (busteToSend.length === 0) {
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: 'Attenzione',
        content: 'Nessuna busta paga da inviare (tutti ignorati o senza email).',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
      return;
    }
    setIsSendingEmail(true);
    try {
      const meseLabel = mesi.find(m => m.val === mese)?.label || '';
      const payload = busteToSend.map(b => ({
        id: b.id,
        dipendente: b.dipendente,
        email: b.email,
        allegato_busta_paga: b.allegato_busta_paga,
        mese_label: meseLabel,
        anno
      }));

      const res = await fetch(`${API_URL}/buste-paga/invia-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buste: payload, emailDipendentiUpdate })
      });
      const data = await res.json();
      if (data.success) {
        setSendResultModal(data);
        setSelectedBusteIds(new Set());
        caricaBusteMese();
      } else {
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Errore',
          content: 'Errore: ' + data.error,
          primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
        });
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Errore di connessione',
        content: err.message,
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
    }
    setIsSendingEmail(false);
  };

  const caricaBusteMese = async () => {
    setIsLoadingBuste(true);
    try {
      const res = await fetch(`${API_URL}/buste-paga/mese?mese=${mese}&anno=${anno}`);
      const data = await res.json();
      if (data.success) {
        setBusteCaricate(data.buste);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoadingBuste(false);
  };

  const handleFileSelect = (selectedFiles) => {
    if (Array.isArray(selectedFiles)) {
      setFiles(selectedFiles);
    } else if (selectedFiles) {
      setFiles([selectedFiles]);
    } else {
      setFiles([]);
    }
  };

  const handleAnteprima = async () => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch(API_URL + '/buste-paga/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData(data.files.map(f => ({ ...f, updateCF: false })));
        setStatoUpload('preview');
      } else {
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Errore',
          content: 'Errore: ' + data.error,
          primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
        });
      }
    } catch (err) {
      console.error(err);
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Attenzione',
        content: 'Errore di connessione',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
    }
    setIsUploading(false);
  };

  const handleConferma = async () => {
    setIsUploading(true);
    try {
      const res = await fetch(API_URL + '/buste-paga/conferma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bustePaga: previewData, mese, anno })
      });
      const data = await res.json();
      if (data.success) {
        setStatoUpload('done');
        setFiles([]);
        setTimeout(() => setStatoUpload('idle'), 3000);
      } else {
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Errore',
          content: 'Errore: ' + data.error,
          primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
        });
      }
    } catch (err) {
      console.error(err);
    }
    setIsUploading(false);
  };

  const eliminaBusta = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa busta paga? Il file verrà rimosso definitivamente.')) return;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/buste-paga/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        caricaBusteMese(); // ricarica la lista
      } else {
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Errore',
          content: 'Errore durante l\'eliminazione: ' + data.error,
          primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
        });
      }
    } catch (err) {
      console.error(err);
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Attenzione',
        content: 'Errore di connessione',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
    }
  };

  const eliminaTutteMese = async () => {
    if (!window.confirm(`Sei assolutamente sicuro di voler eliminare TUTTE le buste paga caricate per ${mesi.find(m => m.val === mese).label} ${anno}? L'operazione non è reversibile.`)) return;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/buste-paga/mese/${anno}/${mese}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        caricaBusteMese();
      } else {
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Errore',
          content: 'Errore durante l\'eliminazione: ' + data.error,
          primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
        });
      }
    } catch (err) {
      console.error(err);
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Attenzione',
        content: 'Errore di connessione',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
    }
  };

  const updatePreviewRow = (idx, field, value) => {

    const newData = [...previewData];
    newData[idx][field] = value;
    setPreviewData(newData);
  };

  const rimuoviRiga = (idx) => {
    const newData = [...previewData];
    newData.splice(idx, 1);
    setPreviewData(newData);
    if (newData.length === 0) {
      setStatoUpload('idle');
      setFiles([]);
    }
  };


  const totaleNetti = busteCaricate.reduce((acc, curr) => acc + (curr.importo_netto || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
          <FileText className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Gestione Buste Paga</h1>
          <p className="text-slate-400 text-sm">Carica e consulta le buste paga mensili dei dipendenti</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-700">
        <button 
          onClick={() => setActiveTab('upload')}
          className={`pb-3 px-4 text-sm font-bold transition-colors ${activeTab === 'upload' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Carica Buste Paga
        </button>
        <button 
          onClick={() => setActiveTab('list')}
          className={`pb-3 px-4 text-sm font-bold transition-colors ${activeTab === 'list' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Riepilogo Mese
        </button>
      </div>

      <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-6 md:p-8 space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-900/50 rounded-xl border border-slate-700">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Mese di Riferimento</label>
            <select 
              value={mese} 
              onChange={(e) => setMese(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {mesi.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Anno</label>
            <input 
              type="number" 
              value={anno} 
              onChange={(e) => setAnno(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {activeTab === 'upload' && (
          <div className="space-y-4">
            {statoUpload === 'idle' && (
              <>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <UploadCloud className="w-4 h-4" /> Seleziona i File (PDF)
                </h3>
                
                <div className="p-6 bg-slate-800 border border-dashed border-slate-600 rounded-xl">
                  <FileUploader 
                    multiple={true}
                    file={files.length > 0 ? files[0] : null}
                    onFileSelect={handleFileSelect} 
                    label={`Trascina qui le buste paga (PDF) di ${mesi.find(m => m.val === mese).label} ${anno}`}
                  />
                  {files.length > 1 && (
                    <div className="mt-3 text-center text-sm text-indigo-400 font-medium">
                      Hai selezionato {files.length} file pronti per l'analisi.
                    </div>
                  )}
                  {files.length > 0 && (
                    <button
                      onClick={handleAnteprima}
                      disabled={isUploading}
                      className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      {isUploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                      {isUploading ? 'Analisi in corso...' : 'Analizza e Associa'}
                    </button>
                  )}
                </div>
              </>
            )}

            {statoUpload === 'preview' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                    Anteprima Associazione ({previewData.length} file)
                  </h3>
                  <button
                    onClick={() => { setStatoUpload('idle'); setFiles([]); setPreviewData([]); }}
                    className="text-sm text-slate-400 hover:text-slate-200"
                  >
                    Annulla
                  </button>
                </div>
                
                <div className="overflow-x-auto rounded-xl border border-slate-700">
                  <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs uppercase bg-slate-900/80 text-slate-400">
                      <tr>
                        <th className="px-4 py-3">File PDF</th>
                        <th className="px-4 py-3">C.F. Estratto</th>
                        <th className="px-4 py-3">Dipendente (Match)</th>
                        <th className="px-4 py-3 w-32">Netto Busta (€)</th>
                        <th className="px-4 py-3">Azioni CF</th>
                        <th className="px-4 py-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50 bg-slate-800">
                      {previewData.map((row, idx) => (
                        <tr key={idx} className={!row.dipendenteId ? 'bg-red-500/10' : ''}>
                          <td className="px-4 py-3 truncate max-w-[150px]" title={row.originalName}>{row.originalName}</td>
                          <td className="px-4 py-3 font-mono text-xs">{row.extractedCF || 'Non trovato'}</td>
                          <td className="px-4 py-3">
                            <select
                              value={row.dipendenteId}
                              onChange={(e) => updatePreviewRow(idx, 'dipendenteId', e.target.value)}
                              className={`w-full p-2 bg-slate-900 border rounded outline-none ${!row.dipendenteId ? 'border-red-500 text-red-400' : 'border-slate-600 text-slate-200'}`}
                            >
                              <option value="">-- Seleziona Dipendente --</option>
                              {dbDipendenti.map(d => (
                                <option key={d.id} value={d.id}>{d.nomeCompleto} ({d.codiceFiscale || 'No CF'})</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.01"
                              value={row.extractedNetto || ''}
                              onChange={(e) => updatePreviewRow(idx, 'extractedNetto', e.target.value)}
                              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-slate-200"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {row.extractedCF && row.dipendenteId && (() => {
                              const dip = dbDipendenti.find(d => d.id === row.dipendenteId);
                              if (dip && dip.codiceFiscale && dip.codiceFiscale.toUpperCase() === row.extractedCF.toUpperCase()) {
                                return (
                                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                                    <CheckCircle2 className="w-4 h-4" /> CF OK
                                  </span>
                                );
                              }
                              return (
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={row.updateCF}
                                    onChange={(e) => updatePreviewRow(idx, 'updateCF', e.target.checked)}
                                    className="rounded border-slate-600 bg-slate-900 text-indigo-500"
                                  />
                                  Aggiorna DB
                                </label>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => rimuoviRiga(idx)}
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Rimuovi pagina"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={handleConferma}
                    disabled={isUploading || previewData.some(r => !r.dipendenteId)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isUploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {isUploading ? 'Salvataggio...' : 'Conferma e Salva Tutto'}
                  </button>
                </div>
                {previewData.some(r => !r.dipendenteId) && (
                  <p className="text-red-400 text-sm text-center">Attenzione: assegna un dipendente a tutti i file prima di salvare.</p>
                )}
              </div>
            )}

            {statoUpload === 'done' && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-400">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <div>
                  <p className="font-bold text-lg">Buste Paga caricate e archiviate!</p>
                  <p className="text-sm opacity-90">Tutti i cedolini sono stati associati correttamente ai dipendenti.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'list' && (
          <div className="space-y-4">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Buste Paga di {mesi.find(m => m.val === mese).label} {anno}
                </h3>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-slate-400 text-sm">Totale dipendenti pagati: {busteCaricate.length}</p>
                  {busteCaricate.length > 0 && (
                    <button
                      onClick={eliminaTutteMese}
                      className="text-xs text-red-400 hover:text-red-300 hover:underline flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Elimina tutte le {busteCaricate.length} buste paga di questo mese
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {selectedBusteIds.size > 0 && (
                  <button
                    onClick={handleInviaPerEmail}
                    disabled={isSendingEmail}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg disabled:opacity-50"
                  >
                    {isSendingEmail ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    {isSendingEmail ? 'Invio in corso...' : `Invia per Email (${selectedBusteIds.size})`}
                  </button>
                )}
                <div className="text-right">
                  <p className="text-sm text-slate-400 uppercase font-bold tracking-wide">Totale Netti Mese</p>
                  <p className="text-3xl font-bold text-emerald-400">€ {totaleNetti.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {isLoadingBuste ? (
              <div className="text-center py-12 text-slate-400"><RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 opacity-50" /> Caricamento...</div>
            ) : busteCaricate.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-900/50 rounded-xl border border-slate-700 border-dashed">
                Nessuna busta paga archiviata per questo mese.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs uppercase bg-slate-900/80 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 w-12">
                        <input 
                          type="checkbox"
                          checked={selectedBusteIds.size === busteCaricate.length && busteCaricate.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-indigo-500 cursor-pointer"
                          style={{ accentColor: '#818cf8' }}
                        />
                      </th>
                      <th className="px-4 py-3">Dipendente</th>
                      <th className="px-4 py-3">C.F.</th>
                      <th className="px-4 py-3 text-right">Netto Busta</th>
                      <th className="px-4 py-3 text-center">Email</th>
                      <th className="px-4 py-3 text-center w-32">Azioni</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-700/50 bg-slate-800">
                    {busteCaricate.map(b => (
                      <tr key={b.id} className={`transition-colors ${selectedBusteIds.has(b.id) ? 'bg-indigo-500/10' : 'hover:bg-slate-700/30'}`}>
                        <td className="px-4 py-3">
                          <input 
                            type="checkbox"
                            checked={selectedBusteIds.has(b.id)}
                            onChange={() => toggleSelectBusta(b.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-indigo-500 cursor-pointer"
                            style={{ accentColor: '#818cf8' }}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-200">{b.cognome} {b.nome}</td>
                        <td className="px-4 py-3 font-mono text-xs">{b.codice_fiscale}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-400">€ {(b.importo_netto || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          {b.email_inviata ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 rounded-full text-xs font-bold" title={`Inviata il ${b.data_invio_email || ''}`}>
                              <Mail className="w-3.5 h-3.5" /> Inviata
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-700/50 text-slate-500 rounded-full text-xs font-medium">
                              — Non inviata
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {b.allegato_busta_paga ? (
                              <a 
                                href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/${b.allegato_busta_paga}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex p-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 rounded-lg transition-colors"
                                title="Scarica PDF"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            ) : (
                              <span className="text-slate-500 text-xs inline-flex p-2">-</span>
                            )}
                            <button
                              onClick={() => eliminaBusta(b.id)}
                              className="inline-flex p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                              title="Elimina Busta Paga"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL: Dipendenti senza email */}
      {showMissingEmailModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-slate-800 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Dipendenti senza E-mail</h3>
                  <p className="text-sm text-slate-400">Inserisci l'email o ignora per non inviare</p>
                </div>
              </div>
              <button onClick={() => setShowMissingEmailModal(false)} className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {busteSenzaEmail.map(b => (
                <div key={b.id} className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                  <div className="flex-1">
                    <p className="font-medium text-slate-200">{b.dipendente}</p>
                    <p className="text-xs text-slate-500">Nessuna email associata</p>
                  </div>
                  <input 
                    type="email"
                    placeholder="Inserisci email..."
                    value={emailManualInput[b.id] || ''}
                    onChange={(e) => setEmailManualInput(prev => ({ ...prev, [b.id]: e.target.value }))}
                    className="w-64 p-2.5 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-700 bg-slate-900/30">
              <button 
                onClick={() => setShowMissingEmailModal(false)}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl transition-colors"
              >
                Annulla
              </button>
              <button 
                onClick={handleConfirmMissingEmail}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Conferma e Invia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Risultato invio */}
      {sendResultModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-100">Risultato Invio</h3>
              </div>
              <button onClick={() => setSendResultModal(null)} className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-slate-200 font-medium mb-4">{sendResultModal.message}</p>
              {sendResultModal.risultati && sendResultModal.risultati.map((r, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${r.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  {r.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${r.success ? 'text-emerald-300' : 'text-red-300'}`}>{r.dipendente}</p>
                    {r.error && <p className="text-xs text-red-400 truncate">{r.error}</p>}
                  </div>
                  <span className={`text-xs font-bold ${r.success ? 'text-emerald-400' : 'text-red-400'}`}>{r.success ? 'INVIATA' : 'FALLITA'}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end p-6 border-t border-slate-700 bg-slate-900/30">
              <button 
                onClick={() => setSendResultModal(null)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
