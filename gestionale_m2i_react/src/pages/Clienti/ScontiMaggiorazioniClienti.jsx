import React, { useState, useEffect } from 'react';
import { Settings2, Save, Loader2, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { recuperaElencoClienti, recuperaRegolazioniClienti, salvaRegolazioneCliente, eliminaRegolazioneCliente } from '../../api/clienti';
import ModernModal from '../../components/ui/ModernModal';
import SearchableClientSelect from '../../components/ui/SearchableClientSelect';

export default function ScontiMaggiorazioniClienti() {
  const navigate = useNavigate();
  const [clienti, setClienti] = useState([]);
  const [regolazioni, setRegolazioni] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, type: '', message: '' });

  const dataOdierna = new Date();
  
  const [mese, setMese] = useState(() => {
    const saved = sessionStorage.getItem('sm_mese');
    return saved ? Number(saved) : dataOdierna.getMonth() + 1;
  });
  const [anno, setAnno] = useState(() => {
    const saved = sessionStorage.getItem('sm_anno');
    return saved ? Number(saved) : dataOdierna.getFullYear();
  });
  const [idClienteSelezionato, setIdClienteSelezionato] = useState(() => {
    return sessionStorage.getItem('sm_cliente') || '';
  });

  useEffect(() => {
    sessionStorage.setItem('sm_mese', mese);
    sessionStorage.setItem('sm_anno', anno);
    sessionStorage.setItem('sm_cliente', idClienteSelezionato);
  }, [mese, anno, idClienteSelezionato]);

  const [nuovaRegolazione, setNuovaRegolazione] = useState({
    tipo: 'Sconto',
    importo: '',
    descrizione: ''
  });

  const mesi = [
    { val: 1, label: 'Gennaio' }, { val: 2, label: 'Febbraio' }, { val: 3, label: 'Marzo' },
    { val: 4, label: 'Aprile' }, { val: 5, label: 'Maggio' }, { val: 6, label: 'Giugno' },
    { val: 7, label: 'Luglio' }, { val: 8, label: 'Agosto' }, { val: 9, label: 'Settembre' },
    { val: 10, label: 'Ottobre' }, { val: 11, label: 'Novembre' }, { val: 12, label: 'Dicembre' }
  ];

  useEffect(() => {
    async function loadFiltri() {
      try {
        const cls = await recuperaElencoClienti();
        setClienti(cls || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadFiltri();
  }, []);

  useEffect(() => {
    caricaRegolazioni();
  }, [mese, anno, idClienteSelezionato]);

  async function caricaRegolazioni() {
    setIsLoading(true);
    try {
      const dati = await recuperaRegolazioniClienti(idClienteSelezionato || '', mese, anno);
      // Trasformiamo i dati nel formato atteso dalla tabella
      const parsed = (dati || []).map(d => ({
        id: d.idRegolazione,
        idCliente: d.idCliente,
        tipo: d.tipo,
        importo: d.importo,
        descrizione: d.motivazione
      }));
      setRegolazioni(parsed);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSalva = async () => {
    if (!idClienteSelezionato || !nuovaRegolazione.importo) {
      setModalState({ isOpen: true, type: 'error', message: 'Seleziona un cliente e inserisci l\'importo.' });
      return;
    }
    setIsSaving(true);
    try {
      const c = clienti.find(x => x.id === idClienteSelezionato);
      await salvaRegolazioneCliente(
        mese,
        anno,
        idClienteSelezionato,
        c ? c.ragione_sociale : '',
        nuovaRegolazione.tipo,
        parseFloat(nuovaRegolazione.importo) || 0,
        nuovaRegolazione.descrizione
      );
      
      setNuovaRegolazione({ tipo: 'Sconto', importo: '', descrizione: '' });
      await caricaRegolazioni();
      setModalState({ isOpen: true, type: 'success', message: 'Regolazione salvata con successo!' });
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore durante il salvataggio.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleElimina = async (id) => {
    if(!window.confirm('Sicuro di voler eliminare questa voce?')) return;
    try {
      await eliminaRegolazioneCliente(id);
      await caricaRegolazioni();
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore durante l\'eliminazione.' });
    }
  };

  const getNomeCliente = (id) => {
    const c = clienti.find(x => x.id === id);
    return c ? c.ragione_sociale : id;
  };

  return (
    <div className="w-full space-y-6 p-6">
      <div className="flex items-center gap-4 mb-8 border-b border-slate-700 pb-4">
        <button 
          onClick={() => navigate('/admin/dashboard')}
          className="p-2 bg-slate-900/50 rounded-full text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="p-3 bg-indigo-500/20 rounded-xl">
          <Settings2 className="w-8 h-8 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Sconti e Maggiorazioni</h1>
          <p className="text-slate-400 mt-1">Gestisci gli sconti e le maggiorazioni da applicare agli elaborati mensili dei clienti.</p>
        </div>
      </div>

      {/* Filtri Periodo */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Mese</label>
          <select 
            value={mese} 
            onChange={(e) => setMese(Number(e.target.value))}
            className="p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 min-w-[150px] outline-none text-slate-200"
          >
            {mesi.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Anno</label>
          <input 
            type="number" 
            value={anno} 
            onChange={(e) => setAnno(Number(e.target.value))}
            className="p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-24 outline-none text-slate-200"
          />
        </div>
        <div className="flex-1 min-w-[300px]">
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cliente</label>
          <SearchableClientSelect 
            value={idClienteSelezionato}
            onChange={(val) => setIdClienteSelezionato(val)}
            clienti={clienti}
            placeholder="-- Seleziona Cliente --"
            className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Inserimento */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700 h-fit">
          <h3 className="font-bold text-slate-50 mb-6 uppercase tracking-wide text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" /> Nuova Voce
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Tipo</label>
              <select 
                value={nuovaRegolazione.tipo}
                onChange={(e) => setNuovaRegolazione({...nuovaRegolazione, tipo: e.target.value})}
                className="w-full p-2.5 bg-slate-900/80 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Sconto">Sconto (riduce imponibile)</option>
                <option value="Maggiorazione">Maggiorazione (aumenta imponibile)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Importo (€)</label>
              <input 
                type="number"
                step="0.01"
                min="0"
                value={nuovaRegolazione.importo}
                onChange={(e) => setNuovaRegolazione({...nuovaRegolazione, importo: e.target.value})}
                className="w-full p-2.5 bg-slate-900/80 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Descrizione / Note</label>
              <textarea 
                value={nuovaRegolazione.descrizione}
                onChange={(e) => setNuovaRegolazione({...nuovaRegolazione, descrizione: e.target.value})}
                className="w-full p-2.5 bg-slate-900/80 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                rows="3"
                placeholder="Es. Sconto pattuito, Maggiorazione per materiali..."
              ></textarea>
            </div>

            <button 
              onClick={handleSalva}
              disabled={isSaving}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? 'Salvataggio...' : 'Registra Voce'}
            </button>
          </div>
        </div>

        {/* Lista Voci */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700 overflow-hidden flex flex-col">
          <h3 className="font-bold text-slate-50 mb-6 uppercase tracking-wide text-sm">
            Voci Registrate ({mesi.find(m => m.val === mese)?.label} {anno})
          </h3>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
            ) : regolazioni.length === 0 ? (
              <div className="text-center text-slate-400 p-8 border-2 border-dashed border-slate-700 rounded-xl">
                Nessuna voce registrata per questo mese.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-900/50 text-slate-400 font-semibold uppercase text-[11px]">
                    <th className="p-3 rounded-tl-lg">Cliente</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Descrizione</th>
                    <th className="p-3 text-right">Importo</th>
                    <th className="p-3 rounded-tr-lg"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {regolazioni.map(r => (
                    <tr key={r.id} className="hover:bg-slate-900/30 transition-colors group">
                      <td className="p-3 font-medium text-slate-200">{getNomeCliente(r.idCliente)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${r.tipo === 'Maggiorazione' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                          {r.tipo}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 truncate max-w-[150px]">{r.descrizione}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-200">
                        {r.tipo === 'Sconto' ? '-' : '+'} € {parseFloat(r.importo).toFixed(2)}
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => handleElimina(r.id)}
                          className="text-slate-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      <ModernModal 
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.type === 'success' ? 'Salvato' : 'Errore'}
        message={modalState.message}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />
    </div>
  );
}
