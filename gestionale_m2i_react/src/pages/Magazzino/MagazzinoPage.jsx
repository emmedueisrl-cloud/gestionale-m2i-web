import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Trash2, Edit, Link2, ArchiveRestore } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import { getMagazzino, eliminaAttrezzatura, assegnaAttrezzatura } from '../../api/magazzino';
import NuovaAttrezzaturaModal from './NuovaAttrezzaturaModal';
import ModalAssegna from './ModalAssegna';
import ModernModal from '../../components/ui/ModernModal';

export default function MagazzinoPage() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignModalData, setAssignModalData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getMagazzino();
      setItems(data || []);
    } catch (error) {
      console.error("Errore recupero magazzino:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = (id) => {
    setModal({
      isOpen: true,
      type: 'warning',
      title: 'Conferma Eliminazione',
      content: "Sei sicuro di voler eliminare questa attrezzatura? Questa azione non può essere annullata.",
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

  const handleUnassign = (id) => {
    setModal({
      isOpen: true,
      type: 'warning',
      title: 'Ritira in Magazzino',
      content: "Sei sicuro di voler ritirare questa attrezzatura (rimuovere l'assegnazione al cliente)?",
      primaryAction: {
        label: 'Ritira',
        onClick: async () => {
          setModal({ isOpen: false });
          try {
            await assegnaAttrezzatura(id, null);
            loadData();
          } catch (err) {
            setModal({
              isOpen: true,
              type: 'error',
              title: 'Errore',
              content: "Errore durante l'operazione"
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

  const filteredItems = items.filter(item => 
    (item.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.codice_custom || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { 
      accessor: 'codice_custom', 
      header: 'Codice',
      render: (row) => (
        <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded text-slate-300 border border-slate-700">
          {row.codice_custom || row.id}
        </span>
      )
    },
    { accessor: 'nome', header: 'Nome Attrezzatura' },
    { 
      accessor: 'cliente_nome', 
      header: 'Stato / Assegnazione',
      render: (row) => (
        row.cliente_nome ? 
        <span className="text-emerald-400 font-medium">Assegnato: {row.cliente_nome}</span> : 
        <span className="text-amber-400 font-medium">In Magazzino</span>
      )
    },
    { 
      accessor: 'foto', 
      header: 'Foto',
      render: (row) => (
        row.foto && row.foto.length > 0 ? 
        <img src={row.foto[0]} alt="thumb" className="h-8 w-8 object-cover rounded" /> : 
        <span className="text-slate-500 text-xs">Nessuna</span>
      )
    },
    { 
      accessor: 'data_creazione', 
      header: 'Data Ins.',
      render: (row) => row.data_creazione ? new Date(row.data_creazione).toLocaleDateString('it-IT') : '-'
    },
    {
      accessor: 'actions',
      header: 'Azioni',
      render: (row) => (
        <div className="flex gap-2">
          {!row.cliente_id ? (
            <button 
              onClick={() => setAssignModalData(row)}
              title="Assegna a cliente"
              className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition-colors"
            >
              <Link2 className="w-4 h-4" />
            </button>
          ) : (
            <button 
              onClick={() => handleUnassign(row.id)}
              title="Ritira in magazzino"
              className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors"
            >
              <ArchiveRestore className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={() => handleDelete(row.id)}
            title="Elimina"
            className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Package className="w-6 h-6 text-indigo-400" />
            </div>
            Magazzino Attrezzature
          </h1>
          <p className="text-slate-400 mt-1 ml-12">Gestione inventario e strumentazioni</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25"
        >
          <Plus className="w-4 h-4" />
          Nuova Attrezzatura
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca per nome o codice..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Tabella */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <DataTable 
          data={filteredItems} 
          columns={columns} 
          isLoading={isLoading}
          emptyMessage="Nessuna attrezzatura trovata in magazzino."
        />
      </div>

      {/* Modal Creazione */}
      {isModalOpen && (
        <NuovaAttrezzaturaModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            loadData();
          }}
        />
      )}

      {/* Modal Assegnazione */}
      {assignModalData && (
        <ModalAssegna
          attrezzatura={assignModalData}
          onClose={() => setAssignModalData(null)}
          onSuccess={() => {
            setAssignModalData(null);
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
