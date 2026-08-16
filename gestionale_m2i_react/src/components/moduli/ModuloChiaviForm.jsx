import React, { useState, useEffect } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import ModernModal from '../ui/ModernModal';
import { recuperaElencoClienti } from '../../api/clienti';

export default function ModuloChiaviForm({ isOpen, onClose, dipendenteData, onGenerate }) {
  const [clienti, setClienti] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });

  const [formData, setFormData] = useState({
    dataVerbale: new Date().toISOString().split('T')[0],
    clienteId: '',
    clienteNome: '',
    indirizzoImmobile: '',
    chiaviPortone: '',
    chiaviIngresso: '',
    chiaviCancello: '',
    badge: '',
    telecomando: '',
    altro: '',
    note: ''
  });

  const [indirizziDisponibili, setIndirizziDisponibili] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadClienti();
    }
  }, [isOpen]);

  const loadClienti = async () => {
    setIsLoading(true);
    try {
      const data = await recuperaElencoClienti();
      setClienti(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClienteChange = (e) => {
    const selectedId = e.target.value;
    const selectedCliente = clienti.find(c => c.id === selectedId);
    
    let indirizzi = [];
    if (selectedCliente) {
      if (selectedCliente.indirizzo_sede || selectedCliente.citta) {
        indirizzi.push(`${selectedCliente.indirizzo_sede || ''} ${selectedCliente.civico_sede || ''} - ${selectedCliente.citta || ''}`.trim().replace(/^ - | - $/g, ''));
      }
      if (selectedCliente.sedeOperativa && Array.isArray(selectedCliente.sedeOperativa)) {
        selectedCliente.sedeOperativa.forEach(sede => {
          if (sede.indirizzo || sede.citta) {
            indirizzi.push(`${sede.indirizzo || ''} ${sede.civico || ''} - ${sede.citta || ''}`.trim().replace(/^ - | - $/g, ''));
          }
        });
      }
    }
    
    setIndirizziDisponibili(indirizzi);

    setFormData(prev => ({
      ...prev,
      clienteId: selectedId,
      clienteNome: selectedCliente ? selectedCliente.ragioneSociale : '',
      indirizzoImmobile: indirizzi.length > 0 ? indirizzi[0] : ''
    }));
  };

  const handleSubmit = () => {
    if (!formData.clienteNome) {
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: 'Attenzione',
        content: 'Seleziona un cliente.',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
      return;
    }
    if (!formData.dataVerbale) {
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: 'Attenzione',
        content: 'Inserisci la data.',
        primaryAction: { label: 'Chiudi', onClick: () => setAlertModal({ isOpen: false }) }
      });
      return;
    }
    onGenerate(formData);
  };

  const formContent = (
    <div className="flex flex-col gap-4 text-left mt-2">
      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 mb-2">
        <h3 className="font-semibold text-slate-200 mb-1">Dati Dipendente</h3>
        <p className="text-sm text-slate-400">
          <span className="text-slate-300">{dipendenteData?.nome} {dipendenteData?.cognome}</span> - {dipendenteData?.qualifica || dipendenteData?.mansione || 'Nessuna mansione specificata'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">Data Verbale</label>
          <input 
            type="date" 
            value={formData.dataVerbale}
            onChange={e => setFormData({...formData, dataVerbale: e.target.value})}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-300">Cliente</label>
          <select 
            value={formData.clienteId}
            onChange={handleClienteChange}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">-- Seleziona Cliente --</option>
            {clienti.map(c => (
              <option key={c.id} value={c.id}>{c.ragioneSociale}</option>
            ))}
          </select>
        </div>
        
        {formData.clienteId && (
          <div className="space-y-1 col-span-1 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Indirizzo dell'immobile (Modificabile)</label>
            <div className="flex gap-2">
              {indirizziDisponibili.length > 0 && (
                <select 
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 max-w-[200px]"
                  onChange={(e) => {
                    if(e.target.value) setFormData({...formData, indirizzoImmobile: e.target.value});
                  }}
                  value={indirizziDisponibili.includes(formData.indirizzoImmobile) ? formData.indirizzoImmobile : ""}
                >
                  <option value="">-- Seleziona --</option>
                  {indirizziDisponibili.map((ind, i) => (
                    <option key={i} value={ind}>{ind}</option>
                  ))}
                </select>
              )}
              <input 
                type="text" 
                value={formData.indirizzoImmobile}
                onChange={e => setFormData({...formData, indirizzoImmobile: e.target.value})}
                placeholder="Digita o seleziona un indirizzo..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 border-t border-slate-700 pt-4">
        <h4 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-indigo-400" />
          Materiale Consegnato (Quantità)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Chiavi Portone</label>
            <input type="number" min="0" value={formData.chiaviPortone} onChange={e => setFormData({...formData, chiaviPortone: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Chiavi Ingresso</label>
            <input type="number" min="0" value={formData.chiaviIngresso} onChange={e => setFormData({...formData, chiaviIngresso: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Chiavi Cancello</label>
            <input type="number" min="0" value={formData.chiaviCancello} onChange={e => setFormData({...formData, chiaviCancello: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Badge</label>
            <input type="number" min="0" value={formData.badge} onChange={e => setFormData({...formData, badge: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Telecomando</label>
            <input type="number" min="0" value={formData.telecomando} onChange={e => setFormData({...formData, telecomando: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Altro (Descrizione)</label>
            <input type="text" value={formData.altro} onChange={e => setFormData({...formData, altro: e.target.value})} placeholder="Es. 1 Chiave armadietto" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200" />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <label className="text-sm font-medium text-slate-300">Note / Ulteriori Dettagli</label>
        <textarea 
          value={formData.note}
          onChange={e => setFormData({...formData, note: e.target.value})}
          placeholder="Inserisci eventuali note (opzionale)..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
        />
      </div>
    </div>
  );

  return (
    <>
      <ModernModal
        isOpen={isOpen}
        type="info"
        title="Genera Verbale Affidamento Chiavi"
        content={isLoading ? <div className="flex justify-center p-4"><Loader2 className="animate-spin text-indigo-400" /></div> : formContent}
        onClose={onClose}
        maxWidth="max-w-xl"
        primaryAction={{
          label: 'Genera Bozza',
          onClick: handleSubmit
        }}
        secondaryAction={{
          label: 'Annulla',
          onClick: onClose
        }}
      />
      <ModernModal 
        {...alertModal}
        onClose={() => setAlertModal({ isOpen: false })}
      />
    </>
  );
}
