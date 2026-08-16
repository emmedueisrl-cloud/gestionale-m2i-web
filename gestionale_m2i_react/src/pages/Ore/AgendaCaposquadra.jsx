import React, { useState, useEffect } from 'react';
import { Calendar, Save, Plus, Trash2, Loader2, Clock, Shield, Download, Eraser } from 'lucide-react';
import { recuperaElencoDipendenti, impostaCaposquadra } from '../../api/dipendenti';
import { recuperaElencoClienti } from '../../api/clienti';
import { recuperaDatiAgenda, salvaImpegnoAgenda, eliminaImpegnoAgenda, importaProgrammaFissoAgenda, svuotaSettimanaAgenda } from '../../api/ore';
import ModernModal from '../../components/ui/ModernModal';

export default function AgendaCaposquadra() {
  const [dipendenti, setDipendenti] = useState([]);
  const [clienti, setClienti] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGestioneCapisquadraOpen, setIsGestioneCapisquadraOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const [idDipendente, setIdDipendente] = useState('');
  // Gestione data: lunedì della settimana in visualizzazione
  const getLocalISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [dataInizioSettimana, setDataInizioSettimana] = useState('');
  
  const [impegni, setImpegni] = useState([]);
  const [modalState, setModalState] = useState({ isOpen: false, type: '', message: '' });

  // Nuovo impegno
  const [nuovoImpegno, setNuovoImpegno] = useState({
    data: '', oraInizio: '08:00', oraFine: '12:00', idCliente: '', note: '', colore: '#4f46e5'
  });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    // Imposta dataInizioSettimana al lunedì della settimana corrente
    const today = new Date();
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
  }, []);

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

  const handleAggiungi = async () => {
    if (!nuovoImpegno.data || !nuovoImpegno.oraInizio || !nuovoImpegno.oraFine) {
      setModalState({ isOpen: true, type: 'error', message: 'Compila Data e Orari.' });
      return;
    }
    setIsAdding(true);
    try {
      await salvaImpegnoAgenda({ ...nuovoImpegno, idDipendente });
      await caricaAgenda(); // Ricarica
      setNuovoImpegno({ ...nuovoImpegno, note: '' }); // reset parziale
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore nel salvataggio.' });
    } finally {
      setIsAdding(false);
    }
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

  return (
    <div className="p-6 w-full mx-auto h-[calc(100vh-100px)] flex flex-col">
      
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

        <div className="flex gap-3">
          <select 
            value={idDipendente} 
            onChange={(e) => setIdDipendente(e.target.value)}
            className="p-2 bg-slate-800 border border-slate-600 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[250px] shadow-sm"
          >
            <option value="">-- Seleziona Caposquadra --</option>
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

      <div className="flex-1 bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden flex flex-col relative">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-800/70 z-10 flex items-center justify-center text-indigo-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}

        {!idDipendente ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Calendar className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Seleziona un dipendente per visualizzare l'agenda</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* Calendario Visivo */}
            <div className="flex-1 flex flex-col min-h-0">
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
                  <button 
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
                  </button>
                </div>
              </div>

              {/* Colonne Giorni */}
              <div className="flex-1 flex overflow-x-auto">
                {giorniSettimana.map((giorno, idx) => {
                  const formatLocalISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const dataStr = formatLocalISODate(giorno);
                  const impegniGiorno = impegni.filter(i => i.data === dataStr).sort((a,b) => a.oraInizio.localeCompare(b.oraInizio));
                  const isToday = dataStr === formatLocalISODate(new Date());

                  return (
                    <div key={idx} className={`flex-1 min-w-0 border-r border-slate-800 flex flex-col ${isToday ? 'bg-indigo-500/10/30' : ''}`}>
                      <div className={`p-1.5 md:p-2 text-center border-b border-slate-700 ${isToday ? 'bg-indigo-500/20 text-indigo-800' : 'bg-slate-900/50 text-slate-300'}`}>
                        <div className="text-[10px] md:text-xs uppercase font-bold tracking-wider">{giorno.toLocaleDateString('it-IT', { weekday: 'short' })}</div>
                        <div className="text-base md:text-lg font-black">{giorno.getDate()}</div>
                      </div>
                      <div className="flex-1 p-1 md:p-2 space-y-1 md:space-y-2 overflow-y-auto overflow-x-hidden">
                        {impegniGiorno.map(imp => (
                          <div 
                            key={imp.id} 
                            className="p-1.5 md:p-2 rounded border shadow-sm text-[10px] 2xl:text-xs relative group cursor-default break-words"
                            style={{ backgroundColor: `${imp.colore}15`, borderColor: `${imp.colore}40`, borderLeftWidth: '4px', borderLeftColor: imp.colore }}
                          >
                            <button 
                              onClick={() => handleElimina(imp.id)}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <div className="font-bold mb-0.5 md:mb-1 text-slate-50 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" /> 
                              <span className="truncate">{imp.oraInizio} - {imp.oraFine}</span>
                            </div>
                            <div className="font-medium text-slate-200 leading-tight break-words" style={{ wordBreak: 'break-word', hyphens: 'auto' }}>
                              {imp.cliente}
                            </div>
                            {imp.note && <div className="text-[9px] 2xl:text-[10px] text-slate-400 mt-1 italic leading-tight break-words">{imp.note}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form Inserimento (In Basso) */}
            <div className="flex-none bg-slate-900/50 p-4 border-t border-slate-700">
              <h3 className="font-bold text-slate-50 mb-3 uppercase tracking-wide text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> Aggiungi Impegno
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Data</label>
                  <input 
                    type="date" 
                    value={nuovoImpegno.data}
                    onChange={(e) => setNuovoImpegno({...nuovoImpegno, data: e.target.value})}
                    className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Inizio</label>
                    <input 
                      type="time" 
                      value={nuovoImpegno.oraInizio}
                      onChange={(e) => setNuovoImpegno({...nuovoImpegno, oraInizio: e.target.value})}
                      className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Fine</label>
                    <input 
                      type="time" 
                      value={nuovoImpegno.oraFine}
                      onChange={(e) => setNuovoImpegno({...nuovoImpegno, oraFine: e.target.value})}
                      className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Cliente / Destinazione</label>
                  <select 
                    value={nuovoImpegno.idCliente}
                    onChange={(e) => setNuovoImpegno({...nuovoImpegno, idCliente: e.target.value})}
                    className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Nessun Cliente --</option>
                    {clienti.map(c => <option key={c.id} value={c.id}>{c.ragione_sociale}</option>)}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-400 uppercase">Colore</label>
                  </div>
                  <div className="flex gap-2 p-1">
                    {['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                      <button 
                        key={color}
                        onClick={() => setNuovoImpegno({...nuovoImpegno, colore: color})}
                        className={`w-7 h-7 rounded-full border-2 transition-transform ${nuovoImpegno.colore === color ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <input 
                    type="text"
                    placeholder="Note opzionali..."
                    value={nuovoImpegno.note}
                    onChange={(e) => setNuovoImpegno({...nuovoImpegno, note: e.target.value})}
                    className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button 
                    onClick={handleAggiungi}
                    disabled={isAdding}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Salva
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
