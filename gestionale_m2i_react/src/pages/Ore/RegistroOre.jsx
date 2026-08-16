import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CalendarDays, Save, Plus, Trash2, Download, Upload, Loader2, RefreshCw, AlertTriangle, ListTodo, Edit, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { recuperaElencoDipendenti } from '../../api/dipendenti';
import { recuperaElencoClienti } from '../../api/clienti';
import { recuperaOreMensili, salvaRegistroOreMensili, precompilaDaProgrammaFisso, svuotaRegistroOreMensili } from '../../api/ore';
import ModernModal from '../../components/ui/ModernModal';
import SearchableClientSelect from '../../components/ui/SearchableClientSelect';

export default function RegistroOre() {
  const [dipendenti, setDipendenti] = useState([]);
  const [clienti, setClienti] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // Ref per sapere se il mount iniziale è già stato gestito da inizializza()
  const isInitialMount = useRef(true);
  
  // Filtri (con persistenza sessione)
  const [mese, setMese] = useState(() => {
    const saved = sessionStorage.getItem('ro_mese');
    return saved ? Number(saved) : new Date().getMonth() + 1;
  });
  const [anno, setAnno] = useState(() => {
    const saved = sessionStorage.getItem('ro_anno');
    return saved ? Number(saved) : new Date().getFullYear();
  });
  const [idDipendente, setIdDipendente] = useState(() => {
    return sessionStorage.getItem('ro_dipendente') || '';
  });

  useEffect(() => {
    sessionStorage.setItem('ro_mese', mese);
    sessionStorage.setItem('ro_anno', anno);
    sessionStorage.setItem('ro_dipendente', idDipendente);
  }, [mese, anno, idDipendente]);

  // Metodo Inserimento: null (da scegliere), 'Calendarizzata', 'Mensile Totale'
  const [metodoInserimento, setMetodoInserimento] = useState(null);
  
  // Sola lettura (disabilitata per l'autosave)
  const [isReadOnly, setIsReadOnly] = useState(true);

  // Dati griglia a calendario (Array di array. Indice = giorno del mese - 1)
  const [giorniData, setGiorniData] = useState([]);
  // Dati mensile totale
  const [totaleMensileData, setTotaleMensileData] = useState([]);
  
  // Giorno selezionato per apertura modale dettaglio
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, type: '', message: '' });
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [scaricaModalOpen, setScaricaModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [showBigAlert, setShowBigAlert] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (idDipendente && mese && anno) {
      setShowBigAlert(true);
    }
  }, [idDipendente, mese, anno]);

  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving', 'saved', 'error'

  // Autosave
  useEffect(() => {
    if (!isDirty || !metodoInserimento) return;
    
    const timeout = setTimeout(() => {
      salvaOre(true);
    }, 1500);

    return () => clearTimeout(timeout);
  }, [giorniData, totaleMensileData, isDirty, metodoInserimento]);
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dipendente_id', idDipendente);
    formData.append('mese', mese);
    formData.append('anno', anno);
    
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/excel/carica-presenze', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      setModalState({ isOpen: true, type: 'success', message: 'Dati importati con successo! Ricaricamento in corso...' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: err.message || 'Errore durante il caricamento' });
    } finally {
      setIsUploading(false);
      e.target.value = null; // reseta l'input
    }
  };

  const mesi = [
    { val: 1, label: 'Gennaio' }, { val: 2, label: 'Febbraio' }, { val: 3, label: 'Marzo' },
    { val: 4, label: 'Aprile' }, { val: 5, label: 'Maggio' }, { val: 6, label: 'Giugno' },
    { val: 7, label: 'Luglio' }, { val: 8, label: 'Agosto' }, { val: 9, label: 'Settembre' },
    { val: 10, label: 'Ottobre' }, { val: 11, label: 'Novembre' }, { val: 12, label: 'Dicembre' }
  ];

  const causali = ["Ordinario", "Straordinario", "Extra 🌟", "Festivo", "Ferie", "Malattia", "Permesso", "Permesso Retribuito", "Permesso Non Retribuito", "104 (1*)", "104 (2*)", "Assenza", "Infortunio", "Maternità/Paternità"];
  // Causali per le quali ha senso avere un cliente associato
  const causaliConCliente = ["Ordinario", "Straordinario"];

  const giorniMese = useMemo(() => {
    return new Date(anno, mese, 0).getDate();
  }, [mese, anno]);

  // Helper: normalizza la risposta del backend (vecchio formato array piatto O nuovo { metodo, righe })
  function parseOreResponse(res) {
    if (!res) return { metodo: null, righe: [] };
    if (Array.isArray(res)) {
      // Vecchio formato: array piatto di righe
      const righe = res;
      const metodo = righe.length > 0 ? (righe[0].metodo_inserimento || 'Calendarizzata') : null;
      return { metodo, righe };
    }
    // Nuovo formato: { metodo, righe }
    return { metodo: res.metodo || null, righe: res.righe || [] };
  }

  useEffect(() => {
    async function inizializza() {
      try {
        const [dips, clis] = await Promise.all([
          recuperaElencoDipendenti(),
          recuperaElencoClienti()
        ]);
        setDipendenti(dips || []);
        setClienti(clis || []);

        const dipSalvato = sessionStorage.getItem('ro_dipendente') || '';
        const meseSalvato = Number(sessionStorage.getItem('ro_mese')) || new Date().getMonth() + 1;
        const annoSalvato = Number(sessionStorage.getItem('ro_anno')) || new Date().getFullYear();

        console.log('[INIT] dipSalvato:', dipSalvato, 'mese:', meseSalvato, 'anno:', annoSalvato);

        if (dipSalvato) {
          const numGiorni = new Date(annoSalvato, meseSalvato, 0).getDate();
          console.log('[INIT] chiamo recuperaOreMensili...');
          const raw = await recuperaOreMensili(dipSalvato, meseSalvato, annoSalvato);
          console.log('[INIT] risposta recuperaOreMensili:', JSON.stringify(raw));
          const { metodo: metodoRes, righe } = parseOreResponse(raw);
          console.log('[INIT] metodo:', metodoRes, 'righe:', righe.length);
          if (righe.length > 0 && metodoRes) {
            setMetodoInserimento(metodoRes);
            setIsReadOnly(true);
            if (metodoRes === 'Mensile Totale') {
              setTotaleMensileData(righe.map(r => ({
                id: r.id || Math.random().toString(36).substring(7),
                idCliente: r.idCliente || '',
                causale: r.causale || 'Ordinario',
                ore_totali: r.ore_totali || 0,
                note: r.note || ''
              })));
            } else {
              const cal = Array.from({length: numGiorni}, () => []);
              righe.forEach(r => {
                if (!r.giorni) return;
                r.giorni.forEach((ore, gIndex) => {
                  if (gIndex >= numGiorni) return;
                  const h = parseFloat(ore);
                  if (h > 0) {
                    cal[gIndex].push({
                      id: Math.random().toString(36).substring(7),
                      idCliente: r.idCliente || '',
                      causale: r.causale || 'Ordinario',
                      ore: h
                    });
                  }
                });
              });
              setGiorniData(cal);
            }
          } else {
            console.log('[INIT] Nessun dato trovato nel DB per questo dipendente/mese/anno');
          }
        } else {
          console.log('[INIT] Nessun dipendente salvato in sessionStorage');
        }
      } catch (err) {
        console.error('[INIT] Errore inizializzazione:', err);
      } finally {
        setIsLoading(false);
      }
    }
    inizializza();
  }, []);

  // Conversione dal DB al formato Calendario
  const righeToCalendar = useCallback((righe, numGiorni) => {
    const cal = Array.from({length: numGiorni}, () => []);
    if (!righe || righe.length === 0) return cal;
    righe.forEach(r => {
      if (!r.giorni) return;
      r.giorni.forEach((ore, gIndex) => {
        if (gIndex >= numGiorni) return;
        const h = parseFloat(ore);
        if (h > 0) {
          cal[gIndex].push({
            id: Math.random().toString(36).substring(7),
            idCliente: r.idCliente || '',
            causale: r.causale || 'Ordinario',
            ore: h
          });
        }
      });
    });
    return cal;
  }, []);

  // Conversione dal Calendario al formato DB (aggregando per Cliente+Causale)
  const calendarToRighe = useCallback((calData) => {
    const righeMap = {};
    calData.forEach((entries, gIndex) => {
      entries.forEach(entry => {
        const h = parseFloat(entry.ore);
        if (h > 0) {
          const key = `${entry.idCliente || ''}_${entry.causale || 'Ordinario'}`;
          if (!righeMap[key]) {
            righeMap[key] = {
              idCliente: entry.idCliente || null,
              causale: entry.causale || 'Ordinario',
              note: '',
              giorni: Array(calData.length).fill('')
            };
          }
          const curr = parseFloat(righeMap[key].giorni[gIndex]) || 0;
          righeMap[key].giorni[gIndex] = (curr + h).toString();
        }
      });
    });
    return Object.values(righeMap);
  }, []);

  const caricaGriglia = useCallback(async (dipId, m, a) => {
    const numGiorni = new Date(a, m, 0).getDate();
    setIsLoading(true);
    try {
      const raw = await recuperaOreMensili(dipId, m, a);
      const { metodo: metodoRes, righe } = parseOreResponse(raw);
      if (righe.length > 0 && metodoRes) {
        setMetodoInserimento(metodoRes);
        if (metodoRes === 'Mensile Totale') {
          setTotaleMensileData(righe.map(r => ({
            id: r.id || Math.random().toString(36).substring(7),
            idCliente: r.idCliente || '',
            causale: r.causale || 'Ordinario',
            ore_totali: r.ore_totali || 0,
            note: r.note || ''
          })));
        } else {
          setGiorniData(righeToCalendar(righe, numGiorni));
        }
        setIsDirty(false);
        setIsReadOnly(true);
      } else {
        setMetodoInserimento(null);
        setGiorniData(Array.from({length: numGiorni}, () => []));
        setTotaleMensileData([]);
      }
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore nel caricamento delle ore.' });
    } finally {
      setIsLoading(false);
    }
  }, [righeToCalendar]);

  useEffect(() => {
    // Al primo render, i dati vengono caricati da inizializza().
    // Questo useEffect deve scattare solo quando l'utente CAMBIA dipendente/mese/anno.
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (idDipendente && mese && anno) {
      caricaGriglia(idDipendente, mese, anno);
    } else {
      setMetodoInserimento(null);
      setGiorniData([]);
      setTotaleMensileData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDipendente, mese, anno]);

  const handlePrecompila = async () => {
    if (!idDipendente || metodoInserimento !== 'Calendarizzata') return;
    setIsLoading(true);
    try {
      const prog = await precompilaDaProgrammaFisso(idDipendente, mese, anno);
      if (prog && prog.length > 0) {
        const nuoveGiorni = righeToCalendar(prog, giorniMese);
        const merged = giorniData.length ? [...giorniData] : Array.from({length: giorniMese}, () => []);
        nuoveGiorni.forEach((entries, idx) => {
          if (entries.length > 0) {
            merged[idx] = [...(merged[idx] || []), ...entries];
          }
        });
        setGiorniData(merged);
        setIsDirty(true);
      } else {
        setModalState({ isOpen: true, type: 'success', message: 'Nessun programma fisso trovato per questo dipendente.' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const salvaOre = async (isAutosave = false) => {
    if (!idDipendente || !metodoInserimento) return;
    setSaveStatus('saving');
    try {
      let payload;
      if (metodoInserimento === 'Mensile Totale') {
        payload = {
          idDipendente, mese, anno, metodoInserimento: 'Mensile Totale',
          righe: totaleMensileData.map(r => ({
            idCliente: r.idCliente,
            causale: r.causale,
            note: r.note,
            ore_totali: parseFloat(r.ore_totali) || 0
          }))
        };
      } else {
        const righePerDb = calendarToRighe(giorniData);
        payload = {
          idDipendente, mese, anno, metodoInserimento: 'Calendarizzata',
          righe: righePerDb.map(r => ({
            idCliente: r.idCliente,
            causale: r.causale,
            note: r.note,
            giorni: r.giorni.map(g => parseFloat(g) || 0)
          }))
        };
      }
      
      await salvaRegistroOreMensili(payload);
      setIsDirty(false);
      setSaveStatus('saved');
      if (!isAutosave) {
        setModalState({ isOpen: true, type: 'success', message: 'Ore mensili salvate con successo!' });
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      if (!isAutosave) {
        setModalState({ isOpen: true, type: 'error', message: 'Errore nel salvataggio delle ore.' });
      }
    }
  };

  const handleResetMetodo = async () => {
    setResetModalOpen(false);
    setIsLoading(true);
    try {
      await svuotaRegistroOreMensili(idDipendente, mese, anno);
      setMetodoInserimento(null);
      setGiorniData(Array.from({length: giorniMese}, () => []));
      setTotaleMensileData([]);
      setIsDirty(false);
    } catch(err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore nel reset delle ore.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Funzioni gestione griglia (Calendarizzata)
  const addEntryToGiorno = (gIndex) => {
    const d = [...giorniData];
    d[gIndex].push({
      id: Math.random().toString(36).substring(7),
      idCliente: '',
      causale: 'Ordinario',
      ore: ''
    });
    setGiorniData(d);
    setIsDirty(true);
  };
  const removeEntryFromGiorno = (gIndex, entryId) => {
    const d = [...giorniData];
    d[gIndex] = d[gIndex].filter(e => e.id !== entryId);
    setGiorniData(d);
    setIsDirty(true);
  };
  const updateEntry = (gIndex, entryId, field, value) => {
    const d = [...giorniData];
    const entry = d[gIndex].find(e => e.id === entryId);
    if (entry) {
      if (field === 'ore') {
        const val = value.replace(',', '.');
        if (!isNaN(val) || val === '' || val === '.') entry[field] = val;
      } else {
        entry[field] = value;
      }
    }
    setGiorniData(d);
    setIsDirty(true);
  };

  // Funzioni gestione Mensile Totale
  const addRigaTotale = () => {
    setTotaleMensileData(prev => [
      ...prev,
      { id: Math.random().toString(36).substring(7), idCliente: '', causale: 'Ordinario', ore_totali: '', note: '' }
    ]);
    setIsDirty(true);
  };
  const removeRigaTotale = (id) => {
    setTotaleMensileData(prev => prev.filter(r => r.id !== id));
    setIsDirty(true);
  };
  const updateRigaTotale = (id, field, value) => {
    setTotaleMensileData(prev => prev.map(r => {
      if (r.id === id) {
        if (field === 'ore_totali') {
          const val = value.replace(',', '.');
          if (!isNaN(val) || val === '' || val === '.') return { ...r, [field]: val };
          return r;
        }
        return { ...r, [field]: value };
      }
      return r;
    }));
    setIsDirty(true);
  };

  // Calcolo offset primo giorno
  const firstDay = new Date(anno, mese - 1, 1).getDay();
  const emptyCellsCount = firstDay === 0 ? 6 : firstDay - 1; 

  const totaliPerCausale = useMemo(() => {
    const totali = {};
    if (metodoInserimento === 'Mensile Totale') {
      totaleMensileData.forEach(r => {
        const h = parseFloat(r.ore_totali) || 0;
        if (h > 0) {
          totali[r.causale] = (totali[r.causale] || 0) + h;
        }
      });
    } else if (metodoInserimento === 'Calendarizzata') {
      giorniData.forEach(entries => {
        entries.forEach(e => {
          const h = parseFloat(e.ore) || 0;
          if (h > 0) {
            totali[e.causale] = (totali[e.causale] || 0) + h;
          }
        });
      });
    }
    return totali;
  }, [giorniData, totaleMensileData, metodoInserimento]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto min-h-screen flex flex-col">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-3 bg-indigo-500/20 rounded-xl">
            <CalendarDays className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-50">Registro Ore</h1>
              <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 p-1 rounded-lg">
                <select 
                  value={mese} 
                  onChange={(e) => setMese(Number(e.target.value))}
                  className="bg-transparent text-indigo-400 font-bold uppercase tracking-wider text-lg focus:outline-none cursor-pointer px-2"
                >
                  {mesi.map(m => <option key={m.val} value={m.val} className="bg-slate-800 text-sm normal-case">{m.label}</option>)}
                </select>
                <input 
                  type="number" 
                  value={anno} 
                  onChange={(e) => setAnno(Number(e.target.value))}
                  className="bg-transparent text-indigo-400 font-bold uppercase tracking-wider text-lg focus:outline-none w-20 px-1"
                />
              </div>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {metodoInserimento === 'Mensile Totale' ? 'Compila presenze per Totale Mensile' : 'Compila le presenze per singolo giorno'}
            </p>
          </div>
        </div>

        {/* Parte Destra: Filtri e Azioni */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-wrap w-full xl:w-auto xl:justify-end">
          
          {/* Gruppo Selettore Dipendente */}
          <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-700 w-full sm:w-auto">
            <select 
              value={idDipendente} 
              onChange={(e) => setIdDipendente(e.target.value)}
              className="p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[250px] flex-1 sm:flex-none text-slate-200"
            >
              <option value="">-- Seleziona Dipendente --</option>
              {dipendenti.map(d => (
                <option key={d.id} value={d.id}>{d.nomeCompleto} ({d.id})</option>
              ))}
            </select>
          </div>

          {/* Gruppo Azioni */}
          <div className="flex flex-wrap items-center gap-2">
            {metodoInserimento === 'Calendarizzata' && !isReadOnly && (
              <button 
                onClick={() => handlePrecompila()}
                disabled={!idDipendente || isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors border border-slate-700 shadow-sm"
              >
                <Download className="w-4 h-4" /> Importa Programma
              </button>
            )}

            {metodoInserimento && !isReadOnly && (
              <button 
                onClick={() => setResetModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors border border-red-500/30 shadow-sm"
                title="Cambia il metodo di inserimento svuotando i dati correnti"
              >
                <RefreshCw className="w-4 h-4" /> Cambia Metodo
              </button>
            )}
            
            {idDipendente && metodoInserimento && (
              <>
                <button 
                  onClick={() => setResetModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors border border-red-500/30 shadow-sm"
                  title="Pulisci l'intero mese"
                >
                  <Trash2 className="w-4 h-4" /> Pulisci Mese
                </button>
                
                <button 
                  onClick={() => setIsReadOnly(!isReadOnly)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border shadow-sm
                    ${isReadOnly 
                      ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/30' 
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                    }`}
                  title={isReadOnly ? "Abilita le modifiche" : "Blocca e chiudi le modifiche"}
                >
                  {isReadOnly ? (
                    <><Edit className="w-4 h-4" /> Apri Modifica</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Termina Modifiche</>
                  )}
                </button>
              </>
            )}

            <button 
              onClick={() => setScaricaModalOpen(true)}
              disabled={!idDipendente}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50 transition-colors border border-emerald-500/30 shadow-sm"
              title="Scarica il Foglio Presenze in formato Excel"
            >
              <FileSpreadsheet className="w-4 h-4" /> Scarica Excel
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={!idDipendente || isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-600/30 disabled:opacity-50 transition-colors border border-indigo-500/30 shadow-sm"
              title="Carica un Foglio Presenze Excel precedentemente compilato"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Carica Excel
            </button>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden flex flex-col relative">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-800/70 z-10 flex items-center justify-center text-indigo-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}

        {!idDipendente ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-10">
            <CalendarDays className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Seleziona un dipendente per iniziare</p>
          </div>
        ) : !metodoInserimento ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 animate-in fade-in duration-300">
            <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-700 max-w-2xl text-center shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-2">Scegli il Metodo di Inserimento</h2>
              <p className="text-slate-400 mb-8">
                Per questo dipendente nel mese selezionato non sono state ancora inserite ore.
                Scegli se compilare le ore giorno per giorno (Calendario) oppure inserire i totali mensili.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <button 
                  onClick={() => {
                    setMetodoInserimento('Calendarizzata');
                    setGiorniData(Array.from({length: giorniMese}, () => []));
                    setIsReadOnly(false);
                  }}
                  className="flex-1 p-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-indigo-500 rounded-xl transition-all group flex flex-col items-center gap-4 cursor-pointer text-left shadow-md hover:shadow-indigo-500/20"
                >
                  <div className="p-4 bg-indigo-500/20 rounded-full group-hover:scale-110 transition-transform">
                    <CalendarDays className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white mb-1">Calendario Giornaliero</h3>
                    <p className="text-xs text-slate-400">Inserisci le ore specifiche giorno per giorno.</p>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setMetodoInserimento('Mensile Totale');
                    setTotaleMensileData([]);
                    setIsReadOnly(false);
                  }}
                  className="flex-1 p-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-emerald-500 rounded-xl transition-all group flex flex-col items-center gap-4 cursor-pointer text-left shadow-md hover:shadow-emerald-500/20"
                >
                  <div className="p-4 bg-emerald-500/20 rounded-full group-hover:scale-110 transition-transform">
                    <ListTodo className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white mb-1">Totale Mensile</h3>
                    <p className="text-xs text-slate-400">Inserisci solo il totale mensile per cliente o ferie.</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : metodoInserimento === 'Mensile Totale' ? (
          <div className="flex-1 overflow-auto bg-slate-900/50 p-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-700 bg-slate-900/30 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-emerald-400" /> Voci Mensili
                </h3>
                {!isReadOnly && (
                  <button 
                    onClick={addRigaTotale}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors border border-emerald-500/30"
                  >
                    <Plus className="w-4 h-4" /> Aggiungi Voce
                  </button>
                )}
              </div>
              
              <div className="p-4">
                {totaleMensileData.length === 0 ? (
                  <div className="text-center p-8 text-slate-400 border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/20">
                    <p>Nessuna voce inserita. Clicca su "Aggiungi Voce" per iniziare.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {totaleMensileData.map((riga, index) => (
                      <div key={riga.id} className="flex flex-wrap md:flex-nowrap gap-3 items-center bg-slate-900/80 p-3 rounded-lg border border-slate-700">
                        <div className="w-full md:w-1/3">
                          <label className="block text-xs font-medium text-slate-400 mb-1">Cliente / Destinazione</label>
                          <SearchableClientSelect 
                            value={causaliConCliente.includes(riga.causale) ? riga.idCliente : ''}
                            onChange={(val) => updateRigaTotale(riga.id, 'idCliente', val)}
                            disabled={isReadOnly || !causaliConCliente.includes(riga.causale)}
                            clienti={clienti}
                            placeholder="-- Seleziona (Facoltativo) --"
                            className={`bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none`}
                          />
                        </div>
                        
                        <div className="w-1/2 md:w-1/6">
                          <label className="block text-xs font-medium text-slate-400 mb-1">Causale</label>
                          <select 
                            value={riga.causale}
                            onChange={(e) => {
                              const nuovaCausale = e.target.value;
                              updateRigaTotale(riga.id, 'causale', nuovaCausale);
                              if (!causaliConCliente.includes(nuovaCausale)) {
                                updateRigaTotale(riga.id, 'idCliente', '');
                              }
                            }}
                            disabled={isReadOnly}
                            className={`w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            {causali.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div className="w-1/2 md:w-1/6">
                          <label className="block text-xs font-medium text-slate-400 mb-1">Ore Totali</label>
                          <div className="relative">
                            <input 
                              type="text"
                              value={riga.ore_totali}
                              onChange={(e) => updateRigaTotale(riga.id, 'ore_totali', e.target.value)}
                              placeholder="0.0"
                              disabled={isReadOnly}
                              className={`w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm text-emerald-300 font-bold focus:ring-2 focus:ring-emerald-500 outline-none pr-8 ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                            />
                            <span className="absolute right-3 top-2.5 text-slate-500 font-medium">h</span>
                          </div>
                        </div>

                        <div className="w-full md:w-1/3">
                          <label className="block text-xs font-medium text-slate-400 mb-1">Note (opzionale)</label>
                          <input 
                            type="text"
                            value={riga.note}
                            onChange={(e) => updateRigaTotale(riga.id, 'note', e.target.value)}
                            placeholder="Note aggiuntive..."
                            disabled={isReadOnly}
                            className={`w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                          />
                        </div>

                        {!isReadOnly && (
                          <div className="w-full md:w-auto flex justify-end md:mt-5">
                            <button 
                              onClick={() => removeRigaTotale(riga.id)}
                              className="p-2.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors border border-red-500/20"
                              title="Rimuovi riga"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Totali Mensili Box */}
            <div className="mt-8 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex flex-col gap-3 shadow-sm max-w-sm ml-auto">
              {Object.entries(totaliPerCausale).length === 0 ? (
                <div className="flex justify-between items-center">
                  <span className="text-emerald-200 font-medium text-lg">Totale Ore:</span>
                  <span className="text-3xl font-bold text-emerald-400">0 <span className="text-lg opacity-60">h</span></span>
                </div>
              ) : (
                Object.entries(totaliPerCausale).sort().map(([caus, tot]) => (
                  <div key={caus} className="flex justify-between items-center border-b border-emerald-500/20 pb-2 last:border-0 last:pb-0">
                    <span className="text-emerald-200 font-medium">{caus}:</span>
                    <span className="text-2xl font-bold text-emerald-400">{tot} <span className="text-sm opacity-60">h</span></span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-slate-900/50 p-4">
            {/* Header Giorni Settimana */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].map((g, i) => (
                <div key={i} className={`p-2 text-center text-xs font-bold uppercase tracking-wider rounded-lg border border-slate-700 shadow-sm
                  ${i === 5 ? 'bg-orange-500/20 text-orange-400' : i === 6 ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-300'}
                `}>
                  {g}
                </div>
              ))}
            </div>

            {/* Grid Calendario */}
            <div className="grid grid-cols-7 gap-2">
              {/* Celle Vuote per allineamento */}
              {Array.from({length: emptyCellsCount}).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[120px] rounded-xl bg-slate-800/30 border border-slate-800 border-dashed"></div>
              ))}

              {/* Celle Giorni */}
              {Array.from({length: giorniMese}).map((_, i) => {
                const gIndex = i;
                const dataCol = new Date(anno, mese - 1, i + 1);
                const isDomenica = dataCol.getDay() === 0;
                const isSabato = dataCol.getDay() === 6;
                const entries = giorniData[gIndex] || [];
                
                let bgClass = 'bg-slate-800 border-slate-700';
                if (isDomenica) bgClass = 'bg-red-500/10 border-red-500/20';
                else if (isSabato) bgClass = 'bg-orange-500/10 border-orange-500/20';

                return (
                  <div 
                    key={gIndex} 
                    className={`min-w-0 min-h-[140px] rounded-xl border flex flex-col shadow-sm transition-all hover:border-indigo-500/50 hover:shadow-indigo-500/10 cursor-pointer group ${bgClass}`}
                    onClick={() => setSelectedDayIndex(gIndex)}
                  >
                    {/* Header Cella */}
                    <div className={`p-2 flex justify-between items-center border-b border-black/10
                      ${isDomenica ? 'text-red-400' : isSabato ? 'text-orange-400' : 'text-slate-400'}
                    `}>
                      <span className="font-bold text-lg leading-none">{i + 1}</span>
                      {!isReadOnly && (
                        <div className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500/20 text-indigo-400" title="Modifica Giorno">
                          <Edit className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    {/* Voci Ore (Riepilogo) */}
                    <div className="p-2 flex-1 flex flex-col gap-1.5 overflow-y-auto">
                      {entries.length === 0 && !isReadOnly && (
                        <div className="text-xs text-slate-500/50 italic text-center mt-2 group-hover:text-indigo-400/70 transition-colors">
                          Clicca per aggiungere ore
                        </div>
                      )}
                      {entries.map(entry => {
                        const clientName = causaliConCliente.includes(entry.causale) ? 
                          (clienti.find(c => c.id?.toString() === entry.idCliente?.toString())?.ragione_sociale || 'Nessun Cliente') 
                          : null;
                        
                        return (
                          <div key={entry.id} className="bg-slate-900/60 p-1.5 rounded-md border border-slate-700/30 flex flex-col gap-0.5 text-xs shadow-sm">
                            {clientName && (
                              <span className="font-medium text-slate-300 truncate" title={clientName}>
                                {clientName}
                              </span>
                            )}
                            <div className="flex justify-between items-center gap-2 mt-0.5">
                              <span className={`truncate ${!causaliConCliente.includes(entry.causale) ? 'text-amber-400/90 font-medium' : 'text-slate-400'}`}>
                                {entry.causale}
                              </span>
                              <span className="font-bold text-indigo-300 whitespace-nowrap bg-indigo-500/10 px-1 rounded">
                                {entry.ore} h
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totali Mensili Box */}
            <div className="mt-8 bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex flex-col gap-3 shadow-sm max-w-sm ml-auto">
              {Object.entries(totaliPerCausale).length === 0 ? (
                <div className="flex justify-between items-center">
                  <span className="text-indigo-200 font-medium text-lg">Totale Ore:</span>
                  <span className="text-3xl font-bold text-indigo-400">0 <span className="text-lg opacity-60">h</span></span>
                </div>
              ) : (
                Object.entries(totaliPerCausale).sort().map(([caus, tot]) => (
                  <div key={caus} className="flex justify-between items-center border-b border-indigo-500/20 pb-2 last:border-0 last:pb-0">
                    <span className="text-indigo-200 font-medium">{caus}:</span>
                    <span className="text-2xl font-bold text-indigo-400">{tot} <span className="text-sm opacity-60">h</span></span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {idDipendente && metodoInserimento && !isReadOnly && (
          <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-end">
            <button 
              onClick={salvaOre}
              disabled={isSaving}
              className={`flex items-center gap-2 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors shadow-sm disabled:opacity-50
                ${metodoInserimento === 'Mensile Totale' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}
              `}
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? 'Salvataggio...' : 'Salva Registro Ore'}
            </button>
          </div>
        )}
      </div>

      {/* Finestra Modale Modifica Giorno */}
      {selectedDayIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl flex flex-col w-[95vw] max-w-6xl min-h-[75vh] max-h-[90vh] shadow-2xl overflow-hidden relative">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-400" />
                Dettaglio {selectedDayIndex + 1} {mesi.find(m => m.val === parseInt(mese))?.label}
              </h2>
              <button 
                onClick={() => setSelectedDayIndex(null)}
                className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600"
              >
                Chiudi (Esc)
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4 pb-48">
              {giorniData[selectedDayIndex]?.length === 0 ? (
                <div className="text-center p-8 text-slate-400 border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/20">
                  Nessuna voce inserita per questo giorno.<br/>Clicca su "Aggiungi Voce" in basso per iniziare.
                </div>
              ) : (
                giorniData[selectedDayIndex]?.map((entry, idx) => (
                  <div key={entry.id} className="bg-slate-800 p-5 rounded-xl border border-slate-600 shadow-md relative group flex flex-col gap-4">
                    {/* Header della singola voce: Titolo Voce N e Pulsante Elimina */}
                    <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Voce #{idx + 1}
                      </span>
                      {!isReadOnly && (
                        <button 
                          onClick={() => removeEntryFromGiorno(selectedDayIndex, entry.id)}
                          className="text-red-400 hover:text-white hover:bg-red-500 px-2 py-1 rounded transition-colors text-xs font-medium flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Rimuovi
                        </button>
                      )}
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Cliente */}
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-400 mb-1">Cliente / Destinazione</label>
                        <SearchableClientSelect 
                          value={causaliConCliente.includes(entry.causale) ? entry.idCliente : ''}
                          onChange={(val) => updateEntry(selectedDayIndex, entry.id, 'idCliente', val)}
                          disabled={isReadOnly || !causaliConCliente.includes(entry.causale)}
                          clienti={clienti}
                          placeholder="-- Nessun Cliente --"
                          className={`bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none`}
                        />
                      </div>

                      {/* Causale */}
                      <div className="w-full md:w-1/3">
                        <label className="block text-xs font-medium text-slate-400 mb-1">Causale</label>
                        <select 
                          value={entry.causale}
                          onChange={(e) => {
                            const nuovaCausale = e.target.value;
                            updateEntry(selectedDayIndex, entry.id, 'causale', nuovaCausale);
                            if (!causaliConCliente.includes(nuovaCausale)) {
                              updateEntry(selectedDayIndex, entry.id, 'idCliente', '');
                            }
                          }}
                          disabled={isReadOnly}
                          className={`w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none 
                            ${!causaliConCliente.includes(entry.causale) ? 'text-amber-400 font-medium' : 'text-slate-200'} ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}
                          `}
                        >
                          {causali.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>

                      {/* Ore */}
                      <div className="w-full md:w-1/4">
                        <label className="block text-xs font-medium text-slate-400 mb-1">Ore</label>
                        <div className="relative">
                          <input 
                            type="text"
                            placeholder="0.0"
                            value={entry.ore}
                            onChange={(e) => updateEntry(selectedDayIndex, entry.id, 'ore', e.target.value)}
                            disabled={isReadOnly}
                            className={`w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-sm font-bold text-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none pr-8 text-center ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                          />
                          <span className="absolute right-3 top-2.5 text-slate-500 font-medium">h</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-between items-center">
              <div className="text-slate-300 font-medium">
                Totale giornaliero: 
                <span className="text-indigo-400 text-xl font-bold ml-2">
                  {giorniData[selectedDayIndex]?.reduce((sum, e) => sum + (parseFloat(e.ore) || 0), 0) || 0}
                </span> <span className="text-sm text-slate-500">h</span>
              </div>
              
              {!isReadOnly && (
                <button 
                  onClick={() => addEntryToGiorno(selectedDayIndex)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg hover:shadow-indigo-500/25 border border-indigo-500/50"
                >
                  <Plus className="w-5 h-5" /> Aggiungi Nuova Voce
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ModernModal 
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.type === 'success' ? 'Operazione Completata' : 'Attenzione'}
        content={modalState.message}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />

      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-center w-16 h-16 bg-red-500/20 text-red-500 rounded-full mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white text-center mb-2">Pulisci Mese / Cambia Metodo</h2>
            <p className="text-slate-300 text-center mb-6">
              Attenzione: confermando questa operazione <strong className="text-white">tutti i dati già inseriti</strong> per questo dipendente nel mese di riferimento verranno <strong>eliminati definitivamente</strong> e potrai ricominciare da zero o cambiare metodo di inserimento.
              <br/><br/>Sei sicuro di voler procedere?
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 rounded-lg font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors flex-1"
              >
                Annulla
              </button>
              <button 
                onClick={handleResetMetodo}
                className="px-4 py-2 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 shadow-md hover:shadow-red-500/20 transition-all flex-1"
              >
                Sì, Cambia Metodo
              </button>
            </div>
          </div>
        </div>
      )}
          {/* Modale Scarica Presenze Excel */}
      <ModernModal
        isOpen={scaricaModalOpen}
        onClose={() => setScaricaModalOpen(false)}
        type="info"
        title="Scarica Foglio Presenze"
        subtitle="Il file deve includere clienti ed ore come da programma settimanale dell'operatore?"
        primaryAction={{
          label: "Sì, precompila",
          onClick: () => {
            window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/excel/scarica-presenze?mese=${mese}&anno=${anno}&dipendente_id=${idDipendente}&precompila=true`);
            setScaricaModalOpen(false);
          }
        }}
        secondaryAction={{
          label: "No, vuoto",
          onClick: () => {
            window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/excel/scarica-presenze?mese=${mese}&anno=${anno}&dipendente_id=${idDipendente}&precompila=false`);
            setScaricaModalOpen(false);
          }
        }}
      />

      {/* Alert Gigante Mese */}
      {showBigAlert && idDipendente && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-800 rounded-3xl p-12 max-w-4xl w-full mx-4 shadow-[0_0_100px_rgba(79,70,229,0.3)] border border-indigo-500/50 text-center transform animate-in zoom-in-95 duration-500 flex flex-col items-center">
            <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center mb-8 border-4 border-indigo-500">
              <CalendarDays className="w-12 h-12 text-indigo-400" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 uppercase tracking-wider">
              Stai lavorando su
            </h2>
            <div className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-8 py-2 uppercase">
              {mesi.find(m => m.val === parseInt(mese))?.label} {anno}
            </div>
            <p className="text-2xl text-slate-300 mb-12 max-w-2xl bg-slate-900/50 p-6 rounded-2xl border border-slate-700">
              Operatore: <strong className="text-white ml-2 block mt-2 text-3xl">{dipendenti.find(d => d.id?.toString() === idDipendente?.toString())?.nomeCompleto || 'Sconosciuto'}</strong>
            </p>
            <button 
              onClick={() => setShowBigAlert(false)}
              className="px-12 py-5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-2xl font-bold rounded-2xl shadow-xl hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
            >
              Ho Capito
            </button>
          </div>
        </div>
      )}
</div>
  );
}
