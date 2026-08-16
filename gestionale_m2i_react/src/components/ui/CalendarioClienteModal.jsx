import React, { useState, useEffect } from 'react';
import { Calendar, Loader2, X } from 'lucide-react';
import ModernModal from './ModernModal';
import { calendarioClienteOre } from '../../api/elaborati';

export default function CalendarioClienteModal({ isOpen, onClose, clienteId, nomeCliente, mese, anno }) {
  const [giorni, setGiorni] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && clienteId) {
      loadData();
    }
  }, [isOpen, clienteId, mese, anno]);

  async function loadData() {
    setIsLoading(true);
    setError('');
    try {
      const data = await calendarioClienteOre(mese, anno, clienteId);
      setGiorni(data);
    } catch (err) {
      setError(err.message || 'Errore durante il caricamento del calendario');
    } finally {
      setIsLoading(false);
    }
  }

  const numGiorniMese = new Date(anno, mese, 0).getDate();
  const giorniDelMese = Array.from({ length: numGiorniMese }, (_, i) => i + 1);
  
  // Nomi dei mesi
  const nomiMesi = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];
  const nomeMese = nomiMesi[mese - 1];

  // Calcola il totale delle ore del mese per questo cliente
  const totaleOreMese = giorni.reduce((acc, dayArray) => {
    return acc + (dayArray ? dayArray.reduce((sum, rec) => sum + (rec.ore || 0), 0) : 0);
  }, 0);

  return (
    <ModernModal
      isOpen={isOpen}
      onClose={onClose}
      type={null}
      textAlign="text-left"
      title={
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/20 p-2 rounded-xl">
            <Calendar className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-50">Dettaglio Ore Cliente</h2>
            <p className="text-sm text-slate-400 font-medium capitalize">
              {nomeCliente} - {nomeMese} {anno}
            </p>
          </div>
        </div>
      }
      maxWidth="max-w-[1200px] w-[95vw]"
    >
      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Caricamento calendario...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <X className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
              <span className="text-slate-300 font-medium">Totale Ore Lavorate:</span>
              <span className="text-2xl font-bold text-indigo-400">{totaleOreMese.toFixed(2)} h</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {giorniDelMese.map((giorno) => {
                const date = new Date(anno, mese - 1, giorno);
                const nomeGiorno = date.toLocaleString('it-IT', { weekday: 'short' });
                const isDomenica = date.getDay() === 0;
                
                // I dati nel backend sono in un array da 31 elementi
                const recordsDelGiorno = giorni[giorno - 1] || [];
                const oreGiorno = recordsDelGiorno.reduce((sum, r) => sum + (r.ore || 0), 0);

                return (
                  <div 
                    key={giorno}
                    className={`rounded-xl border flex flex-col p-3 min-h-[120px] max-h-[200px] ${
                      isDomenica 
                        ? 'bg-red-900/10 border-red-500/20' 
                        : oreGiorno > 0 
                          ? 'bg-indigo-900/10 border-indigo-500/30' 
                          : 'bg-slate-900/40 border-slate-700/50'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-700/50">
                      <span className={`text-sm font-medium uppercase ${isDomenica ? 'text-red-400' : 'text-slate-400'}`}>
                        {nomeGiorno} {giorno}
                      </span>
                      {oreGiorno > 0 && (
                        <span className="text-xs font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full">
                          {oreGiorno.toFixed(2)}h
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto pr-1">
                      {recordsDelGiorno.length === 0 ? (
                        <span className="text-xs text-slate-500 italic mt-auto mb-auto text-center">Nessuna ora</span>
                      ) : (
                        recordsDelGiorno.map((rec, idx) => (
                          <div key={idx} className="bg-slate-800/80 rounded-lg p-2 flex flex-col gap-0.5 border border-slate-700">
                            <span className="text-[11px] font-medium text-slate-200 truncate leading-tight" title={rec.operatore}>
                              {rec.operatore}
                            </span>
                            <span className="text-[11px] font-bold text-indigo-400 leading-none">
                              {rec.ore.toFixed(2)}h
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ModernModal>
  );
}
