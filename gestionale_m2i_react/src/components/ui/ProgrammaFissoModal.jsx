import React, { useState, useEffect } from 'react';
import { Calendar, Save, Plus, Trash2, Loader2, Edit, X, Clock, Building2, ChevronRight, Repeat } from 'lucide-react';
import { recuperaElencoDipendenti } from '../../api/dipendenti';
import { recuperaElencoClienti } from '../../api/clienti';
import { recuperaDatiProgramma, salvaProgrammaFisso } from '../../api/ore';
import ModernModal from './ModernModal';

const ClientSelect = ({ value, onChange, clienti }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const selectedCliente = clienti.find(c => c.id?.toString() === value?.toString());
  
  const filteredClienti = search.length >= 3 
    ? clienti.filter(c => (c.ragione_sociale || c.ragioneSociale || '').toLowerCase().includes(search.toLowerCase()))
    : clienti;

  return (
    <div className="relative w-full flex items-center">
      <div 
        className="w-full bg-transparent text-sm text-slate-200 cursor-pointer truncate py-1"
        onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
      >
        {selectedCliente ? (selectedCliente.ragione_sociale || selectedCliente.ragioneSociale) : <span className="text-slate-500">-- Seleziona Cliente --</span>}
      </div>
      
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}></div>
      )}

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[250px] bg-slate-800 border border-slate-600 rounded-md shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-700 bg-slate-900">
            <input 
              type="text" 
              autoFocus
              className="w-full bg-slate-950 border border-slate-600 rounded p-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
              placeholder="Cerca (min. 3 caratteri)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            <div 
              className="p-2.5 text-sm text-slate-400 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50"
              onClick={() => { onChange(''); setIsOpen(false); }}
            >
              -- Nessun Cliente --
            </div>
            {filteredClienti.map(c => (
              <div 
                key={c.id}
                className={`p-2.5 text-sm cursor-pointer hover:bg-indigo-600 hover:text-white transition-colors ${value?.toString() === c.id?.toString() ? 'bg-indigo-500/20 text-indigo-300 font-medium' : 'text-slate-200'}`}
                onClick={() => { onChange(c.id); setIsOpen(false); }}
              >
                {c.ragione_sociale || c.ragioneSociale}
              </div>
            ))}
            {filteredClienti.length === 0 && (
              <div className="p-3 text-sm text-slate-500 text-center italic">Nessun cliente trovato</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ProgrammaFissoModal({ isOpen, onClose, idDipendente }) {
  const [dipendenteInfo, setDipendenteInfo] = useState(null);
  const [clienti, setClienti] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isEditingMode, setIsEditingMode] = useState(false);
  
  const [settimanaData, setSettimanaData] = useState(Array.from({ length: 7 }, () => []));
  const [localModalState, setLocalModalState] = useState({ isOpen: false, type: '', message: '' });

  const giorniSettimana = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

  useEffect(() => {
    if (isOpen && idDipendente) {
      loadFiltriEProgramma();
    }
  }, [isOpen, idDipendente]);

  async function loadFiltriEProgramma() {
    setIsLoading(true);
    setIsEditingMode(false);
    try {
      const [dips, clis, prog] = await Promise.all([
        recuperaElencoDipendenti(),
        recuperaElencoClienti(),
        recuperaDatiProgramma(idDipendente)
      ]);
      
      const dip = (dips || []).find(d => d.id.toString() === idDipendente.toString());
      setDipendenteInfo(dip || { nomeCompleto: 'Dipendente Sconosciuto' });
      setClienti(clis || []);
      setSettimanaData(righeToGrid(prog || []));
    } catch (err) {
      console.error(err);
      setLocalModalState({ isOpen: true, type: 'error', message: 'Errore nel caricamento del programma fisso.' });
    } finally {
      setIsLoading(false);
    }
  }

  const righeToGrid = (righe) => {
    const grid = Array.from({ length: 7 }, () => []);
    if (!righe || righe.length === 0) return grid;

    righe.forEach(r => {
      const idx = giorniSettimana.indexOf(r.giornoSettimana);
      if (idx !== -1) {
        grid[idx].push({
          id: Math.random().toString(36).substring(7),
          oraInizio: r.oraInizio || '',
          oraFine: r.oraFine || '',
          idCliente: r.idCliente || '',
          frequenza: r.frequenza || 'Settimanale',
          note: r.note || ''
        });
      }
    });
    return grid;
  };

  const gridToRighe = (grid) => {
    const righe = [];
    grid.forEach((entries, idx) => {
      entries.forEach(entry => {
        if (entry.oraInizio || entry.oraFine || entry.idCliente) {
          righe.push({
            giornoSettimana: giorniSettimana[idx],
            oraInizio: entry.oraInizio,
            oraFine: entry.oraFine,
            idCliente: entry.idCliente,
            frequenza: entry.frequenza || 'Settimanale',
            note: entry.note
          });
        }
      });
    });
    return righe;
  };

  const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h + (m / 60);
  };

  const calculateHours = (inizio, fine) => {
    if (!inizio || !fine) return 0;
    const start = parseTime(inizio);
    let end = parseTime(fine);
    if (end < start) end += 24;
    return end - start;
  };

  const getOreGiorno = (entries) => {
    return entries.reduce((tot, entry) => tot + calculateHours(entry.oraInizio, entry.oraFine), 0);
  };

  const totaleSettimanale = settimanaData.reduce((totWeek, entries) => totWeek + getOreGiorno(entries), 0);

  const handleEditClick = () => setIsEditingMode(true);

  const handleCancelEdit = () => {
    loadFiltriEProgramma(); // Reload original data
    setIsEditingMode(false);
  };

  const addEntryToGiorno = (gIndex) => {
    const d = [...settimanaData];
    d[gIndex].push({
      id: Math.random().toString(36).substring(7),
      oraInizio: '08:00',
      oraFine: '12:00',
      idCliente: '',
      frequenza: 'Settimanale',
      note: ''
    });
    setSettimanaData(d);
  };

  const removeEntryFromGiorno = (gIndex, entryId) => {
    const d = [...settimanaData];
    d[gIndex] = d[gIndex].filter(e => e.id !== entryId);
    setSettimanaData(d);
  };

  const updateEntry = (gIndex, entryId, field, value) => {
    const d = [...settimanaData];
    const entry = d[gIndex].find(e => e.id === entryId);
    if (entry) {
      entry[field] = value;
    }
    setSettimanaData(d);
  };

  const salvaProgramma = async () => {
    setIsSaving(true);
    try {
      const impegni = gridToRighe(settimanaData);
      await salvaProgrammaFisso({ idDipendente, impegni });
      setLocalModalState({ isOpen: true, type: 'success', message: 'Programma Fisso salvato con successo!' });
      setIsEditingMode(false);
    } catch (err) {
      console.error(err);
      setLocalModalState({ isOpen: true, type: 'error', message: 'Errore nel salvataggio del programma fisso.' });
    } finally {
      setIsSaving(false);
    }
  };

  const getClienteName = (idCliente) => {
    if (!idCliente) return 'Nessun cliente';
    const c = clienti.find(c => c.id.toString() === idCliente.toString());
    return c ? (c.ragione_sociale || c.ragioneSociale) : 'Sconosciuto';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
              <Calendar className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Programma Fisso</h2>
              <p className="text-sm text-slate-400">
                Dipendente: <span className="font-medium text-indigo-200">{dipendenteInfo?.nomeCompleto || '...'}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {!isLoading && (
              <div className="hidden sm:flex bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-xl items-center gap-2">
                <span className="text-sm font-medium text-indigo-200">Totale Settimanale:</span>
                <span className="text-lg font-bold text-indigo-400">{totaleSettimanale.toFixed(2)}h</span>
              </div>
            )}
            
            {!isEditingMode && !isLoading && (
              <button 
                onClick={handleEditClick}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Edit className="w-4 h-4" /> Modifica
              </button>
            )}

            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-auto bg-gradient-to-b from-slate-800 to-slate-900/50 p-6">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-indigo-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-w-4xl mx-auto">
              
              {/* Display Header for mobile (totale settimanale) */}
              <div className="sm:hidden flex bg-indigo-500/10 border border-indigo-500/20 px-4 py-3 rounded-xl justify-between items-center mb-2">
                <span className="text-sm font-medium text-indigo-200">Totale Settimanale:</span>
                <span className="text-lg font-bold text-indigo-400">{totaleSettimanale.toFixed(2)}h</span>
              </div>

              {giorniSettimana.map((giorno, gIndex) => {
                const isDomenica = gIndex === 6;
                const isSabato = gIndex === 5;
                const entries = settimanaData[gIndex] || [];
                
                let dayTextClass = 'text-slate-200';
                if (isDomenica) dayTextClass = 'text-red-400';
                else if (isSabato) dayTextClass = 'text-orange-400';

                return (
                  <div key={gIndex} className={`rounded-xl border p-4 transition-colors ${isEditingMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-900/40 border-slate-700/50 hover:bg-slate-800/60'}`}>
                    
                    {/* Header Giorno */}
                    <div className={`flex justify-between items-center ${isEditingMode ? 'border-b border-slate-700/50 pb-3 mb-3' : 'mb-2'}`}>
                      <div className="flex flex-col gap-0.5">
                        <span className={`font-bold text-lg uppercase tracking-wider ${dayTextClass}`}>
                          {giorno}
                        </span>
                        <span className="text-xs font-medium text-slate-400">{getOreGiorno(entries).toFixed(2)} ore tot.</span>
                      </div>
                      
                      {isEditingMode && (
                        <button 
                          onClick={() => addEntryToGiorno(gIndex)}
                          className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-500/10 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 hover:text-indigo-200 transition-colors"
                        >
                          <Plus className="w-4 h-4" /> Aggiungi
                        </button>
                      )}
                    </div>

                    {/* Voci */}
                    <div className="flex flex-col gap-2">
                      {entries.length === 0 ? (
                        <div className={`text-slate-500 italic text-sm py-2 ${isEditingMode ? 'text-center' : ''}`}>
                          {isEditingMode ? 'Nessun turno inserito. Clicca su "Aggiungi" per iniziare.' : 'Nessun turno assegnato'}
                        </div>
                      ) : (
                        entries.map(entry => (
                          <div key={entry.id} className={`flex flex-col gap-3 rounded-lg border shadow-sm ${isEditingMode ? 'lg:flex-row lg:items-center bg-slate-800 p-3 border-slate-700' : 'sm:flex-row sm:items-center bg-slate-800/80 p-3 border-slate-700'}`}>
                            
                            {isEditingMode ? (
                              <>
                                {/* Blocco Orario (Edit) */}
                                <div className="flex items-center gap-2">
                                  <div className="bg-slate-900 border border-slate-600 rounded-md p-1 px-2 flex items-center gap-2 focus-within:ring-1 focus-within:ring-indigo-500">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <input 
                                      type="time"
                                      value={entry.oraInizio}
                                      onChange={(e) => updateEntry(gIndex, entry.id, 'oraInizio', e.target.value)}
                                      className="bg-transparent text-sm text-slate-200 focus:outline-none w-24 font-semibold"
                                    />
                                  </div>
                                  <span className="text-slate-500 px-1">al</span>
                                  <div className="bg-slate-900 border border-slate-600 rounded-md p-1 px-2 flex items-center gap-2 focus-within:ring-1 focus-within:ring-indigo-500">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <input 
                                      type="time"
                                      value={entry.oraFine}
                                      onChange={(e) => updateEntry(gIndex, entry.id, 'oraFine', e.target.value)}
                                      className="bg-transparent text-sm text-slate-200 focus:outline-none w-24 font-semibold"
                                    />
                                  </div>
                                </div>
              
                                {/* Blocco Cliente (Edit) */}
                                <div className="flex-1 min-w-0 flex items-center gap-2 bg-slate-900 border border-slate-600 rounded-md p-1.5 px-3 focus-within:ring-1 focus-within:ring-indigo-500">
                                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                  <ClientSelect 
                                    value={entry.idCliente}
                                    onChange={(val) => updateEntry(gIndex, entry.id, 'idCliente', val)}
                                    clienti={clienti}
                                  />
                                </div>
              
                                {/* Blocco Frequenza (Edit) */}
                                <div className="flex items-center gap-2 bg-slate-900 border border-slate-600 rounded-md p-1.5 px-3 focus-within:ring-1 focus-within:ring-indigo-500 min-w-[140px]">
                                  <Repeat className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                  <select 
                                    value={entry.frequenza || 'Settimanale'}
                                    onChange={(e) => updateEntry(gIndex, entry.id, 'frequenza', e.target.value)}
                                    className="w-full bg-transparent text-sm text-slate-200 focus:outline-none"
                                  >
                                    <option value="Settimanale" className="text-slate-800">Tutte le settimane</option>
                                    <option value="Quindicinale" className="text-slate-800">Ogni due settimane</option>
                                    <option value="Mensile" className="text-slate-800">Una volta al mese</option>
                                  </select>
                                </div>
              
                                {/* Pulsante Elimina */}
                                <button 
                                  onClick={() => removeEntryFromGiorno(gIndex, entry.id)}
                                  title="Elimina turno"
                                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors flex-shrink-0 self-end lg:self-auto"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Orario Badge (Read-Only) */}
                                <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-300 px-3 py-1.5 rounded-md border border-indigo-500/20 font-bold whitespace-nowrap">
                                  <Clock className="w-4 h-4 opacity-70" />
                                  <span>{entry.oraInizio || '--:--'}</span>
                                  <span className="opacity-50 font-normal mx-1">al</span>
                                  <span>{entry.oraFine || '--:--'}</span>
                                </div>
                                
                                {/* Freccia */}
                                <ChevronRight className="hidden sm:block w-4 h-4 text-slate-600" />
                                
                                {/* Cliente (Read-Only) */}
                                <div className="flex items-center gap-2 flex-1 min-w-0 text-slate-200 font-medium mt-1 sm:mt-0">
                                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                  <span className="truncate">{getClienteName(entry.idCliente)}</span>
                                </div>

                                {/* Frequenza (Read-Only) */}
                                {entry.frequenza && entry.frequenza !== 'Settimanale' && (
                                  <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-300 px-2.5 py-1 rounded-md border border-amber-500/20 text-xs font-medium ml-2">
                                    <Repeat className="w-3.5 h-3.5" />
                                    <span>{entry.frequenza === 'Quindicinale' ? 'Quindicinale' : 'Mensile'}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer (only visible when editing) */}
        {isEditingMode && (
          <div className="p-5 bg-slate-800/90 border-t border-slate-700 flex justify-end gap-3 backdrop-blur-md">
            <button 
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button 
              onClick={salvaProgramma}
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? 'Salvataggio...' : 'Salva Programma Fisso'}
            </button>
          </div>
        )}
      </div>

      <ModernModal 
        isOpen={localModalState.isOpen}
        type={localModalState.type}
        title={localModalState.type === 'success' ? 'Operazione Completata' : 'Attenzione'}
        message={localModalState.message}
        onClose={() => {
          setLocalModalState({ ...localModalState, isOpen: false });
          // Optional: we can close the whole ProgrammaFissoModal on success
          // if (localModalState.type === 'success') onClose();
        }}
      />
    </div>
  );
}
