import React, { useState, useEffect } from 'react';
import { Building2, Loader2, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable';
import ModernModal from '../../components/ui/ModernModal';
import { recuperaTuttiIClienti, recuperaClientiCestinati, eliminaCliente, ripristinaCliente } from '../../api/clienti';

export default function ClientiPage() {
  const navigate = useNavigate();
  const [clienti, setClienti] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewCestino, setViewCestino] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });
  const [actionCliente, setActionCliente] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let data = [];
      if (viewCestino) {
        data = await recuperaClientiCestinati();
      } else {
        data = await recuperaTuttiIClienti();
      }
      setClienti(data || []);
    } catch (error) {
      console.error("Errore recupero clienti:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [viewCestino]);

  const handleElimina = async (idToEliminate) => {
    if (!idToEliminate) return;
    try {
      const res = await eliminaCliente(idToEliminate);
      setModal({
        isOpen: true,
        type: 'success',
        title: res.cestinato ? 'Spostato nel Cestino' : 'Eliminato Definitivamente',
        content: res.cestinato ? 'Il cliente aveva azioni collegate (fatture, ore, etc.) ed è stato spostato nel cestino in sicurezza.' : 'Il cliente è stato rimosso definitivamente.',
        primaryAction: {
          label: 'Chiudi',
          onClick: () => {
            setModal({ isOpen: false });
            setActionCliente(null);
            loadData();
          }
        }
      });
    } catch (error) {
      setModal({
        isOpen: true,
        type: 'error',
        title: 'Errore Cancellazione',
        content: error.message || 'Si è verificato un errore durante l\'eliminazione.',
        primaryAction: { label: 'Chiudi', onClick: () => setModal({ isOpen: false }) }
      });
    }
  };

  const handleRipristina = async (cli) => {
    try {
      await ripristinaCliente(cli.id);
      loadData();
    } catch (error) {
      setModal({
        isOpen: true,
        type: 'error',
        title: 'Attenzione',
        content: 'Errore durante il ripristino.',
        primaryAction: { label: 'Chiudi', onClick: () => setModal({ isOpen: false }) }
      });
    }
  };

  const columns = [
    { header: 'ID', accessor: 'id' },
    { header: 'Ragione Sociale', accessor: 'ragione_sociale' },
    { header: 'Partita IVA', accessor: 'partita_iva' },
    { 
      header: 'Stato', 
      accessor: 'attivo',
      render: (row) => {
        let stato = row.attivo === 'SI' ? 'Attivo' : (row.attivo === 'Bozza' ? 'Bozza' : 'Non Attivo');
        let colorClass = row.attivo === 'SI' ? 'bg-emerald-500/20 text-emerald-300' : (row.attivo === 'Bozza' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-300');
        
        return (
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${colorClass}`}>
            {stato}
          </span>
        );
      }
    },
    {
      header: 'Azioni',
      sortable: false,
      render: (row) => (
        <div className="flex items-center gap-2">
          {!viewCestino ? (
            <>
              <button 
                onClick={() => navigate(`/admin/clienti/scheda/${row.id}`)}
                className="flex items-center justify-center p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
                title="Vedi Scheda"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigate(`/admin/clienti/modifica?id=${row.id}`)}
                className="flex items-center justify-center p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all shadow-sm"
                title="Modifica"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button 
                onClick={() => {
                  setActionCliente(row);
                  setModal({
                    isOpen: true,
                    type: 'warning',
                    title: 'Conferma Eliminazione',
                    content: `Sei sicuro di voler eliminare il cliente ${row.ragione_sociale}? Se ci sono documenti collegati verrà spostato nel cestino.`,
                    primaryAction: {
                      label: 'Elimina',
                      onClick: () => handleElimina(row.id)
                    },
                    secondaryAction: {
                      label: 'Annulla',
                      onClick: () => {
                        setModal({ isOpen: false });
                        setActionCliente(null);
                      }
                    }
                  });
                }}
                className="flex items-center justify-center p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 transition-all shadow-sm"
                title="Elimina"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button 
              onClick={() => handleRipristina(row)}
              className="flex items-center justify-center px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-sm text-xs font-bold uppercase tracking-wider"
            >
              Ripristina
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-6 w-full space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-700">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 rounded-xl">
            <Building2 className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-50 uppercase tracking-tight">Database Clienti</h1>
            <p className="text-slate-400 text-sm mt-1">Gestisci l'anagrafica e visualizza i clienti attivi.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewCestino(!viewCestino)}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
              viewCestino 
                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600' 
                : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {viewCestino ? 'Torna all\'Elenco' : 'Cestino Clienti'}
          </button>
          
          {!viewCestino && (
            <button 
              onClick={() => navigate('/admin/clienti/nuovo')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Nuovo Cliente
            </button>
          )}
        </div>
      </div>

      {/* LIST SECTION */}
      <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
            <p className="text-sm font-medium">Caricamento in corso...</p>
          </div>
        ) : (
          <DataTable 
            data={clienti} 
            columns={columns} 
            searchPlaceholder="Cerca per ragione sociale, partita IVA..."
            emptyMessage={viewCestino ? "Nessun cliente nel cestino." : "Nessun cliente trovato. Clicca su 'Nuovo Cliente' per iniziare."}
          />
        )}
      </div>

      {/* MODAL */}
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
