import React, { useState, useEffect } from 'react';
import { Plus, FileText, Search, Download, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import NuovoPreventivoModal from './NuovoPreventivoModal';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api';

const Preventivi = () => {
  const [preventivi, setPreventivi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPreventivi = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/preventivi`);
      const data = await res.json();
      setPreventivi(data);
    } catch (err) {
      console.error('Errore fetch preventivi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreventivi();
  }, []);

  const handleStatoChange = async (id, nuovoStato) => {
    try {
      const res = await fetch(`${API_URL}/preventivi/${id}/stato`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stato: nuovoStato })
      });
      if (res.ok) {
        fetchPreventivi();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (stato) => {
    switch(stato) {
      case 'Accettato': return <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-full text-xs font-bold"><CheckCircle size={12}/> Accettato</span>;
      case 'Rifiutato': return <span className="flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-full text-xs font-bold"><XCircle size={12}/> Rifiutato</span>;
      default: return <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-full text-xs font-bold"><Clock size={12}/> In Attesa</span>;
    }
  };

  const filtered = preventivi.filter(p => 
    p.ragione_sociale_prospect?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.numero_preventivo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 w-full pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
          <FileText size={28} />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-50 uppercase tracking-tight">Preventivi Commerciali</h1>
      </div>
      
      <div className="flex flex-col md:flex-row justify-between mb-8 gap-4">
        <div className="flex items-center bg-slate-900/50 p-3 rounded-xl flex-1 border border-slate-700 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input 
            type="text" 
            placeholder="Cerca per numero o nome prospect/cliente..." 
            className="bg-transparent border-none text-slate-200 w-full focus:outline-none placeholder:text-slate-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <button 
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm shrink-0" 
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={18} />
          Nuovo Preventivo
        </button>
      </div>

      <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-700">
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Numero</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Data</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente / Prospect</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Importo</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Stato</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="6" className="text-center p-8 text-slate-400 font-medium">Caricamento in corso...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center p-12 text-slate-500">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium text-lg">Nessun preventivo trovato.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-4">
                      <strong className="text-slate-200">{p.numero_preventivo}</strong>
                    </td>
                    <td className="p-4 text-slate-300 font-medium">{new Date(p.data_preventivo).toLocaleDateString('it-IT')}</td>
                    <td className="p-4">
                      <span className="text-slate-100 font-bold uppercase tracking-wide">{p.ragione_sociale_prospect}</span>
                      {p.cliente_prospect_id && (
                        <span className="inline-block ml-3 px-2 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded text-[10px] font-bold uppercase tracking-widest align-middle">
                          Cliente
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-amber-400">€ {Number(p.costo_mensile).toLocaleString('it-IT', {minimumFractionDigits: 2})}</span>
                    </td>
                    <td className="p-4">{getStatusBadge(p.stato)}</td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-end">
                        {p.allegato_preventivo && (
                          <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${p.allegato_preventivo}`} target="_blank" rel="noreferrer" className="p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-lg transition-colors border border-indigo-500/20" title="Scarica PDF">
                            <Download size={18} />
                          </a>
                        )}
                        {p.stato === 'In Attesa' && (
                          <>
                            <button onClick={() => handleStatoChange(p.id, 'Accettato')} className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors border border-emerald-500/20" title="Segna come Accettato"><CheckCircle size={18} /></button>
                            <button onClick={() => handleStatoChange(p.id, 'Rifiutato')} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors border border-red-500/20" title="Segna come Rifiutato"><XCircle size={18} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <NuovoPreventivoModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            fetchPreventivi();
          }} 
        />
      )}
    </div>
  );
};

export default Preventivi;
