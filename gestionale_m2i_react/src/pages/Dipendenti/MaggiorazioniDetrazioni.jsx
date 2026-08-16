import React, { useState, useEffect } from 'react';
import { DollarSign, Save, Loader2, Search, Plus, Trash2 } from 'lucide-react';
import { recuperaElencoDipendenti } from '../../api/dipendenti';
import { recuperaRegolazioniStipendi, salvaRegolazioneStipendio, eliminaRegolazioneStipendio } from '../../api/ore'; // Assuming endpoints will be here
import ModernModal from '../../components/ui/ModernModal';

export default function MaggiorazioniDetrazioni() {
  const [dipendenti, setDipendenti] = useState([]);
  const [regolazioni, setRegolazioni] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, type: '', message: '' });

  const dataOdierna = new Date();
  const [mese, setMese] = useState(dataOdierna.getMonth() + 1);
  const [anno, setAnno] = useState(dataOdierna.getFullYear());

  const [nuovaRegolazione, setNuovaRegolazione] = useState({
    idDipendente: '',
    tipo: 'Maggiorazione',
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
        const dips = await recuperaElencoDipendenti();
        setDipendenti(dips || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadFiltri();
  }, []);

  const [idDipendenteSelezionato, setIdDipendenteSelezionato] = useState('');

  useEffect(() => {
    caricaRegolazioni();
  }, [mese, anno, idDipendenteSelezionato]);

  async function caricaRegolazioni() {
    if (!idDipendenteSelezionato) {
      setRegolazioni([]);
      return;
    }
    setIsLoading(true);
    try {
      const dati = await recuperaRegolazioniStipendi(idDipendenteSelezionato, mese, anno);
      // Trasformiamo i dati nel formato atteso dalla tabella
      const parsed = (dati || []).map(d => ({
        id: d.idRegolazione,
        idDipendente: idDipendenteSelezionato,
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
    if (!idDipendenteSelezionato || !nuovaRegolazione.importo) {
      setModalState({ isOpen: true, type: 'error', message: 'Seleziona un dipendente e inserisci l\'importo.' });
      return;
    }
    setIsSaving(true);
    try {
      const d = dipendenti.find(x => x.id === idDipendenteSelezionato);
      const payload = {
        mese,
        anno,
        idDipendente: idDipendenteSelezionato,
        dipendente: d ? d.nomeCompleto : '',
        tipo: nuovaRegolazione.tipo,
        importo: parseFloat(nuovaRegolazione.importo) || 0,
        motivazione: nuovaRegolazione.descrizione
      };
      
      await salvaRegolazioneStipendio(payload);
      setNuovaRegolazione({ tipo: 'Maggiorazione', importo: '', descrizione: '' });
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
      await eliminaRegolazioneStipendio(id);
      await caricaRegolazioni();
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore durante l\'eliminazione.' });
    }
  };

  const getNomeDipendente = (id) => {
    const d = dipendenti.find(x => x.id === id);
    return d ? d.nomeCompleto : id;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8 border-b border-slate-700 pb-4">
        <div className="p-3 bg-indigo-500/20 rounded-xl">
          <DollarSign className="w-8 h-8 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Maggiorazioni e Detrazioni</h1>
          <p className="text-slate-400 mt-1">Gestisci bonus, rimborsi spesa, trattenute e anticipi per le buste paga.</p>
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
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Dipendente</label>
          <select 
            value={idDipendenteSelezionato}
            onChange={(e) => setIdDipendenteSelezionato(e.target.value)}
            className="w-full p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-200"
          >
            <option value="">-- Seleziona Dipendente --</option>
            {dipendenti.map(d => (
              <option key={d.id} value={d.id}>{d.nomeCompleto}</option>
            ))}
          </select>
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
                <option value="Maggiorazione">Maggiorazione (Bonus, Rimborsi)</option>
                <option value="Detrazione">Detrazione (Anticipi, Trattenute)</option>
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
                placeholder="Es. Rimborso Km, Acconto stipendio..."
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
                    <th className="p-3 rounded-tl-lg">Dipendente</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Descrizione</th>
                    <th className="p-3 text-right">Importo</th>
                    <th className="p-3 rounded-tr-lg"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {regolazioni.map(r => (
                    <tr key={r.id} className="hover:bg-slate-900/30 transition-colors group">
                      <td className="p-3 font-medium text-slate-200">{getNomeDipendente(r.idDipendente)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${r.tipo === 'Maggiorazione' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {r.tipo}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 truncate max-w-[150px]">{r.descrizione}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-200">
                        {r.tipo === 'Detrazione' ? '-' : '+'} € {parseFloat(r.importo).toFixed(2)}
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
