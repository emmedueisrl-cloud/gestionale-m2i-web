import React, { useState, useEffect } from 'react';
import { X, FileText, Download, RefreshCw, Trash2 } from 'lucide-react';
import ModernModal from './ModernModal';

export default function BustePagaDipendenteModal({ isOpen, onClose, dipendenteId, dipendenteNome }) {
  const [buste, setBuste] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filtroMese, setFiltroMese] = useState('');
  const [filtroAnno, setFiltroAnno] = useState('');
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });


  useEffect(() => {
    if (isOpen && dipendenteId) {
      caricaBuste();
    }
  }, [isOpen, dipendenteId]);

  const caricaBuste = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/buste-paga/dipendente/${dipendenteId}`);
      const data = await res.json();
      if (data.success) {
        setBuste(data.buste);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const eliminaBusta = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa busta paga? Il file verrà rimosso definitivamente.')) return;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/buste-paga/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        caricaBuste(); // ricarica la lista
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

  const mesi = {
    1: 'Gennaio', 2: 'Febbraio', 3: 'Marzo', 4: 'Aprile', 5: 'Maggio', 6: 'Giugno',
    7: 'Luglio', 8: 'Agosto', 9: 'Settembre', 10: 'Ottobre', 11: 'Novembre', 12: 'Dicembre'
  };

  const busteFiltrate = buste.filter(b => {
    if (filtroMese && b.mese !== parseInt(filtroMese)) return false;
    if (filtroAnno && b.anno !== parseInt(filtroAnno)) return false;
    return true;
  });

  if (!isOpen) return null;

  return (
    <>
    <ModernModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Buste Paga - ${dipendenteNome}`}
      icon={<FileText className="w-6 h-6 text-indigo-400" />}
      maxWidth="max-w-2xl"
    >
      <div className="p-6 flex flex-col gap-4">
        
        {/* Filtri */}
        <div className="flex gap-4 p-4 bg-slate-900 rounded-xl border border-slate-700">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-400 mb-1">Filtra per Anno</label>
            <select 
              value={filtroAnno}
              onChange={(e) => setFiltroAnno(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">Tutti gli anni</option>
              {[...new Set(buste.map(b => b.anno))].sort((a,b)=>b-a).map(anno => (
                <option key={anno} value={anno}>{anno}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-400 mb-1">Filtra per Mese</label>
            <select 
              value={filtroMese}
              onChange={(e) => setFiltroMese(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">Tutti i mesi</option>
              {Object.entries(mesi).map(([num, nome]) => (
                <option key={num} value={num}>{nome}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center py-10 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-4" />
            <p>Caricamento storico in corso...</p>
          </div>
        ) : busteFiltrate.length === 0 ? (
          <div className="text-center py-10 text-slate-400 bg-slate-800 rounded-xl border border-dashed border-slate-700">
            Nessuna busta paga trovata per i criteri selezionati.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-700">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs uppercase bg-slate-800 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Mese / Anno</th>
                  <th className="px-4 py-3 text-right">Netto Busta</th>
                  <th className="px-4 py-3 text-center">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 bg-slate-900/50">
                {busteFiltrate.map(b => (
                  <tr key={b.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {mesi[b.mese]} {b.anno}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                      € {(b.importo_netto || 0).toFixed(2)}
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
    </ModernModal>
    <ModernModal 
      {...alertModal}
      onClose={() => setAlertModal({ isOpen: false })}
    />
    </>
  );
}
