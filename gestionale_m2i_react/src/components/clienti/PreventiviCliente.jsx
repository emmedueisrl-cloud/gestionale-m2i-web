import React, { useState, useEffect } from 'react';
import { FileText, Download, Clock, CheckCircle, XCircle } from 'lucide-react';

const PreventiviCliente = ({ clienteId }) => {
  const [preventivi, setPreventivi] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreventivi = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/clienti/${clienteId}/preventivi`);
        const data = await res.json();
        setPreventivi(data);
      } catch (err) {
        console.error('Errore fetch preventivi cliente:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPreventivi();
  }, [clienteId]);

  const getStatusBadge = (stato) => {
    switch(stato) {
      case 'Accettato': return <span className="flex items-center gap-1 bg-emerald-500 text-white px-2 py-1 rounded text-xs font-bold"><CheckCircle size={12}/> Accettato</span>;
      case 'Rifiutato': return <span className="flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold"><XCircle size={12}/> Rifiutato</span>;
      default: return <span className="flex items-center gap-1 bg-amber-500 text-white px-2 py-1 rounded text-xs font-bold"><Clock size={12}/> In Attesa</span>;
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
      <div className="bg-slate-900/50 border-b border-slate-700 p-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-slate-50 uppercase text-sm tracking-wide">Preventivi Generati</h2>
        </div>
      </div>
      <div className="p-6">
        {loading ? (
          <p className="text-slate-400 text-center text-sm">Caricamento...</p>
        ) : preventivi.length > 0 ? (
          <div className="space-y-3">
            {preventivi.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-700 hover:border-indigo-500 transition-colors">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-slate-200">{p.numero_preventivo}</span>
                    <span className="text-xs text-slate-400">{new Date(p.data_preventivo).toLocaleDateString('it-IT')}</span>
                    {getStatusBadge(p.stato)}
                  </div>
                  <div className="text-sm text-slate-300">{p.oggetto || 'Preventivo per pulizie ordinarie'} - <strong className="text-indigo-400">€ {Number(p.costo_mensile).toLocaleString('it-IT', {minimumFractionDigits: 2})}</strong></div>
                </div>
                {p.allegato_preventivo && (
                  <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${p.allegato_preventivo}`} target="_blank" rel="noreferrer" className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-colors" title="Scarica PDF">
                    <Download size={20} />
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-700 rounded-xl text-slate-500">
            <FileText className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm font-medium">Nessun preventivo associato.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreventiviCliente;
