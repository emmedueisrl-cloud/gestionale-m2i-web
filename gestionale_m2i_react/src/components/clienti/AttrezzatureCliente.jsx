import React, { useState, useEffect } from 'react';
import { Package, Plus, Link2, Trash2 } from 'lucide-react';
import { getAttrezzatureCliente, eliminaAttrezzatura } from '../../api/magazzino';
import NuovaAttrezzaturaModal from '../../pages/Magazzino/NuovaAttrezzaturaModal';
import ModernModal from '../ui/ModernModal';

export default function AttrezzatureCliente({ clienteId }) {
  const [attrezzature, setAttrezzature] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getAttrezzatureCliente(clienteId);
      setAttrezzature(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (clienteId) {
      loadData();
    }
  }, [clienteId]);

  const handleRimozione = (id) => {
    setModal({
      isOpen: true,
      type: 'warning',
      title: 'Conferma Eliminazione',
      content: "Attenzione: rimuovere l'attrezzatura dal database? (Per disassegnarla usa la funzione in Magazzino)",
      primaryAction: {
        label: 'Elimina',
        onClick: async () => {
          setModal({ isOpen: false });
          try {
            await eliminaAttrezzatura(id);
            loadData();
          } catch (err) {
            setModal({
              isOpen: true,
              type: 'error',
              title: 'Errore',
              content: "Errore durante l'eliminazione"
            });
          }
        }
      },
      secondaryAction: {
        label: 'Annulla',
        onClick: () => setModal({ isOpen: false })
      }
    });
  };

  return (
    <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden mb-8">
      <div className="bg-slate-900/50 border-b border-slate-700 p-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-slate-50 uppercase text-sm tracking-wide">Strumentazione e Attrezzature</h2>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuovo Strumento
        </button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="text-slate-400 text-sm">Caricamento in corso...</div>
        ) : attrezzature.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attrezzature.map(att => (
              <div key={att.id} className="bg-slate-900 rounded-xl p-4 border border-slate-700 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-white font-bold text-lg">{att.nome}</h3>
                    {att.codice_custom && (
                      <span className="inline-block mt-1 bg-slate-800 px-2 py-0.5 rounded text-xs font-mono text-slate-300 border border-slate-700">
                        {att.codice_custom}
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => handleRimozione(att.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                {att.descrizione && (
                  <p className="text-sm text-slate-400 mb-4 flex-1">{att.descrizione}</p>
                )}

                {att.foto && att.foto.length > 0 && (
                  <div className="mt-auto pt-4 border-t border-slate-800 flex gap-2">
                    {att.foto.map((url, i) => (
                      <img 
                        key={i} 
                        src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${url}`} 
                        alt="Foto att" 
                        className="w-12 h-12 rounded-lg object-cover border border-slate-700" 
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-700">
            <Package className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Nessuna attrezzatura registrata presso il cliente.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <NuovaAttrezzaturaModal 
          preselectedClienteId={clienteId}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            loadData();
          }}
        />
      )}

      <ModernModal 
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.content}
        primaryAction={modal.primaryAction}
        secondaryAction={modal.secondaryAction}
        onClose={() => {
          if(!modal.primaryAction) setModal({ ...modal, isOpen: false });
        }}
      />
    </div>
  );
}
