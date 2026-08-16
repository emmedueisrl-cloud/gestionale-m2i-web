import React, { useState } from 'react';
import { X, Upload, Package } from 'lucide-react';
import { creaAttrezzatura } from '../../api/magazzino';

export default function NuovaAttrezzaturaModal({ onClose, onSuccess, preselectedClienteId = null }) {
  const [formData, setFormData] = useState({
    nome: '',
    codice_custom: '',
    descrizione: '',
    cliente_id: preselectedClienteId || ''
  });
  
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.nome) {
      setError('Il nome è obbligatorio');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('nome', formData.nome);
      data.append('codice_custom', formData.codice_custom);
      data.append('descrizione', formData.descrizione);
      if (formData.cliente_id) {
        data.append('cliente_id', formData.cliente_id);
      }
      
      files.forEach(f => {
        data.append('foto', f);
      });

      await creaAttrezzatura(data);
      onSuccess();
    } catch (err) {
      console.error(err);
      setError('Errore durante il salvataggio');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Package className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">Aggiungi in Magazzino</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium text-slate-300">Nome Attrezzatura <span className="text-red-400">*</span></label>
              <input
                type="text"
                required
                placeholder="es. Idropulitrice Karcher"
                value={formData.nome}
                onChange={e => setFormData({...formData, nome: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium text-slate-300">Codice Personalizzato (opzionale)</label>
              <input
                type="text"
                placeholder="es. IDRO-001"
                value={formData.codice_custom}
                onChange={e => setFormData({...formData, codice_custom: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium text-slate-300">Descrizione (opzionale)</label>
              <textarea
                placeholder="Dettagli, stato, note..."
                rows={3}
                value={formData.descrizione}
                onChange={e => setFormData({...formData, descrizione: e.target.value})}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="text-sm font-medium text-slate-300">Foto (opzionale - max 2)</label>
              <div className="relative group cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-full flex items-center justify-center gap-2 bg-slate-800/50 border border-dashed border-slate-600 rounded-xl p-4 group-hover:bg-slate-800 transition-colors">
                  <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
                  <span className="text-sm text-slate-400 font-medium group-hover:text-slate-300">
                    {files.length > 0 ? `${files.length} file selezionati` : 'Clicca o trascina immagini'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
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
              {isSubmitting ? 'Salvataggio...' : 'Salva Attrezzatura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
