import React, { useState, useEffect } from 'react';
import { Key, Loader2, Search, ExternalLink } from 'lucide-react';
import { recuperaTutteAssegnazioniChiavi } from '../../api/clienti';
import { Link } from 'react-router-dom';

export default function Chiavi() {
  const [assegnazioni, setAssegnazioni] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await recuperaTutteAssegnazioniChiavi();
        setAssegnazioni(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredAssegnazioni = assegnazioni.filter(a => 
    a.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.possessore_nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8 border-b border-slate-700 pb-4">
        <div className="p-3 bg-indigo-500/20 rounded-xl">
          <Key className="w-8 h-8 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Riepilogo Generale Chiavi</h1>
          <p className="text-slate-400 mt-1">Elenco di tutte le chiavi attualmente in possesso o assegnate ai dipendenti.</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Cerca per cliente o possessore..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : filteredAssegnazioni.length === 0 ? (
          <div className="text-center p-8 text-slate-400 border border-slate-700 border-dashed rounded-xl">
            Nessuna assegnazione trovata.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-sm">
                  <th className="p-3 font-medium">Cliente</th>
                  <th className="p-3 font-medium">In Possesso A</th>
                  <th className="p-3 font-medium">Copia</th>
                  <th className="p-3 font-medium">Dal</th>
                  <th className="p-3 font-medium">Note</th>
                  <th className="p-3 font-medium text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {filteredAssegnazioni.map((ass) => (
                  <tr key={ass.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="p-3 font-medium">{ass.cliente_nome}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${ass.possessore_nome === 'UFFICIO' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                        {ass.possessore_nome}
                      </span>
                    </td>
                    <td className="p-3">Copia {ass.num_copia}</td>
                    <td className="p-3 text-sm">{ass.data_assegnazione}</td>
                    <td className="p-3 text-xs text-slate-400 max-w-xs truncate" title={ass.note}>{ass.note || '-'}</td>
                    <td className="p-3 text-right">
                      <Link 
                        to={`/admin/clienti/modifica?id=${ass.cliente_id}`}
                        className="inline-flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1.5 rounded transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Apri Cliente
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
