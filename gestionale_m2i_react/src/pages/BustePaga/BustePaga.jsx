import React, { useState, useEffect, useCallback, useRef } from 'react';
import { attachmentUrl } from '../../utils/attachmentUrl';
import { FileText, UploadCloud, CheckCircle2, AlertCircle, Download, RefreshCw, Save, Trash2, Mail, X } from 'lucide-react';
import FileUploader from '../../components/ui/FileUploader';
import ModernModal from '../../components/ui/ModernModal';

import { recuperaTuttiIDipendenti } from '../../api/dipendenti';

const API_URL = (import.meta.env.VITE_API_URL || '') + '/api';

function periodoBusteAllApertura() {
  const data = new Date();
  if (data.getDate() <= 10) data.setMonth(data.getMonth() - 1);
  return { mese: data.getMonth() + 1, anno: data.getFullYear() };
}

export default function BustePaga() {
  const [periodoIniziale] = useState(periodoBusteAllApertura);
  const [mese, setMese] = useState(periodoIniziale.mese);
  const [anno, setAnno] = useState(periodoIniziale.anno);
  
  const [showUpload, setShowUpload] = useState(false);
  const [targetDipendente, setTargetDipendente] = useState(null);
  const uploadPanelRef = useRef(null);
  const listRef = useRef(null);
  const loadSequence = useRef(0);
  const [uploadMessage, setUploadMessage] = useState('');

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
  const [isLoadingDipendenti, setIsLoadingDipendenti] = useState(true);
  const [dipendentiError, setDipendentiError] = useState('');
  const [statoUpload, setStatoUpload] = useState('idle'); // idle, preview

  // List state
  const [busteCaricate, setBusteCaricate] = useState([]);
  const [isLoadingBuste, setIsLoadingBuste] = useState(false);
  const [busteError, setBusteError] = useState('');

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
  const [deletePrompt, setDeletePrompt] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const caricaBusteMese = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setIsLoadingBuste(true);
    setBusteError('');
    try {
      const res = await fetch(`${API_URL}/buste-paga/mese?mese=${mese}&anno=${anno}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Impossibile caricare le buste paga del mese.');
      if (sequence === loadSequence.current) setBusteCaricate(data.buste);
    } catch (e) {
      if (sequence === loadSequence.current) { setBusteCaricate([]); setBusteError(e.message); }
    }
    if (sequence === loadSequence.current) setIsLoadingBuste(false);
  }, [mese, anno]);

  const caricaDipendenti = useCallback(async () => {
    setIsLoadingDipendenti(true);
    setDipendentiError('');
    try {
      const data = await recuperaTuttiIDipendenti();
      setAllDipendentiMap(Object.fromEntries((data || []).map(d => [d.id, d])));
    } catch (err) { setDipendentiError(err.message || 'Impossibile caricare i dipendenti.'); }
    finally { setIsLoadingDipendenti(false); }
  }, []);

  useEffect(() => {
    caricaDipendenti();
  }, [caricaDipendenti]);

  useEffect(() => {
    setUploadMessage('');
    caricaBusteMese();
    setSelectedBusteIds(new Set());
  }, [caricaBusteMese]);

  const apriCaricamento = (dipendente = null) => {
    setUploadMessage('');
    setTargetDipendente(dipendente);
    setFiles([]);
    setPreviewData([]);
    setStatoUpload('idle');
    setShowUpload(true);
    window.requestAnimationFrame(() => uploadPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const chiudiCaricamento = () => {
    if (isUploading) return;
    setShowUpload(false);
    setTargetDipendente(null);
    setFiles([]);
    setPreviewData([]);
    setStatoUpload('idle');
  };

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
      const dip = allDipendentiMap[b.dipendente_id];
      const email = dip?.email;
      if (email && email.trim() !== '') {
        conEmail.push({ ...b, email, dipendente: `${b.cognome} ${b.nome}` });
      } else {
        senzaEmail.push({ ...b, dipendente: `${b.cognome} ${b.nome}`, id_dipendente: b.dipendente_id });
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
        setStatoUpload('idle');
        setFiles([]);
        setPreviewData([]);
        await caricaBusteMese();
        setShowUpload(false);
        setTargetDipendente(null);
        setUploadMessage('Buste paga salvate. Le trovi nel mese selezionato.');
        window.requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
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
      setAlertModal({ isOpen: true, type: 'error', title: 'Conferma non ricevuta',
        content: 'Non è stato possibile verificare il salvataggio. Puoi riprovare con la stessa anteprima senza duplicare le buste. ' + err.message });
    }
    setIsUploading(false);
  };

  const eliminaBusta = busta => setDeletePrompt({ id: busta.id, nome: `${busta.cognome} ${busta.nome}`, inviate: busta.email_inviata ? 1 : 0, totale: 1 });

  const eliminaTutteMese = () => setDeletePrompt({ tutte: true, totale: busteCaricate.length, inviate: busteCaricate.filter(b => b.email_inviata).length });

  const confermaEliminazione = async () => {
    if (!deletePrompt) return;
    setIsDeleting(true);
    try {
      const url = deletePrompt.tutte ? `${API_URL}/buste-paga/mese/${anno}/${mese}` : `${API_URL}/buste-paga/${deletePrompt.id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Eliminazione non riuscita.');
      setDeletePrompt(null);
      setSelectedBusteIds(new Set());
      await caricaBusteMese();
    } catch (err) {
      setDeletePrompt(null);
      setAlertModal({ isOpen: true, type: 'error', title: 'Errore durante l’eliminazione', content: err.message });
    } finally { setIsDeleting(false); }
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


  const totaleNetti = busteCaricate.reduce((acc, curr) => acc + Number(curr.importo_netto || 0), 0);
  const inizioMese = `${anno}-${String(mese).padStart(2, '0')}-01`;
  const fineMeseDate = new Date(Date.UTC(anno, mese, 0));
  const fineMese = Number.isNaN(fineMeseDate.getTime()) ? inizioMese : fineMeseDate.toISOString().slice(0, 10);
  const dipendentiDelMese = Object.values(allDipendentiMap).filter(d => {
    const assunzione = d.dataAssunzione?.slice(0, 10);
    const cessazione = d.dataCessazione?.slice(0, 10);
    return (!assunzione || assunzione <= fineMese) && (!cessazione || cessazione >= inizioMese);
  });
  const idsVisibili = new Set(dipendentiDelMese.map(d => d.id));
  const righeMese = [
    ...dipendentiDelMese.flatMap(d => {
      const buste = busteCaricate.filter(b => b.dipendente_id === d.id);
      return buste.length ? buste.map(b => ({ dipendente: d, busta: b })) : [{ dipendente: d, busta: null }];
    }),
    ...busteCaricate.filter(b => !idsVisibili.has(b.dipendente_id)).map(b => ({ dipendente: allDipendentiMap[b.dipendente_id] || { id: b.dipendente_id, cognome: b.cognome, nome: b.nome, codiceFiscale: b.codice_fiscale }, busta: b }))
  ].sort((a, b) => `${a.dipendente.cognome} ${a.dipendente.nome}`.localeCompare(`${b.dipendente.cognome} ${b.dipendente.nome}`, 'it'));

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
          <FileText className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Buste Paga</h1>
          <p className="text-slate-400 text-sm">Carica e consulta le buste paga mensili dei dipendenti</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-6 md:p-8 space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-900/50 rounded-xl border border-slate-700">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Mese di Riferimento</label>
            <select 
              value={mese} 
              onChange={(e) => setMese(Number(e.target.value))}
              disabled={statoUpload === 'preview' || isUploading}
              className="w-full p-2.5 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {mesi.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Anno</label>
            <input 
              type="number" 
              min="1900"
              max="2100"
              value={anno} 
              onChange={(e) => setAnno(Number(e.target.value))}
              disabled={statoUpload === 'preview' || isUploading}
              className="w-full p-2.5 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {showUpload && (
          <div ref={uploadPanelRef} className="space-y-4 rounded-xl border border-indigo-500/30 bg-slate-900/40 p-5 scroll-mt-6">
            <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-100">Carica buste paga</h3><p className="text-sm text-slate-400">{targetDipendente ? `Per ${targetDipendente.nomeCompleto || `${targetDipendente.cognome} ${targetDipendente.nome}`}` : 'Per uno o più dipendenti'} · {mesi.find(m => m.val === mese)?.label} {anno}</p></div><button type="button" onClick={chiudiCaricamento} disabled={isUploading} className="rounded-lg p-2 text-slate-300 hover:bg-slate-700 disabled:opacity-50" aria-label="Chiudi caricamento"><X size={20} /></button></div>
            {statoUpload === 'idle' && (
              <>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <UploadCloud className="w-4 h-4" /> Seleziona i File (PDF)
                </h3>
                
                <div className="p-6 bg-slate-800 border border-dashed border-slate-600 rounded-xl">
                  <FileUploader 
                    multiple={!targetDipendente}
                    accept=".pdf"
                    askRename={false}
                    file={targetDipendente ? files[0] || null : files}
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
                          <td className="px-4 py-3 max-w-[250px]" title={row.originalName}>
                            {row.originalName}
                            {row.warnings?.map((warning, index) => <div key={index} className="text-amber-300 text-xs mt-1">{warning}</div>)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{row.extractedCF || 'Non trovato'}</td>
                          <td className="px-4 py-3">
                            <select
                              value={row.dipendenteId}
                              onChange={(e) => updatePreviewRow(idx, 'dipendenteId', e.target.value)}
                              className={`w-full p-2 bg-slate-900 border rounded outline-none ${!row.dipendenteId ? 'border-red-500 text-red-400' : 'border-slate-600 text-slate-200'}`}
                            >
                              <option value="">-- Seleziona Dipendente --</option>
                              {Object.values(allDipendentiMap).map(d => (
                                <option key={d.id} value={d.id}>{d.nomeCompleto} ({d.codiceFiscale || 'No CF'})</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.01"
                              value={row.extractedNetto ?? ''}
                              onChange={(e) => updatePreviewRow(idx, 'extractedNetto', e.target.value)}
                              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-slate-200"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {row.extractedCF && row.dipendenteId && (() => {
                              const dip = allDipendentiMap[row.dipendenteId];
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
                    disabled={isUploading || !previewData.length || previewData.some(r => !r.dipendenteId || r.extractedNetto === '' || r.extractedNetto == null || !Number.isFinite(Number(r.extractedNetto))) || Boolean(targetDipendente && (previewData.length !== 1 || previewData[0].dipendenteId !== targetDipendente.id))}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isUploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {isUploading ? 'Salvataggio...' : 'Conferma e Salva Tutto'}
                  </button>
                </div>
                {previewData.some(r => !r.dipendenteId || r.extractedNetto === '' || r.extractedNetto == null) && (
                  <p className="text-red-400 text-sm text-center">Assegna un dipendente e verifica il netto di tutti i file prima di salvare. Controlla anche mese e anno selezionati.</p>
                )}
                {targetDipendente && (previewData.length !== 1 || previewData[0]?.dipendenteId !== targetDipendente.id) && <p className="text-amber-300 text-sm text-center">Per questa riga puoi salvare solo la busta di {targetDipendente.nomeCompleto || `${targetDipendente.cognome} ${targetDipendente.nome}`}. Verifica l’associazione prima di salvare.</p>}
              </div>
            )}

          </div>
        )}

        <div ref={listRef} className="space-y-4 scroll-mt-6">
            {uploadMessage && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-300">{uploadMessage}</p>}
            <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Buste Paga di {mesi.find(m => m.val === mese).label} {anno}
                </h3>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-slate-400 text-sm">{busteCaricate.length} caricate · {righeMese.filter(r => !r.busta).length} non caricate</p>
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

              <div className="flex flex-wrap items-center gap-4">
                {!isLoadingBuste && !busteError && busteCaricate.length === 0 && <button type="button" onClick={() => apriCaricamento()} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white hover:bg-indigo-500"><UploadCloud size={18} /> Carica</button>}
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

            {busteError || dipendentiError ? <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">{busteError || dipendentiError}<button type="button" onClick={() => { caricaBusteMese(); caricaDipendenti(); }} className="ml-3 font-semibold underline">Riprova</button></div> : isLoadingBuste || isLoadingDipendenti ? (
              <div className="text-center py-12 text-slate-400"><RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 opacity-50" /> Caricamento...</div>
            ) : righeMese.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-900/50 rounded-xl border border-slate-700 border-dashed">
                Nessun dipendente per questo mese.
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
                      <th className="px-4 py-3 text-center">Stato</th>
                      <th className="px-4 py-3 text-right">Netto Busta</th>
                      <th className="px-4 py-3 text-center">Email</th>
                      <th className="px-4 py-3 text-center">Azioni</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-700/50 bg-slate-800">
                    {righeMese.map(({ dipendente: d, busta: b }) => (
                      <tr key={b?.id || `mancante-${d.id}`} className={`transition-colors ${b && selectedBusteIds.has(b.id) ? 'bg-indigo-500/10' : 'hover:bg-slate-700/30'}`}>
                        <td className="px-4 py-3">
                          <input 
                            type="checkbox"
                            checked={Boolean(b && selectedBusteIds.has(b.id))}
                            disabled={!b}
                            onChange={() => b && toggleSelectBusta(b.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-indigo-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                            style={{ accentColor: '#818cf8' }}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-200">{d.cognome} {d.nome}</td>
                        <td className="px-4 py-3 font-mono text-xs">{d.codiceFiscale || b?.codice_fiscale || '—'}</td>
                        <td className="px-4 py-3 text-center">{b ? <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300">Caricata</span> : <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300">Non caricata</span>}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-400">{b ? `€ ${Number(b.importo_netto || 0).toFixed(2)}` : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {b?.email_inviata ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 rounded-full text-xs font-bold" title={`Inviata il ${b.data_invio_email || ''}`}>
                              <Mail className="w-3.5 h-3.5" /> Inviata
                            </span>
                          ) : b ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-700/50 text-slate-500 rounded-full text-xs font-medium">
                              — Non inviata
                            </span>
                          ) : <span className="text-slate-500">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {b?.allegato_busta_paga ? (
                              <a 
                                href={attachmentUrl(b.allegato_busta_paga)}
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex p-2 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 rounded-lg transition-colors"
                                title="Scarica PDF"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            ) : null}
                            {!b && <button type="button" onClick={() => apriCaricamento(d)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/15 px-2 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/25"><UploadCloud size={15} /> Carica</button>}
                            {b && <button
                              onClick={() => eliminaBusta(b)}
                              className="inline-flex p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                              title="Elimina Busta Paga"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>}
                          </div>
                        </td>
                      </tr>

                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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

      <ModernModal
        isOpen={alertModal.isOpen}
        type={alertModal.type}
        title={alertModal.title}
        content={alertModal.content}
        primaryAction={alertModal.primaryAction}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
      />

      <ModernModal
        isOpen={Boolean(deletePrompt)}
        type={deletePrompt?.inviate ? 'warning' : 'info'}
        title={deletePrompt?.tutte ? 'Eliminare le buste del mese?' : 'Eliminare la busta paga?'}
        content={deletePrompt?.inviate
          ? deletePrompt.tutte
            ? `${deletePrompt.inviate} buste di questo mese sono già state inviate. Se le elimini e le carichi di nuovo, la spunta «Inviata» verrà tolta e dovrai inviarle nuovamente. Una copia di recupero sarà conservata sul server.`
            : `La busta di ${deletePrompt.nome} è già stata inviata. Se la elimini e la carichi di nuovo, la spunta «Inviata» verrà tolta e dovrai inviarla nuovamente. Una copia di recupero sarà conservata sul server.`
          : deletePrompt?.tutte ? `Eliminare tutte le ${deletePrompt.totale} buste di ${mesi.find(m => m.val === mese)?.label} ${anno}? Una copia di recupero sarà conservata sul server.` : `Eliminare la busta di ${deletePrompt?.nome}? Una copia di recupero sarà conservata sul server.`}
        primaryAction={{ label: isDeleting ? 'Eliminazione...' : 'Elimina', variant: 'danger', disabled: isDeleting, onClick: confermaEliminazione }}
        secondaryAction={{ label: 'Annulla', disabled: isDeleting, onClick: () => setDeletePrompt(null) }}
        onClose={() => { if (!isDeleting) setDeletePrompt(null); }}
      />

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
