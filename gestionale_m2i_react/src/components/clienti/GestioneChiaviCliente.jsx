import React, { useState, useEffect } from 'react';
import { Key, Plus, FileText, CheckCircle2, ChevronRight, ChevronLeft, Upload, Undo2, ArrowRightLeft } from 'lucide-react';
import { 
  salvaNuovaAssegnazioneChiavi, 
  assegnaAdAltroOperatore, 
  riconsegnaChiaveAlCliente,
  uploadFileCliente
} from '../../api/clienti';
import { recuperaDatiAzienda } from '../../api/azienda';

import PrintableModuloConsegnaCliente from '../moduli/PrintableModuloConsegnaCliente';
import PrintableModuloChiavi from '../moduli/PrintableModuloChiavi';
import ModuloRiconsegnaCliente from '../moduli/ModuloRiconsegnaCliente';
import ModernModal from '../ui/ModernModal';

export default function GestioneChiaviCliente({ clienteId, clienteData, dipendenti, assegnazioniEsistenti, onAggiornamento }) {
  const [assegnazioni, setAssegnazioni] = useState(assegnazioniEsistenti || []);
  const [aziendaData, setAziendaData] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });
  
  // Modalità operativa: null | 'add' | 'move' | 'return'
  const [actionType, setActionType] = useState(null);
  const [activeId, setActiveId] = useState(null); 
  
  // Step form state
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    numeroChiavi: 1,
    assegnazioniDaAggiungere: [{ dipendenteId: '', assegnatoATesto: '', note: '' }],
    dipendenteId: '',
    assegnatoATesto: '',
    numCopia: '',
    note: '',
    moduloClienteFile: null,
    moduloDipendenteFile: null,
    dataRestituzione: new Date().toISOString().split('T')[0],
    dataVerbale: new Date().toISOString().split('T')[0],
    indirizzoImmobile: '',
    cittaImmobile: '',
    sceltaSede: 'cliente',
    indirizzoConfermato: false
  });

  // Stampa state
  const [printModulo, setPrintModulo] = useState(null); // 'cliente_ricezione' | 'dipendente' | 'cliente_riconsegna'
  const [showDateModalFor, setShowDateModalFor] = useState(null);

  useEffect(() => {
    setAssegnazioni(assegnazioniEsistenti || []);
    
    // Carica dati azienda per i timbri
    recuperaDatiAzienda().then(data => {
      if (data) setAziendaData(data);
    }).catch(console.error);
  }, [assegnazioniEsistenti]);

  const handleCancel = () => {
    setActionType(null);
    setActiveId(null);
    setStep(1);
  };

  const indirizziDisponibili = React.useMemo(() => {
    let indirizzi = [];
    if (clienteData) {
      if (clienteData.indirizzo_sede || clienteData.citta) {
        indirizzi.push(`${clienteData.indirizzo_sede || ''} ${clienteData.civico_sede || ''} - ${clienteData.citta || ''}`.trim().replace(/^ - | - $/g, ''));
      }
      const sediOp = clienteData.sedeOperativa || clienteData.sede_operativa;
      let parsedSedi = [];
      if (typeof sediOp === 'string') {
        try { parsedSedi = JSON.parse(sediOp); } catch (e) {}
      } else if (Array.isArray(sediOp)) {
        parsedSedi = sediOp;
      }
      parsedSedi.forEach(sede => {
        if (sede.indirizzo || sede.citta) {
          indirizzi.push(`${sede.indirizzo || ''} ${sede.civico || ''} - ${sede.citta || ''}`.trim().replace(/^ - | - $/g, ''));
        }
      });
    }
    return indirizzi;
  }, [clienteData]);

  const handleStartAdd = () => {
    setActionType('add');
    setActiveId(null);
    setStep(1);
    setFormData({
      ...formData,
      numeroChiavi: 1,
      assegnazioniDaAggiungere: [{ dipendenteId: '', assegnatoATesto: '', note: '', indirizzo: indirizziDisponibili.length > 0 ? indirizziDisponibili[0] : '' }],
      dipendenteId: '',
      assegnatoATesto: '',
      numCopia: '',
      note: '',
      moduloClienteFile: null,
      moduloDipendenteFile: null,
      dataRestituzione: new Date().toISOString().split('T')[0],
      dataVerbale: new Date().toISOString().split('T')[0],
      indirizzoConfermato: false
    });
  };

  const handleStartMove = (ass) => {
    setActionType('move');
    setActiveId(ass.id);
    setStep(1);
    setFormData({
      dipendenteId: '',
      assegnatoATesto: '',
      numCopia: ass.num_copia,
      note: '',
      moduloDipendenteFile: null,
      dataRestituzione: new Date().toISOString().split('T')[0],
      dataVerbale: new Date().toISOString().split('T')[0],
      indirizzoConfermato: false
    });
  };

  const handleStartReturn = (ass) => {
    setActionType('return');
    setActiveId(ass.id);
    setStep(1);
    setFormData({
      dipendenteId: '',
      assegnatoATesto: '',
      numCopia: ass.num_copia,
      note: '',
      hasModuloCliente: false, // In questo caso serve per segnare se abbiamo il verbale di RICONSEGNA
      hasModuloDipendente: true, // Non serve
      dataRestituzione: new Date().toISOString().split('T')[0],
      dataVerbale: new Date().toISOString().split('T')[0],
      indirizzoConfermato: false
    });
  };

  const handleChangeDipendente = (e) => {
    const val = e.target.value;
    if (val === 'UFFICIO') {
      setFormData({...formData, dipendenteId: '', assegnatoATesto: 'UFFICIO'});
    } else {
      setFormData({...formData, dipendenteId: val, assegnatoATesto: ''});
    }
  };

  const handleSubmit = async () => {
    try {
      if (actionType === 'add') {
        let moduloClientePath = null;
        if (formData.moduloClienteFile) {
          moduloClientePath = await uploadFileCliente(
             clienteId, 
             formData.moduloClienteFile, 
             'Modulo_Consegna_Chiavi_Cliente', 
             clienteData?.ragione_sociale || 'Cliente', 
             ''
          );
        }
        
        let moduloDipendentePath = null;
        if (formData.moduloDipendenteFile) {
          moduloDipendentePath = await uploadFileCliente(
             clienteId, 
             formData.moduloDipendenteFile, 
             'Modulo_Presa_In_Carico_Dipendente', 
             clienteData?.ragione_sociale || 'Cliente', 
             ''
          );
        }
        
        const startNumCopia = assegnazioni.length > 0 ? Math.max(...assegnazioni.map(a => a.num_copia)) + 1 : 1;
        
        for (let i = 0; i < formData.assegnazioniDaAggiungere.length; i++) {
          const ass = formData.assegnazioniDaAggiungere[i];
          await salvaNuovaAssegnazioneChiavi({
            clienteId,
            dipendenteId: ass.dipendenteId,
            assegnatoATesto: ass.assegnatoATesto,
            numCopia: startNumCopia + i,
            note: ass.note,
            moduloClientePath,
            moduloDipendentePath
          });
        }
      } else if (actionType === 'move') {
        let moduloDipendentePath = null;
        if (formData.moduloDipendenteFile) {
          moduloDipendentePath = await uploadFileCliente(
             clienteId, 
             formData.moduloDipendenteFile, 
             'Modulo_Presa_In_Carico_Dipendente', 
             clienteData?.ragione_sociale || 'Cliente', 
             ''
          );
        }

        await assegnaAdAltroOperatore({
          idAssegnazione: activeId,
          dipendenteId: formData.dipendenteId,
          assegnatoATesto: formData.assegnatoATesto,
          note: formData.note,
          dataSpostamento: formData.dataRestituzione,
          moduloDipendentePath
        });
      } else if (actionType === 'return') {
        await riconsegnaChiaveAlCliente({
          idAssegnazione: activeId,
          dataRestituzione: formData.dataRestituzione,
          note: formData.note
        });
      }
      
      handleCancel();
      if (onAggiornamento) onAggiornamento();
    } catch (err) {
      console.error(err);
      setModal({
        isOpen: true,
        type: 'error',
        title: 'Attenzione',
        content: 'Errore durante il salvataggio',
        primaryAction: { label: 'Chiudi', onClick: () => setModal({ isOpen: false }) }
      });
    }
  };

  const getNomePossessore = (ass) => {
    if (ass.assegnato_a_testo) return ass.assegnato_a_testo;
    if (ass.dipendente_id) {
      const d = dipendenti.find(d => d.id === ass.dipendente_id);
      return d ? d.nomeCompleto : 'Sconosciuto';
    }
    return 'Non assegnato';
  };

  // Sezione Stampa
  if (printModulo) {
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
        <div className="p-4 bg-slate-100 border-b border-slate-300 print:hidden flex justify-between items-center">
          <button onClick={() => setPrintModulo(null)} className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700">Torna indietro</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Stampa PDF</button>
        </div>
        
        {printModulo === 'cliente_ricezione' && (
          <PrintableModuloConsegnaCliente 
            clienteData={clienteData} 
            aziendaData={aziendaData}
            dataVerbale={formData.dataVerbale}
            note={formData.note}
            indirizzoStampa={
              actionType === 'add' && formData.assegnazioniDaAggiungere.length > 0
                ? formData.assegnazioniDaAggiungere[0].indirizzo
                : (formData.sceltaSede === 'altro' ? formData.indirizzoImmobile : (clienteData.indirizzoSede || clienteData.indirizzo_sede || ''))
            }
            cittaStampa={
              actionType === 'add' && formData.assegnazioniDaAggiungere.length > 0
                ? '' // citta is already in indirizzo string
                : (formData.sceltaSede === 'altro' ? formData.cittaImmobile : (clienteData.citta || clienteData.citta_sede ? `${clienteData.citta || clienteData.citta_sede} (${clienteData.provincia || clienteData.provincia_sede || ''})` : ''))
            }
          />
        )}
        
        {printModulo === 'cliente_riconsegna' && (
          <ModuloRiconsegnaCliente 
            clienteData={clienteData}
            aziendaData={aziendaData}
            dataVerbale={formData.dataVerbale}
            infoRiconsegna={{ numCopia: formData.numCopia, dataRestituzione: formData.dataRestituzione, note: formData.note }}
            indirizzoStampa={formData.sceltaSede === 'altro' ? formData.indirizzoImmobile : (clienteData.indirizzoSede || clienteData.indirizzo_sede || '')}
            cittaStampa={formData.sceltaSede === 'altro' ? formData.cittaImmobile : (clienteData.citta || clienteData.citta_sede ? `${clienteData.citta || clienteData.citta_sede} (${clienteData.provincia || clienteData.provincia_sede || ''})` : '')}
          />
        )}
        
        {printModulo === 'dipendente' && (
          <PrintableModuloChiavi 
            formData={{ dataVerbale: formData.dataVerbale, clienteNome: clienteData.ragioneSociale || clienteData.ragione_sociale }} 
            dipendenteData={
              actionType === 'add' && formData.assegnazioniDaAggiungere.length > 0
                ? (dipendenti.find(d => d.id === formData.assegnazioniDaAggiungere[0].dipendenteId) || {nomeCompleto: formData.assegnazioniDaAggiungere[0].assegnatoATesto})
                : (dipendenti.find(d => d.id === formData.dipendenteId) || {nomeCompleto: formData.assegnatoATesto})
            } 
            aziendaData={aziendaData}
            indirizzoStampa={
              actionType === 'add' && formData.assegnazioniDaAggiungere.length > 0
                ? formData.assegnazioniDaAggiungere[0].indirizzo
                : (formData.sceltaSede === 'altro' ? formData.indirizzoImmobile : (clienteData.indirizzoSede || clienteData.indirizzo_sede || ''))
            }
            cittaStampa={
              actionType === 'add' && formData.assegnazioniDaAggiungere.length > 0
                ? '' // citta is already in indirizzo string
                : (formData.sceltaSede === 'altro' ? formData.cittaImmobile : (clienteData.citta || clienteData.citta_sede ? `${clienteData.citta || clienteData.citta_sede} (${clienteData.provincia || clienteData.provincia_sede || ''})` : ''))
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-900/30 p-6 rounded-xl border border-slate-700/50">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Key className="w-4 h-4" /> Gestione Chiavi Attive
        </h3>
        {!actionType && (
          <button 
            onClick={handleStartAdd}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nuova Copia M2I
          </button>
        )}
      </div>

      {!actionType ? (
        <div className="space-y-4">
          {assegnazioni.length === 0 ? (
            <div className="text-center p-6 text-slate-500 border border-slate-700/50 rounded-xl border-dashed">
              Nessuna chiave in nostro possesso attualmente.
            </div>
          ) : (
            assegnazioni.map(ass => (
              <div key={ass.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-full font-bold">
                      Copia {ass.num_copia}
                    </span>
                    <span className="text-slate-200 font-medium">{getNomePossessore(ass)}</span>
                  </div>
                  {ass.note && <p className="text-sm text-slate-400">Note: {ass.note}</p>}
                  <p className="text-xs text-slate-500 mt-1">Assegnata dal: {ass.data_assegnazione}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleStartMove(ass)} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors flex items-center gap-1">
                    <ArrowRightLeft className="w-4 h-4" /> Passa
                  </button>
                  <button onClick={() => handleStartReturn(ass)} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors flex items-center gap-1">
                    <Undo2 className="w-4 h-4" /> Riconsegna a Cliente
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-slate-800 p-6 rounded-xl border border-indigo-500/30">
          <h4 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
            {actionType === 'add' && 'Nuova Assegnazione Chiave'}
            {actionType === 'move' && `Passaggio Copia ${formData.numCopia} ad altro operatore`}
            {actionType === 'return' && `Riconsegna Copia ${formData.numCopia} al Cliente`}
          </h4>

          {/* Stepper logic */}
          {actionType === 'return' ? (
            // FLUSSO RICONSEGNA
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Data Riconsegna</label>
                  <input type="date" value={formData.dataRestituzione} onChange={(e) => setFormData({...formData, dataRestituzione: e.target.value})} className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-200 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Motivo / Note</label>
                  <input type="text" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} placeholder="Es. Fine appalto, Sostituzione serratura" className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-200 outline-none" />
                </div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mt-6">
                <h5 className="text-sm font-medium text-slate-200 mb-4">Modulo di Riconsegna</h5>
                <div className="flex flex-col md:flex-row gap-4 justify-center">
                  <button 
                    onClick={() => setPrintModulo('cliente_riconsegna')}
                    className="flex-1 max-w-xs flex flex-col items-center p-4 bg-slate-800 border border-slate-600 rounded-xl hover:border-indigo-500 transition-colors"
                  >
                    <FileText className="w-6 h-6 text-indigo-400 mb-2" />
                    <span className="font-medium text-slate-200">Genera Verbale PDF</span>
                    <span className="text-xs text-slate-400 text-center mt-1">Stampa con firma e timbro M2I per ricevuta cliente</span>
                  </button>

                  <div className="flex-1 max-w-xs flex flex-col items-center p-4 bg-slate-800 border border-slate-600 rounded-xl hover:border-emerald-500 transition-colors cursor-pointer relative">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" title="Carica PDF firmato" />
                    <Upload className="w-6 h-6 text-emerald-400 mb-2" />
                    <span className="font-medium text-slate-200">Carica Firmato</span>
                    <span className="text-xs text-slate-400 text-center mt-1">Se hai già il foglio firmato</span>
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-3">
                  <input 
                    type="checkbox" 
                    id="hasReturnDoc" 
                    checked={formData.hasModuloCliente}
                    onChange={(e) => setFormData({...formData, hasModuloCliente: e.target.checked})}
                    className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-600" 
                  />
                  <label htmlFor="hasReturnDoc" className="text-sm text-slate-300">
                    Confermo di aver raccolto la firma del cliente per ricevuta riconsegna chiavi.
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button onClick={handleCancel} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">Annulla</button>
                <button 
                  onClick={handleSubmit} 
                  disabled={!formData.hasModuloCliente}
                  className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-bold"
                >
                  <CheckCircle2 className="w-5 h-5" /> Conferma Riconsegna
                </button>
              </div>
            </div>
          ) : (
            // FLUSSO AGGIUNGI O PASSA
            <div className="space-y-6">
              {/* Stepper Nav */}
              <div className="flex items-center mb-8">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'} font-bold`}>1</div>
                <div className={`h-1 flex-1 mx-2 ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-700'}`}></div>
                {actionType === 'add' && (
                  <>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'} font-bold`}>2</div>
                    <div className={`h-1 flex-1 mx-2 ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-700'}`}></div>
                  </>
                )}
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= (actionType === 'add' ? 3 : 2) ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'} font-bold`}>
                  {actionType === 'add' ? '3' : '2'}
                </div>
              </div>

              {step === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  {actionType === 'add' ? (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Numero di chiavi ricevute</label>
                        <input 
                          type="number" 
                          min="1" 
                          value={formData.numeroChiavi} 
                          onChange={(e) => {
                            const count = Math.max(1, parseInt(e.target.value) || 1);
                            const newArr = [...formData.assegnazioniDaAggiungere];
                            if (count > newArr.length) {
                              for (let i = newArr.length; i < count; i++) {
                                newArr.push({ dipendenteId: '', assegnatoATesto: '', note: '', indirizzo: indirizziDisponibili.length > 0 ? indirizziDisponibili[0] : '' });
                              }
                            } else if (count < newArr.length) {
                              newArr.length = count;
                            }
                            setFormData({...formData, numeroChiavi: count, assegnazioniDaAggiungere: newArr});
                          }} 
                          className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-200 outline-none max-w-xs" 
                        />
                      </div>
                      <div className="space-y-4">
                        {formData.assegnazioniDaAggiungere.map((ass, idx) => (
                          <div key={idx} className="bg-slate-900/50 p-4 border border-slate-700 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2 flex items-center justify-between border-b border-slate-700 pb-2">
                              <span className="text-sm font-bold text-indigo-400">Chiave {idx + 1}</span>
                              <span className="text-xs text-slate-500">Sarà Copia N. {assegnazioni.length > 0 ? Math.max(...assegnazioni.map(a => a.num_copia)) + 1 + idx : 1 + idx}</span>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-1">Assegna a</label>
                              <select 
                                value={ass.dipendenteId || (ass.assegnatoATesto === 'UFFICIO' ? 'UFFICIO' : '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const newArr = [...formData.assegnazioniDaAggiungere];
                                  if (val === 'UFFICIO') {
                                    newArr[idx] = { ...newArr[idx], dipendenteId: '', assegnatoATesto: 'UFFICIO' };
                                  } else {
                                    newArr[idx] = { ...newArr[idx], dipendenteId: val, assegnatoATesto: '' };
                                  }
                                  setFormData({...formData, assegnazioniDaAggiungere: newArr});
                                }}
                                className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-200 outline-none"
                              >
                                <option value="">-- Seleziona --</option>
                                <option value="UFFICIO">🏢 In Ufficio (Nessun dipendente)</option>
                                {dipendenti.map(d => (
                                  <option key={d.id} value={d.id}>👤 {d.nomeCompleto}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-1">Note (Opzionale)</label>
                              <input 
                                type="text" 
                                value={ass.note} 
                                onChange={(e) => {
                                  const newArr = [...formData.assegnazioniDaAggiungere];
                                  newArr[idx] = { ...newArr[idx], note: e.target.value };
                                  setFormData({...formData, assegnazioniDaAggiungere: newArr});
                                }} 
                                placeholder="Es. telecomando incluso" 
                                className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-200 outline-none" 
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-slate-300 mb-1">Indirizzo Immobile</label>
                              <div className="flex gap-2">
                                {indirizziDisponibili.length > 0 && (
                                  <select 
                                    className="p-2.5 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-200 outline-none max-w-[200px]"
                                    value={indirizziDisponibili.includes(ass.indirizzo) ? ass.indirizzo : ""}
                                    onChange={(e) => {
                                      if(e.target.value) {
                                        const newArr = [...formData.assegnazioniDaAggiungere];
                                        newArr[idx] = { ...newArr[idx], indirizzo: e.target.value };
                                        setFormData({...formData, assegnazioniDaAggiungere: newArr});
                                      }
                                    }}
                                  >
                                    <option value="">-- Seleziona --</option>
                                    {indirizziDisponibili.map((ind, i) => (
                                      <option key={i} value={ind}>{ind}</option>
                                    ))}
                                  </select>
                                )}
                                <input 
                                  type="text" 
                                  value={ass.indirizzo || ''} 
                                  onChange={(e) => {
                                    const newArr = [...formData.assegnazioniDaAggiungere];
                                    newArr[idx] = { ...newArr[idx], indirizzo: e.target.value };
                                    setFormData({...formData, assegnazioniDaAggiungere: newArr});
                                  }} 
                                  placeholder="Digita o seleziona un indirizzo..." 
                                  className="flex-1 p-2.5 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-200 outline-none" 
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Assegna a</label>
                        <select 
                          value={formData.dipendenteId || (formData.assegnatoATesto === 'UFFICIO' ? 'UFFICIO' : '')}
                          onChange={handleChangeDipendente}
                          className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-200 outline-none"
                        >
                          <option value="">-- Seleziona --</option>
                          <option value="UFFICIO">🏢 In Ufficio (Nessun dipendente)</option>
                          {dipendenti.map(d => (
                            <option key={d.id} value={d.id}>👤 {d.nomeCompleto}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Note (Opzionale)</label>
                        <input type="text" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} placeholder="Es. Consegnata al portiere" className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-200 outline-none" />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
                    <button onClick={handleCancel} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">Annulla</button>
                    <button 
                      onClick={() => setStep(2)} 
                      disabled={actionType === 'add' ? formData.assegnazioniDaAggiungere.some(a => !a.dipendenteId && !a.assegnatoATesto) : (!formData.dipendenteId && !formData.assegnatoATesto)}
                      className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      Avanti <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && actionType === 'add' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="text-center mb-8">
                    <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <h5 className="text-xl font-bold text-slate-200">Modulo Cliente → M2I</h5>
                    <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
                      Per procedere è necessario il verbale firmato dal cliente che attesta la consegna delle chiavi alla M2I.
                    </p>
                  </div>
                  
                  <div className="border border-slate-700 rounded-xl p-6 bg-slate-900/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Genera Bozza */}
                      <button 
                        onClick={() => setShowDateModalFor('cliente_ricezione')}
                        className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 hover:border-slate-600 transition-all group"
                      >
                        <FileText className="w-8 h-8 text-slate-400 mb-3 group-hover:text-indigo-400 transition-colors" />
                        <span className="font-bold text-slate-200 text-lg group-hover:text-white transition-colors">Genera Bozza PDF</span>
                      </button>

                      {/* Carica Firmato */}
                      <div className="relative flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 hover:border-slate-600 transition-all group cursor-pointer">
                        <input 
                          type="file" 
                          id="moduloCliente" 
                          accept="image/*,application/pdf"
                          onChange={(e) => setFormData({...formData, moduloClienteFile: e.target.files[0]})}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <Upload className="w-8 h-8 text-slate-400 mb-3 group-hover:text-indigo-400 transition-colors" />
                        <span className="font-bold text-slate-200 text-lg group-hover:text-white transition-colors">carica modulo gia firmato</span>
                        {formData.moduloClienteFile && (
                          <div className="text-xs text-emerald-400 flex items-center gap-1 mt-3 absolute bottom-2">
                            <CheckCircle2 className="w-4 h-4" /> {formData.moduloClienteFile.name}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-700">
                    <button onClick={() => setStep(1)} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                      <ChevronLeft className="w-4 h-4" /> indietro
                    </button>
                    
                    <div className="text-center">
                       <button onClick={() => setStep(3)} className="px-6 py-2.5 bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 transition-colors">
                         salta e carica in seguito
                       </button>
                    </div>

                    <button 
                      onClick={() => setStep(3)} 
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Avanti <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {(step === 3 || (step === 2 && actionType === 'move')) && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="text-center mb-8">
                    <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <h5 className="text-xl font-bold text-slate-200">Modulo M2I → Dipendente</h5>
                    <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
                      Per formalizzare la presa in carico, è necessario il verbale firmato dal dipendente.
                    </p>
                  </div>

                  {(actionType === 'add' ? formData.assegnazioniDaAggiungere.some(a => a.dipendenteId) : formData.dipendenteId) ? (
                    <div className="border border-slate-700 rounded-xl p-6 bg-slate-900/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Genera Bozza */}
                        <button 
                          onClick={() => setShowDateModalFor('dipendente')}
                          className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 hover:border-slate-600 transition-all group"
                        >
                          <FileText className="w-8 h-8 text-slate-400 mb-3 group-hover:text-amber-400 transition-colors" />
                          <span className="font-bold text-slate-200 text-lg group-hover:text-white transition-colors">Genera Bozza PDF</span>
                        </button>

                        {/* Carica Firmato */}
                        <div className="relative flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 hover:border-slate-600 transition-all group cursor-pointer">
                          <input 
                            type="file" 
                            accept="image/*,application/pdf"
                            onChange={(e) => setFormData({...formData, moduloDipendenteFile: e.target.files[0]})}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          <Upload className="w-8 h-8 text-slate-400 mb-3 group-hover:text-amber-400 transition-colors" />
                          <span className="font-bold text-slate-200 text-lg group-hover:text-white transition-colors">carica modulo gia firmato</span>
                          {formData.moduloDipendenteFile && (
                            <div className="text-xs text-emerald-400 flex items-center gap-1 mt-3 absolute bottom-2">
                              <CheckCircle2 className="w-4 h-4" /> {formData.moduloDipendenteFile.name}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg text-amber-200/80 text-sm text-center">
                      Chiavi in ufficio. Non è necessario il verbale dipendente.
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-700">
                    <button onClick={() => setStep(actionType === 'add' ? 2 : 1)} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                      <ChevronLeft className="w-4 h-4" /> indietro
                    </button>
                    
                    {(actionType === 'add' ? formData.assegnazioniDaAggiungere.some(a => a.dipendenteId) : formData.dipendenteId) && (
                      <div className="text-center">
                         <button onClick={handleSubmit} className="px-6 py-2.5 bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 transition-colors">
                           salta e carica in seguito
                         </button>
                      </div>
                    )}

                    <button 
                      onClick={handleSubmit} 
                      className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Completa <CheckCircle2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {showDateModalFor && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-800 p-6 rounded-xl w-full max-w-sm border border-slate-600 shadow-xl">
            <h4 className="text-lg font-bold text-slate-200 mb-2">Data sul Modulo</h4>
            <p className="text-sm text-slate-400 mb-6">Scegli la data da stampare sul PDF. Di default è impostata quella odierna.</p>
            
            <input 
              type="date" 
              value={formData.dataVerbale}
              onChange={(e) => setFormData({...formData, dataVerbale: e.target.value})}
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-indigo-500 outline-none mb-6"
            />
            
            {(!formData.indirizzoConfermato || showDateModalFor !== 'dipendente') && (
              <>
                <h4 className="text-lg font-bold text-slate-200 mb-2">Sede dell'immobile</h4>
                <p className="text-sm text-slate-400 mb-2">Indirizzo dei locali a cui le chiavi danno accesso.</p>
                <select 
                  value={formData.sceltaSede}
                  onChange={(e) => setFormData({...formData, sceltaSede: e.target.value})}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-indigo-500 outline-none mb-4"
                >
                  <option value="cliente">
                    {(clienteData.indirizzoSede || clienteData.indirizzo_sede || 'Sede Principale')} 
                    {(clienteData.citta || clienteData.citta_sede) ? ` - ${clienteData.citta || clienteData.citta_sede}` : ''}
                  </option>
                  <option value="altro">Altro Indirizzo...</option>
                </select>
                
                {formData.sceltaSede === 'altro' && (
                  <div className="space-y-4 mb-6">
                    <input 
                      type="text" 
                      placeholder="Indirizzo immobile (es. Via Roma 1)"
                      value={formData.indirizzoImmobile}
                      onChange={(e) => setFormData({...formData, indirizzoImmobile: e.target.value})}
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-indigo-500 outline-none"
                    />
                    <input 
                      type="text" 
                      placeholder="Città"
                      value={formData.cittaImmobile}
                      onChange={(e) => setFormData({...formData, cittaImmobile: e.target.value})}
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-indigo-500 outline-none"
                    />
                  </div>
                )}
              </>
            )}
            
            <div className="flex justify-end gap-3 mt-4">
              <button 
                onClick={() => setShowDateModalFor(null)} 
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Annulla
              </button>
              <button 
                onClick={() => {
                  setPrintModulo(showDateModalFor);
                  setFormData({...formData, indirizzoConfermato: true});
                  setShowDateModalFor(null);
                }}
                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Genera PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <ModernModal 
        {...modal} 
        onClose={() => setModal({ isOpen: false })} 
      />
    </div>
  );
}
