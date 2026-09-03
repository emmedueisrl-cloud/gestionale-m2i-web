import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, Save, ArrowLeft, Loader2, Camera, FileSignature, CheckCircle2, User, Building2, MapPin, Mail, Landmark, Search, FileText, CreditCard, Download, Trash2, Plus, Key } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { recuperaDatiCompletiCliente, salvaModificheCliente, uploadFileCliente, recuperaDocumentiCliente, eliminaDocumentoCliente, recuperaListaOperatoriCommerciali } from '../../api/clienti';
import { recuperaElencoDipendenti } from '../../api/dipendenti';
import ModernModal from '../../components/ui/ModernModal';
import FileUploader from '../../components/ui/FileUploader';
import GestioneChiaviCliente from '../../components/clienti/GestioneChiaviCliente';

function ModificaCliente() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [idCliente, setIdCliente] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, type: '', message: '' });
  const [dipendenti, setDipendenti] = useState([]);
  const [listaOperatori, setListaOperatori] = useState([]);
  const [listaCommerciali, setListaCommerciali] = useState([]);

  useEffect(() => {
    async function loadDipendenti() {
      try {
        const dips = await recuperaElencoDipendenti();
        setDipendenti(dips || []);
      } catch (err) {
        console.error(err);
      }
    }
    async function loadListeExtra() {
      try {
        const liste = await recuperaListaOperatoriCommerciali();
        setListaOperatori(liste.operatori || []);
        setListaCommerciali(liste.commerciali || []);
      } catch (err) {
        console.error("Errore caricamento liste operatori/commerciali:", err);
      }
    }
    loadDipendenti();
    loadListeExtra();
  }, []);
  // Stato foto
  const [fotoEsistenti, setFotoEsistenti] = useState([]);
  const [nuoveFoto, setNuoveFoto] = useState([]);
  const [nuovePreview, setNuovePreview] = useState([]);

  // Stato per i documenti
  const [fileContratto, setFileContratto] = useState(null);
  const [fileAmministratore, setFileAmministratore] = useState(null);
  const [altriDocumenti, setAltriDocumenti] = useState([]);
  const [altroModal, setAltroModal] = useState({ isOpen: false, pendingFile: null, tempName: '', uploaderId: null });
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });

  const [documentiEsistenti, setDocumentiEsistenti] = useState([]);
  const [assegnazioniChiavi, setAssegnazioniChiavi] = useState([]);

  const [dati, setDati] = useState({
    id: '',
    ragioneSociale: '',
    nomeAttivita: '',
    partitaIva: '',
    codiceFiscale: '',
    indirizzoSede: '',
    civicoSede: '',
    cap: '',
    citta: '',
    provincia: '',
    pec: '',
    sdi: '',
    titolare: '',
    telefonoTitolare: '',
    referente: '',
    ruoloReferente: '',
    telefoni: [{ numero: '', referente: '' }],
    email: '',
    emailSecondaria: '',
    banca: '',
    iban: '',
    condizioniPagamento: '',
    note: '',
    noteFisseElaborato: '',
    possessoChiavi: 'NO',
    copie: 0,
    inPossessoDi: '',
    noteChiavi: '',
    operatore: '',
    commerciale: '',
    quotazioneImporto: '',
    quotazioneTipo: 'Mensile',
    tipoTassazione: 'IVA',
    percentualeTassazione: '22',
    tassazioneAltro: ''
  });

  useEffect(() => {
    if (dati.tipoTassazione === 'REVERSE CHARGE') {
      setDati(prev => ({ ...prev, percentualeTassazione: '0' }));
    }
  }, [dati.tipoTassazione]);

  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      setIdCliente(idFromUrl);
      handleCaricaDati(idFromUrl);
    }
  }, [searchParams]);

  const handleCaricaDati = async (id) => {
    if (!id) {
      setDati({ id: '', ragioneSociale: '', nomeAttivita: '', partitaIva: '', codiceFiscale: '', indirizzoSede: '', civicoSede: '', cap: '', citta: '', provincia: '', pec: '', sdi: '', titolare: '', telefonoTitolare: '', referente: '', ruoloReferente: '', telefoni: [{ numero: '', referente: '' }], sediOperative: [''], email: '', emailSecondaria: '', banca: '', iban: '', condizioniPagamento: '', note: '', noteFisseElaborato: '', possessoChiavi: 'NO', copie: 0, inPossessoDi: '', noteChiavi: '', operatoreAssegnato: '' });
      setFotoEsistenti([]);
      setNuoveFoto([]);
      setNuovePreview([]);
      setDocumentiEsistenti([]);
      return;
    }
    setIsLoading(true);
    try {
      const [datiCliente, docs] = await Promise.all([
        recuperaDatiCompletiCliente(id),
        recuperaDocumentiCliente(id)
      ]);
      if (datiCliente) {
        let parsedSedi = [''];
        if (datiCliente.sede_operativa) {
          if (datiCliente.sede_operativa.includes('|')) {
            parsedSedi = datiCliente.sede_operativa.split('|').filter(Boolean);
          } else {
            try {
              parsedSedi = JSON.parse(datiCliente.sede_operativa);
              if (!Array.isArray(parsedSedi)) parsedSedi = [datiCliente.sede_operativa];
            } catch(e) {
              parsedSedi = [datiCliente.sede_operativa];
            }
          }
        }
        if (parsedSedi.length === 0) parsedSedi = [''];

        setDati({
          id: id,
          ragioneSociale: datiCliente.ragione_sociale || '',
          nomeAttivita: datiCliente.nome_attivita || '',
          partitaIva: datiCliente.partita_iva || '',
          codiceFiscale: datiCliente.codice_fiscale || '',
          indirizzoSede: datiCliente.indirizzo_sede || '',
          civicoSede: datiCliente.civico_sede || '',
          cap: datiCliente.cap || '',
          citta: datiCliente.citta || '',
          provincia: datiCliente.provincia || '',
          titolare: datiCliente.titolare || '',
          telefonoTitolare: datiCliente.telefono_titolare || '',
          referente: datiCliente.referente || '',
          ruoloReferente: datiCliente.ruolo_referente || '',
          telefoni: datiCliente.telefono ? String(datiCliente.telefono).split(',').map(s => s.trim()).filter(Boolean).map(part => {
            const match = part.match(/^(.*?)(?:\s*\((.*?)\))?$/);
            return { numero: match ? match[1].trim() : part, referente: (match && match[2]) ? match[2].trim() : '' };
          }) : [{ numero: '', referente: '' }],
          sediOperative: parsedSedi,
          email: datiCliente.email || '',
          emailSecondaria: datiCliente.email_secondaria || '',
          pec: datiCliente.pec || '',
          sdi: datiCliente.codice_sdi || '',
          condizioniPagamento: datiCliente.metodo_pagamento || '',
          banca: datiCliente.banca || '',
          iban: datiCliente.iban || '',
          note: datiCliente.note || '',
          noteFisseElaborato: datiCliente.note_fisse_elaborato || '',
          possessoChiavi: datiCliente.possesso_chiavi || 'NO',
          copie: datiCliente.copie || 0,
          inPossessoDi: datiCliente.in_possesso_di || '',
          noteChiavi: datiCliente.note_chiavi || '',
          operatore: datiCliente.operatore || '',
          operatoreAssegnato: datiCliente.operatore_assegnato || '',
          commerciale: datiCliente.commerciale || '',
          quotazioneImporto: datiCliente.quotazione_importo || '',
          quotazioneTipo: datiCliente.quotazione_tipo || 'Mensile',
          tipoTassazione: datiCliente.tipo_tassazione || 'IVA',
          percentualeTassazione: datiCliente.percentuale_tassazione !== null && datiCliente.percentuale_tassazione !== undefined ? datiCliente.percentuale_tassazione : '22',
          tassazioneAltro: datiCliente.tassazione_altro || ''
        });
        setFotoEsistenti(Array.isArray(datiCliente.foto_servizio) ? datiCliente.foto_servizio : []);
        setNuoveFoto([]);
        setNuovePreview([]);
        setDocumentiEsistenti(docs || []);
        setAssegnazioniChiavi(Array.isArray(datiCliente.chiavi_assegnazioni) ? datiCliente.chiavi_assegnazioni : []);
      }
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Impossibile recuperare i dati del cliente.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDati(prev => ({ ...prev, [name]: value }));
  };

  const handleAggiornamentoChiavi = () => {
    const currentId = idCliente;
    if (currentId) {
      setIsLoading(true);
      handleCaricaDati(currentId);
    }
  };

  const handlePhoneChange = (index, field, value) => {
    setDati(prev => {
      const newPhones = [...prev.telefoni];
      newPhones[index] = { ...newPhones[index], [field]: value };
      return { ...prev, telefoni: newPhones };
    });
  };

  const addPhone = () => {
    setDati(prev => ({ ...prev, telefoni: [...prev.telefoni, { numero: '', referente: '' }] }));
  };

  const removePhone = (index) => {
    setDati(prev => {
      const newPhones = prev.telefoni.filter((_, i) => i !== index);
      return { ...prev, telefoni: newPhones };
    });
  };

  const addAltroDocumento = () => {
    setAltriDocumenti(prev => [...prev, { id: Date.now(), file: null, nome: '' }]);
  };

  const confirmAltroName = () => {
    if (!altroModal.tempName.trim()) {
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: 'Attenzione',
        content: 'Inserisci un nome per il documento',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
      return;
    }
    
    setAltriDocumenti(prev => prev.map(doc => 
      doc.id === altroModal.uploaderId 
        ? { ...doc, file: altroModal.pendingFile, nome: altroModal.tempName.trim().replace(/\s+/g, '_') }
        : doc
    ));
    
    setAltroModal({ isOpen: false, pendingFile: null, tempName: '', uploaderId: null });
  };

  const handleSedeOperativaChange = (index, value) => {
    setDati(prev => {
      const newSedi = [...prev.sediOperative];
      newSedi[index] = value;
      return { ...prev, sediOperative: newSedi };
    });
  };

  const addSedeOperativa = () => {
    setDati(prev => ({ ...prev, sediOperative: [...prev.sediOperative, ''] }));
  };

  const removeSedeOperativa = (index) => {
    setDati(prev => {
      const newSedi = prev.sediOperative.filter((_, i) => i !== index);
      return { ...prev, sediOperative: newSedi };
    });
  };

  const copySedeLegale = () => {
    setDati(prev => {
      const indirizzo = `${prev.indirizzoSede || ''} ${prev.civicoSede ? ', ' + prev.civicoSede : ''} - ${prev.cap || ''} ${prev.citta || ''} (${prev.provincia || ''})`.replace(/ - \(\)/g, '').replace(/ -  \(\)/g, '').trim();
      const newSedi = [...prev.sediOperative];
      newSedi[0] = indirizzo;
      return { ...prev, sediOperative: newSedi };
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setNuoveFoto(prev => [...prev, ...files]);
      const previews = files.map(file => URL.createObjectURL(file));
      setNuovePreview(prev => [...prev, ...previews]);
    }
  };

  const removeFotoEsistente = (index) => {
    setFotoEsistenti(prev => prev.filter((_, i) => i !== index));
  };

  const removeNuovaFoto = (index) => {
    setNuoveFoto(prev => prev.filter((_, i) => i !== index));
    setNuovePreview(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteDocument = async (e, nomeFile) => {
    e.preventDefault();
    e.stopPropagation();
    
    setModalState({
      isOpen: true,
      type: 'warning',
      message: 'Sei sicuro di voler eliminare questo documento?',
      primaryAction: {
        label: 'Elimina',
        onClick: async () => {
          setModalState({ isOpen: false, type: '', message: '' });
          try {
            await eliminaDocumentoCliente(dati.id, nomeFile);
            const docs = await recuperaDocumentiCliente(dati.id);
            setDocumentiEsistenti(docs || []);
          } catch (err) {
            setModalState({
              isOpen: true,
              type: 'error',
              message: 'Errore durante l\'eliminazione del documento.'
            });
          }
        }
      },
      secondaryAction: {
        label: 'Annulla',
        onClick: () => setModalState({ isOpen: false, type: '', message: '' })
      }
    });
  };

  const handleSalva = async () => {
    if (!dati.ragioneSociale) {
      setModalState({ isOpen: true, type: 'warning', message: 'Il campo Ragione Sociale è obbligatorio.' });
      return;
    }

    const isBozzaAttuale = dati.attivo === 'Bozza';
    const hasPiva = !!dati.partitaIva;
    const isBozza = isBozzaAttuale && !hasPiva;

    if (!isBozza && !hasPiva) {
      setModalState({ isOpen: true, type: 'warning', message: 'Il campo Partita IVA è obbligatorio.' });
      return;
    }

    setIsSaving(true);
    try {
      let finalFotoUrls = [...fotoEsistenti];
      
      if (nuoveFoto.length > 0) {
        const formData = new FormData();
        formData.append('idCliente', dati.id);
        nuoveFoto.forEach(file => formData.append('files', file));

        const uploadRes = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + (import.meta.env.VITE_API_URL || '') + '/api/upload-multiple', {
          method: 'POST',
          body: formData
        });
        
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          finalFotoUrls = [...finalFotoUrls, ...uploadData.paths];
        } else {
          throw new Error('Errore durante il caricamento delle nuove foto: ' + uploadData.error);
        }
      }

      const datiDaSalvare = { 
        ...dati, 
        sedeOperativa: dati.sediOperative ? dati.sediOperative.filter(Boolean) : [],
        fotoServizio: finalFotoUrls,
        telefono: dati.telefoni ? dati.telefoni.filter(t => t.numero).map(t => t.referente ? `${t.numero} (${t.referente})` : t.numero).join(', ') : '',
        isBozza
      };
      await salvaModificheCliente(datiDaSalvare);
      
      setFotoEsistenti(finalFotoUrls);
      setNuoveFoto([]);
      setNuovePreview([]);

      let filesUploaded = 0;
      if (fileContratto) {
        await uploadFileCliente(dati.id, fileContratto, 'Contratto', dati.ragioneSociale, '');
        filesUploaded++;
      }
      if (fileAmministratore) {
        await uploadFileCliente(dati.id, fileAmministratore, 'Documenti_Amministratore', dati.ragioneSociale, '');
        filesUploaded++;
      }
      
      for (const doc of altriDocumenti) {
        if (doc.file) {
          await uploadFileCliente(dati.id, doc.file, doc.nome || 'Documento_Generico', dati.ragioneSociale, '');
          filesUploaded++;
        }
      }

      setFileContratto(null);
      setFileAmministratore(null);
      setAltriDocumenti([{ id: Date.now(), file: null, nome: '' }]);

      if (filesUploaded > 0) {
        const docs = await recuperaDocumentiCliente(dati.id);
        setDocumentiEsistenti(docs || []);
      }

      setModalState({ 
        isOpen: true, 
        type: 'success', 
        message: `Modifiche salvate con successo! ${filesUploaded > 0 ? `Caricati ${filesUploaded} documenti.` : ''}`,
        primaryAction: {
          label: 'Chiudi e torna ad Elenco',
          onClick: () => navigate('/admin/clienti/lista')
        },
        secondaryAction: {
          label: 'Rimani qui',
          onClick: () => setModalState({ isOpen: false, type: '', message: '' })
        }
      });
      
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: err.message || 'Errore durante il salvataggio.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 w-full flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-700">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/clienti/lista')} className="p-2 bg-slate-900/50 rounded-full text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/20 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-slate-50 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" /> Modifica Cliente
          </h1>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center p-20 bg-slate-800 rounded-2xl border border-slate-700">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
        </div>
      ) : !dati.id ? (
        <div className="flex flex-col items-center justify-center p-20 bg-slate-800/50 rounded-2xl border border-dashed border-slate-600 text-slate-400">
          <Building2 className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">Nessun cliente selezionato.</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
          
        <section>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Dati Anagrafici
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1 text-indigo-400">Outbound</label>
              <input type="text" name="operatore" value={dati.operatore} onChange={handleChange} className="w-full p-2.5 bg-slate-900/80 border border-indigo-500/30 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-100" placeholder="Digita a mano..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1 text-emerald-400">Commerciale</label>
              <input type="text" name="commerciale" value={dati.commerciale} onChange={handleChange} className="w-full p-2.5 bg-slate-900/80 border border-emerald-500/30 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-100" placeholder="Digita a mano..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Ragione Sociale *</label>
              <input id="ragioneSociale" type="text" name="ragioneSociale" value={dati.ragioneSociale} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1 flex items-center justify-between">
                <span>Nome Attività</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 font-normal hover:text-indigo-400 transition-colors">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                    checked={dati.nomeAttivita === dati.ragioneSociale && dati.ragioneSociale !== ''}
                    onChange={(e) => {
                      if (e.target.checked) setDati(prev => ({ ...prev, nomeAttivita: prev.ragioneSociale }));
                    }}
                  />
                  <span>= Ragione Sociale</span>
                </label>
              </label>
              <input type="text" name="nomeAttivita" value={dati.nomeAttivita} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Partita IVA *</label>
                <input id="partitaIva" type="text" name="partitaIva" value={dati.partitaIva} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" maxLength="11" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1 flex items-center justify-between">
                  <span>Codice Fiscale</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 font-normal hover:text-indigo-400 transition-colors">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                      checked={dati.codiceFiscale === dati.partitaIva && dati.partitaIva !== ''}
                      onChange={(e) => {
                        if (e.target.checked) setDati(prev => ({ ...prev, codiceFiscale: prev.partitaIva }));
                      }}
                    />
                    <span>= P.IVA</span>
                  </label>
                </label>
                <input type="text" name="codiceFiscale" value={dati.codiceFiscale} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase" maxLength="16" />
              </div>
              <div className="grid grid-cols-4 gap-4 col-span-1 md:col-span-2">
                <div className="col-span-3">
                  <label className="block text-sm font-medium text-slate-200 mb-1">Indirizzo Sede Legale</label>
                  <input type="text" name="indirizzoSede" value={dati.indirizzoSede} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-slate-200 mb-1">Civico</label>
                  <input type="text" name="civicoSede" value={dati.civicoSede} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 col-span-1 md:col-span-2">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-slate-200 mb-1">CAP</label>
                  <input type="text" name="cap" value={dati.cap} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" maxLength="5" />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-slate-200 mb-1">Città</label>
                  <input type="text" name="citta" value={dati.citta} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-slate-200 mb-1">Prov.</label>
                  <input type="text" name="provincia" value={dati.provincia} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase" maxLength="2" />
                </div>
              </div>

              <div className="col-span-1 md:col-span-2 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-200">Sedi Operative</label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 font-normal hover:text-indigo-400 transition-colors">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.checked) copySedeLegale();
                      }}
                    />
                    <span>Uguale alla sede legale</span>
                  </label>
                </div>
                <div className="space-y-2">
                  {dati.sediOperative && dati.sediOperative.map((sede, i) => (
                    <div key={i} className="flex gap-2">
                      <input 
                        type="text" 
                        value={sede} 
                        onChange={(e) => handleSedeOperativaChange(i, e.target.value)}
                        placeholder="Indirizzo Sede Operativa"
                        className="flex-1 p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                      />
                      {i === (dati.sediOperative.length - 1) ? (
                        <button type="button" onClick={addSedeOperativa} className="w-11 h-11 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center justify-center transition-colors">
                          <span className="text-xl leading-none text-slate-300 mb-0.5">+</span>
                        </button>
                      ) : (
                        <button type="button" onClick={() => removeSedeOperativa(i)} className="w-11 h-11 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center justify-center transition-colors">
                          <span className="text-xl leading-none text-slate-300 mb-0.5">-</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Contatti &amp; Fatturazione
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Indirizzo PEC</label>
                <input type="email" name="pec" value={dati.pec} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Codice Destinatario (SDI)</label>
                <input type="text" name="sdi" value={dati.sdi} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono" maxLength="7" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Titolare (Opzionale)</label>
                <input type="text" name="titolare" value={dati.titolare} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Telefono Titolare</label>
                <input type="text" name="telefonoTitolare" value={dati.telefonoTitolare} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Referente Aziendale</label>
                <input type="text" name="referente" value={dati.referente} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Ruolo Referente</label>
                <input type="text" name="ruoloReferente" value={dati.ruoloReferente} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-slate-200 mb-1 flex items-center justify-between">
                  <span>Telefono / Cellulare</span>
                  <button type="button" onClick={addPhone} className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded hover:bg-indigo-500/30 transition-colors flex items-center gap-1">
                    <span>+</span> Aggiungi Numero
                  </button>
                </label>
                <div className="space-y-2">
                  {dati.telefoni.map((phone, index) => (
                    <div key={index} className="flex flex-col md:flex-row items-center gap-2">
                      <input 
                        type="text" 
                        value={phone.numero} 
                        onChange={(e) => handlePhoneChange(index, 'numero', e.target.value)} 
                        className="w-full md:w-1/2 p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                        placeholder={index === 0 ? "Es. 3331234567" : "Altro numero"}
                      />
                      <input 
                        type="text" 
                        value={phone.referente} 
                        onChange={(e) => handlePhoneChange(index, 'referente', e.target.value)} 
                        className="w-full md:w-1/2 p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-300" 
                        placeholder="Nome Referente (opzionale)"
                      />
                      {dati.telefoni.length > 1 && (
                        <button type="button" onClick={() => removePhone(index)} className="p-2.5 text-slate-400 hover:text-red-400 bg-slate-900/50 border border-slate-700 rounded-lg transition-colors">
                          X
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Email Cortesia Principale</label>
                  <input type="email" name="email" value={dati.email} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Email Cortesia Secondaria</label>
                  <input type="email" name="emailSecondaria" value={dati.emailSecondaria} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="(opzionale)" />
                </div>
              </div>
            </div>
          </section>

          {/* Sezione Banca & Pagamenti */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Condizioni Finanziarie e Quotazione
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1 text-amber-400">Importo Quotazione (€) *</label>
              <input type="number" step="0.01" name="quotazioneImporto" value={dati.quotazioneImporto} onChange={handleChange} className="w-full p-2.5 bg-slate-900/80 border border-amber-500/30 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-slate-100 font-bold" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1 text-amber-400">Tipo Quotazione</label>
              <select name="quotazioneTipo" value={dati.quotazioneTipo} onChange={handleChange} className="w-full p-2.5 bg-slate-900/80 border border-amber-500/30 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-slate-100 font-bold">
                <option value="Mensile">Mensile</option>
                <option value="Oraria">Oraria</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1 text-amber-400">Tipo Tassazione</label>
              <select name="tipoTassazione" value={dati.tipoTassazione} onChange={handleChange} className="w-full p-2.5 bg-slate-900/80 border border-amber-500/30 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-slate-100 font-bold">
                <option value="IVA">IVA</option>
                <option value="TRAT. ACC.">TRAT. ACC.</option>
                <option value="REVERSE CHARGE">REVERSE CHARGE</option>
                <option value="ALTRO">ALTRO</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1 text-amber-400">% Tassazione</label>
              <input type="number" step="0.01" name="percentualeTassazione" value={dati.percentualeTassazione} onChange={handleChange} disabled={dati.tipoTassazione === 'REVERSE CHARGE'} className={`w-full p-2.5 bg-slate-900/80 border border-amber-500/30 rounded-lg outline-none text-slate-100 font-bold ${dati.tipoTassazione === 'REVERSE CHARGE' ? 'opacity-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-amber-500'}`} placeholder="Es. 22" />
            </div>
            {dati.tipoTassazione === 'ALTRO' && (
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1 text-amber-400">Specifica Altro</label>
                <input type="text" name="tassazioneAltro" value={dati.tassazioneAltro} onChange={handleChange} className="w-full p-2.5 bg-slate-900/80 border border-amber-500/30 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-slate-100 font-bold" placeholder="Specifica..." />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Banca d'Appoggio</label>
                <input type="text" name="banca" value={dati.banca} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">IBAN</label>
                <input type="text" name="iban" value={dati.iban} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono" />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-slate-200 mb-1">Condizioni Pagamento Standard</label>
                <select name="condizioniPagamento" value={dati.condizioniPagamento} onChange={handleChange} className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="Bonifico Vista Fattura">Bonifico Vista Fattura</option>
                  <option value="Bonifico 30gg DF">Bonifico 30gg DF</option>
                  <option value="Bonifico 60gg DF">Bonifico 60gg DF</option>
                  <option value="Bonifico 90gg DF">Bonifico 90gg DF</option>
                  <option value="Ri.Ba. 30gg DF">Ri.Ba. 30gg DF</option>
                  <option value="Ri.Ba. 60gg DF">Ri.Ba. 60gg DF</option>
                </select>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-slate-200 mb-1 text-indigo-400">Operatore Assegnato</label>
                <input type="text" name="operatoreAssegnato" value={dati.operatoreAssegnato} onChange={handleChange} className="w-full p-2.5 bg-slate-900/80 border border-indigo-500/30 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-100" placeholder="Digita a mano..." />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-slate-200 mb-1">Note Aggiuntive</label>
                <textarea name="note" value={dati.note} onChange={handleChange} rows="3" className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Note Fisse per Elaborato</label>
                <textarea name="noteFisseElaborato" value={dati.noteFisseElaborato} onChange={handleChange} rows="3" placeholder="Queste note verranno sempre incluse nell'elaborato mensile..." className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"></textarea>
              </div>
            </div>
          </section>

          {/* Sezione Gestione Chiavi */}
          <GestioneChiaviCliente 
            clienteId={idCliente} 
            clienteData={dati} 
            dipendenti={dipendenti} 
            assegnazioniEsistenti={assegnazioniChiavi} 
            onAggiornamento={handleAggiornamentoChiavi} 
          />


          <section>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Camera className="w-4 h-4" /> Documenti e Foto
            </h3>

            {documentiEsistenti && documentiEsistenti.length > 0 && (
              <div className="mb-8 bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h4 className="text-sm font-semibold text-slate-300 mb-4">Documenti Salvati</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documentiEsistenti.map((doc, index) => (
                    <div key={index} className="flex relative items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700 hover:border-indigo-500 hover:bg-slate-800 transition-all group">
                      <a 
                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${doc.path}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 w-full"
                      >
                        <div className="bg-indigo-500/20 p-3 rounded-lg group-hover:bg-indigo-500/30 transition-colors">
                          <Download className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="overflow-hidden pr-8">
                          <p className="font-semibold text-slate-200 text-sm truncate" title={doc.nome}>{doc.nome}</p>
                        </div>
                      </a>
                      <button 
                        onClick={(e) => handleDeleteDocument(e, doc.nome)}
                        className="absolute right-4 p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors z-10"
                        title="Elimina Documento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-4">
              <FileUploader label="Contratto Firmato" file={fileContratto} onFileSelect={setFileContratto} />
              <FileUploader label="Documenti Amministratore (CI, CF)" file={fileAmministratore} onFileSelect={setFileAmministratore} />
              
              {altriDocumenti.map((doc, index) => (
                <div key={doc.id} className="relative">
                  <FileUploader 
                    label={doc.nome ? doc.nome.replace(/_/g, ' ') : "Altri Documenti (Generico)"} 
                    file={doc.file} 
                    onFileSelect={(f) => {
                      if (f) {
                        setAltroModal({ isOpen: true, pendingFile: f, tempName: '', uploaderId: doc.id });
                      } else {
                        setAltriDocumenti(prev => prev.map(d => d.id === doc.id ? { ...d, file: null, nome: '' } : d));
                      }
                    }} 
                  />
                  {index === altriDocumenti.length - 1 && doc.file && (
                    <button 
                      onClick={addAltroDocumento} 
                      className="absolute -right-3 -top-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full p-1.5 shadow-md transition-all z-10"
                      title="Aggiungi un altro documento generico"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4 bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
              <h4 className="text-sm font-semibold text-slate-300">Foto Servizio</h4>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Aggiungi Foto
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              </div>
              
              {(fotoEsistenti.length > 0 || nuovePreview.length > 0) && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
                  {fotoEsistenti.map((url, index) => (
                    <div key={`exist-${index}`} className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-square bg-slate-800">
                      <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/${url.replace(/^\/?/, '')}`} alt={`Foto Esistente ${index}`} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => removeFotoEsistente(index)}
                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Rimuovi"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[10px] text-center text-slate-300">Salvata</div>
                    </div>
                  ))}
                  
                  {nuovePreview.map((url, index) => (
                    <div key={`new_${index}`} className="relative group rounded-lg overflow-hidden border border-emerald-500/50 aspect-square bg-slate-800">
                      <div className="absolute top-0 left-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg z-10">Nuova</div>
                      <img src={url} alt={`Nuova ${index}`} className="w-full h-full object-cover opacity-80" />
                      <button 
                        onClick={() => removeNuovaFoto(index)}
                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="flex justify-end pt-4 border-t border-slate-800 gap-4">
            <button 
              onClick={() => handleSalva()}
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? 'Salvataggio in corso...' : 'Salva Modifiche'}
            </button>
          </div>

        </div>
      )}

      <ModernModal 
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.type === 'success' ? 'Operazione Completata' : modalState.type === 'warning' ? 'Attenzione' : 'Errore'}
        content={modalState.message}
        primaryAction={modalState.primaryAction}
        secondaryAction={modalState.secondaryAction}
        onClose={() => {
          if (!modalState.primaryAction) setModalState({ isOpen: false, type: '', message: '' })
        }}
      />

      <ModernModal 
        isOpen={altroModal.isOpen}
        type="warning"
        title="Nome Documento"
        content={
          <div className="mt-4">
            <p className="text-sm text-slate-400 mb-2">Che tipo di documento stai caricando?</p>
            <input 
              type="text" 
              value={altroModal.tempName}
              onChange={(e) => setAltroModal(prev => ({ ...prev, tempName: e.target.value }))}
              placeholder="es. Visura Camerale, Documento Identità, ecc."
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:border-indigo-500 outline-none"
              autoFocus
            />
          </div>
        }
        primaryAction={{
          label: "Conferma Nome",
          onClick: confirmAltroName
        }}
        secondaryAction={{
          label: "Annulla",
          onClick: () => {
            setAltroModal({ isOpen: false, pendingFile: null, tempName: '', uploaderId: null });
          }
        }}
        onClose={() => {
          setAltroModal({ isOpen: false, pendingFile: null, tempName: '', uploaderId: null });
        }}
      />
      <ModernModal 
        {...alertModal}
        onClose={() => setAlertModal({ isOpen: false })}
      />
    </div>
  );
}

export default ModificaCliente;
