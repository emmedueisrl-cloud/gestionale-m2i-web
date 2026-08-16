import React, { useState, useEffect } from 'react';
import { X, Link2 } from 'lucide-react';
import { recuperaElencoClienti } from '../../api/clienti';
import { assegnaAttrezzatura } from '../../api/magazzino';

export default function ModalAssegna({ attrezzatura, onClose, onSuccess }) {
  const [clienti, setClienti] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadClienti() {
      try {
        const data = await recuperaElencoClienti();
        setClienti(data || []);
      } catch (err) {
        console.error("Errore caricamento clienti", err);
      }
    }
    loadClienti();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCliente) {
      setError('Seleziona un cliente');
      return;
    }

    setIsSubmitting(true);
    try {
      await assegnaAttrezzatura(attrezzatura.id, selectedCliente);
      onSuccess();
    } catch (err) {
      setError('Errore durante l\'assegnazione');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Link2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">Assegna Attrezzatura</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="mb-2">
            <p className="text-sm text-slate-400">Stai assegnando:</p>
            <p className="text-white font-medium">{attrezzatura.nome} {attrezzatura.codice_custom ? `(${attrezzatura.codice_custom})` : ''}</p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Seleziona Cliente <span className="text-red-400">*</span></label>
            <select
              required
              value={selectedCliente}
              onChange={(e) => setSelectedCliente(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              <option value="">-- Seleziona un cliente --</option>
              {clienti.map(c => (
                <option key={c.id} value={c.id}>{c.ragione_sociale}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-800 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-slate-300 font-medium hover:bg-slate-800 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Assegnazione...' : 'Conferma Assegnazione'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
