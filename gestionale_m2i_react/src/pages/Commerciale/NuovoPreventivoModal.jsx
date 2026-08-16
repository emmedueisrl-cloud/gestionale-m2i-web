import React, { useState, useEffect } from 'react';
import { X, FileText, User, MapPin, Euro, Briefcase, ListTodo, Building2 } from 'lucide-react';
import { recuperaElencoClienti } from '../../api/clienti';
import ModernModal from '../../components/ui/ModernModal';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api';

const NuovoPreventivoModal = ({ onClose, onSuccess }) => {
  const [isCliente, setIsCliente] = useState(false);
  const [clienti, setClienti] = useState([]);
  const [searchCliente, setSearchCliente] = useState('');
  
  const [formData, setFormData] = useState({
    cliente_prospect_id: '',
    ragione_sociale_prospect: '',
    oggetto: 'Preventivo per pulizie ordinarie',
    indirizzo_locali: '',
    tipo_prezzo: 'Mensile',
    costo_mensile: '',
    commerciale: '',
    servizi_inclusi: 'Spazzatura e lavaggio pavimenti; spolveratura superfici; pulizia servizi igienici; vuotatura cestini e, all’occorrenza, sostituzione dei relativi sacchetti.'
  });

  const [loading, setLoading] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });

  useEffect(() => {
    const fetchClienti = async () => {
      try {
        const data = await recuperaElencoClienti();
        // recuperaElencoClienti already returns only active clients (attivo === 'SI')
        setClienti(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchClienti();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Se seleziono un cliente, aggiorno la ragione sociale testuale e l'indirizzo
    if (name === 'cliente_prospect_id' && value !== '') {
      const c = clienti.find(cl => cl.id.toString() === value.toString());
      if (c) {
        setFormData(prev => ({ 
          ...prev, 
          ragione_sociale_prospect: c.ragione_sociale,
          indirizzo_locali: c.indirizzo_sede_legale || ''
        }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/preventivi/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        onSuccess();
      } else {
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Errore',
          content: 'Errore durante la generazione del preventivo',
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div className="bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700 bg-slate-900/50 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="text-indigo-400" size={24} /> Crea Nuovo Preventivo
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            
            <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
              <button 
                type="button" 
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${!isCliente ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                onClick={() => { setIsCliente(false); setFormData(p => ({...p, cliente_prospect_id: ''})); }}
              >
                <User size={16} /> Cliente non in database
              </button>
              <button 
                type="button" 
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${isCliente ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                onClick={() => setIsCliente(true)}
              >
                <Building2 size={16} /> Cliente Esistente
              </button>
            </div>

            <div className="space-y-4">
              {isCliente ? (
                <div className="relative">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                    <User className="text-slate-400" size={16} /> Seleziona Cliente
                  </label>
                  
                  {formData.cliente_prospect_id ? (
                    <div className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700 text-white rounded-xl">
                      <span className="font-bold">{formData.ragione_sociale_prospect}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({...prev, cliente_prospect_id: '', ragione_sociale_prospect: '', indirizzo_locali: ''}));
                          setSearchCliente('');
                        }}
                        className="text-slate-400 hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input 
                        type="text"
                        placeholder="Digita per cercare un cliente..."
                        value={searchCliente}
                        onChange={(e) => setSearchCliente(e.target.value)}
                        className="w-full p-3 bg-slate-900/50 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                        autoComplete="off"
                      />
                      
                      {clienti.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                          {clienti.filter(c => c.ragione_sociale?.toLowerCase().includes(searchCliente.toLowerCase())).length === 0 ? (
                            <div className="p-3 text-sm text-slate-400 text-center">Nessun cliente trovato</div>
                          ) : (
                            clienti.filter(c => c.ragione_sociale?.toLowerCase().includes(searchCliente.toLowerCase())).map(c => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full text-left p-3 text-sm text-white hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                                onClick={() => {
                                  const address = `${c.indirizzo_sede || ''} ${c.civico_sede || ''}`.trim();
                                  const city = `${c.cap || ''} ${c.citta || ''} ${c.provincia ? '(' + c.provincia + ')' : ''}`.trim();
                                  const fullAddress = [address, city].filter(Boolean).join(', ');

                                  setFormData(prev => ({ 
                                    ...prev, 
                                    cliente_prospect_id: c.id,
                                    ragione_sociale_prospect: c.ragione_sociale,
                                    indirizzo_locali: fullAddress || ''
                                  }));
                                  setSearchCliente('');
                                }}
                              >
                                <span className="block font-bold">{c.ragione_sociale}</span>
                                {(c.indirizzo_sede || c.citta) && (
                                  <span className="block text-xs text-slate-400 mt-0.5">
                                    {`${c.indirizzo_sede || ''} ${c.citta ? '- ' + c.citta : ''}`}
                                  </span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                    <User className="text-slate-400" size={16} /> Ragione Sociale
                  </label>
                  <input 
                    type="text" 
                    name="ragione_sociale_prospect" 
                    value={formData.ragione_sociale_prospect} 
                    onChange={handleChange} 
                    required 
                    className="w-full p-3 bg-slate-900/50 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600" 
                    placeholder="Es. Mario Rossi S.r.l." 
                  />
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                  <MapPin className="text-slate-400" size={16} /> Indirizzo Locali
                </label>
                <input 
                  type="text" 
                  name="indirizzo_locali" 
                  value={formData.indirizzo_locali} 
                  onChange={handleChange} 
                  className="w-full p-3 bg-slate-900/50 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600" 
                  placeholder="Indirizzo dove verrà svolto il servizio" 
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                  <Briefcase className="text-slate-400" size={16} /> Oggetto
                </label>
                <input 
                  type="text" 
                  name="oggetto" 
                  value={formData.oggetto} 
                  onChange={handleChange} 
                  required
                  className="w-full p-3 bg-slate-900/50 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600" 
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                  <ListTodo className="text-slate-400" size={16} /> Servizi Inclusi
                </label>
                <textarea 
                  name="servizi_inclusi" 
                  value={formData.servizi_inclusi} 
                  onChange={handleChange} 
                  required
                  rows="3"
                  className="w-full p-3 bg-slate-900/50 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 resize-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2">
                    <FileText className="text-slate-400" size={16} /> Tipo Prezzo
                  </label>
                  <select 
                    name="tipo_prezzo" 
                    value={formData.tipo_prezzo} 
                    onChange={handleChange} 
                    className="w-full p-3 bg-slate-900/50 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  >
                    <option value="Mensile">Mensile</option>
                    <option value="Orario">Orario</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-2 truncate" title={`Costo ${formData.tipo_prezzo} (€) (Esente IVA)`}>
                    <Euro className="text-slate-400 shrink-0" size={16} /> Costo {formData.tipo_prezzo} (€)
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    name="costo_mensile" 
                    value={formData.costo_mensile} 
                    onChange={handleChange} 
                    required 
                    className="w-full p-3 bg-slate-900/50 border border-slate-700 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600" 
                    placeholder="Es. 500.00" 
                  />
                </div>
              </div>
            </div>

          </div>
          
          <div className="p-6 border-t border-slate-700 bg-slate-800 shrink-0 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 rounded-xl font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
            >
              Annulla
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generazione...
                </>
              ) : (
                'Genera PDF e Salva'
              )}
            </button>
          </div>
        </form>
      </div>
      <ModernModal 
        {...alertModal}
        onClose={() => setAlertModal({ isOpen: false })}
      />
    </div>
  );
};

export default NuovoPreventivoModal;
