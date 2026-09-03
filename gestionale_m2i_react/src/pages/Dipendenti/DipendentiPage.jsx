import React, { useState, useEffect } from 'react';
import { FileText, Users, Loader2, Plus, Eye, Edit, Hourglass, Infinity, UserMinus, FileSignature, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable';
import ModernModal from '../../components/ui/ModernModal';
import ProgrammaFissoModal from '../../components/ui/ProgrammaFissoModal';
import BustePagaDipendenteModal from '../../components/ui/BustePagaDipendenteModal';
import { recuperaTuttiIDipendenti, recuperaDipendentiCestinati, eliminaDipendente, ripristinaDipendente } from '../../api/dipendenti';


export default function DipendentiPage() {
  const navigate = useNavigate();
  const [dipendenti, setDipendenti] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewCestino, setViewCestino] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', content: '' });
  const [actionDipendente, setActionDipendente] = useState(null);
  const [programmaFissoModalState, setProgrammaFissoModalState] = useState({ isOpen: false, idDipendente: null });
  const [bustePagaModalState, setBustePagaModalState] = useState({ isOpen: false, dipendenteId: null, dipendenteNome: '' });
  const [sortBy, setSortBy] = useState('nome'); // 'nome' o 'tipoContratto'
  const [nascondiCessati, setNascondiCessati] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      try {
        let data = [];
        if (viewCestino) {
          data = await recuperaDipendentiCestinati();
        } else {
          data = await recuperaTuttiIDipendenti();
        }
        if (!isCancelled) {
          setDipendenti(data || []);
        }
      } catch (error) {
        console.error("Errore recupero dipendenti:", error);
        if (!isCancelled) {
          setModal({
            isOpen: true,
            type: 'error',
            title: 'Errore di Rete',
            content: 'Impossibile comunicare con il server. Verifica la tua connessione.',
            primaryAction: { label: 'Chiudi', onClick: () => setModal({ isOpen: false }) }
          });
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [viewCestino, refreshTrigger]);

  // Ordinamento dei dipendenti in base alla scelta dell'utente
  const sortedDipendenti = React.useMemo(() => {
    let list = [...dipendenti];
    
    if (nascondiCessati) {
      list = list.filter(d => d.stato !== 'Cessato');
    }

    if (sortBy === 'nome') {
      list.sort((a, b) => {
        const nomeA = (a.nomeCompleto || '').toLowerCase();
        const nomeB = (b.nomeCompleto || '').toLowerCase();
        if (nomeA < nomeB) return -1;
        if (nomeA > nomeB) return 1;
        return 0;
      });
    } else if (sortBy === 'tipoContratto') {
      list.sort((a, b) => {
        const tipoA = (a.stato || '').toLowerCase();
        const tipoB = (b.stato || '').toLowerCase();
        if (tipoA < tipoB) return -1;
        if (tipoA > tipoB) return 1;
        
        // In caso di parità di tipo contratto, ordina secondariamente per nomeCompleto
        const nomeA = (a.nomeCompleto || '').toLowerCase();
        const nomeB = (b.nomeCompleto || '').toLowerCase();
        if (nomeA < nomeB) return -1;
        if (nomeA > nomeB) return 1;
        return 0;
      });
    }
    return list;
  }, [dipendenti, sortBy, nascondiCessati]);

  const handleElimina = async (idToEliminate) => {
    if (!idToEliminate) return;
    try {
      const res = await eliminaDipendente(idToEliminate);
      setModal({
        isOpen: true,
        type: 'success',
        title: res.type === 'soft' ? 'Spostato nel Cestino' : 'Eliminato Definitivamente',
        content: res.message,
        primaryAction: {
          label: 'Chiudi',
          onClick: () => {
            setModal({ isOpen: false });
            setActionDipendente(null);
            triggerRefresh();
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

  const handleRipristina = async (dip) => {
    try {
      await ripristinaDipendente(dip.id);
      triggerRefresh();
    } catch (error) {
      setModal({
        isOpen: true,
        type: 'error',
        title: 'Errore di Ripristino',
        content: error.message || 'Si è verificato un errore durante il ripristino.',
        primaryAction: { label: 'Chiudi', onClick: () => setModal({ isOpen: false }) }
      });
    }
  };

  const columns = [
    { header: 'ID', accessor: 'id' },
    { header: 'Nominativo', accessor: 'nomeCompleto' },
    { header: 'Codice Fiscale', accessor: 'codiceFiscale' },
    { 
      header: 'Stato', 
      accessor: 'stato',
      render: (row) => {
        const stato = row.stato || 'Sconosciuto';
        let colorClass = 'bg-slate-100 text-slate-200';
        
        if (stato === 'Indeterminato') colorClass = 'bg-emerald-500/20 text-emerald-300';
        else if (stato === 'Determinato') colorClass = 'bg-indigo-500/20 text-indigo-300';
        else if (stato === 'In Prova') colorClass = 'bg-cyan-500/20 text-cyan-300';
        else if (stato === 'Bozza') colorClass = 'bg-amber-500/20 text-amber-400';
        else if (stato === 'Cessato') colorClass = 'bg-red-500/20 text-red-300';

        let testoScadenza = null;
        if (stato === 'Determinato' && row.scadenza) {
          const oggi = new Date();
          oggi.setHours(0, 0, 0, 0);
          const dataScadenza = new Date(row.scadenza);
          dataScadenza.setHours(0, 0, 0, 0);
          const diffTime = dataScadenza - oggi;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            testoScadenza = <span className="text-red-400 font-bold block mt-1 text-[10px] tracking-wide">Scaduto da {-diffDays} gg</span>;
          } else if (diffDays === 0) {
            testoScadenza = <span className="text-amber-400 font-bold block mt-1 text-[10px] tracking-wide">Scade oggi!</span>;
          } else {
            testoScadenza = <span className="text-indigo-300/80 block mt-1 text-[10px] tracking-wide">Scade fra {diffDays} gg</span>;
          }
        }

        return (
          <div className="flex flex-col items-start">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${colorClass}`}>
              {stato}
            </span>
            {testoScadenza}
          </div>
        );
      }
    },
    {
      header: (
        <div className="flex items-center gap-6 min-w-[480px]">
          <div className="w-[240px] font-bold text-slate-500 uppercase tracking-wider">AZIONI</div>
          <div className="w-[200px] border-l border-slate-700 pl-6 font-bold text-slate-500 uppercase tracking-wider">VISUALIZZA</div>
        </div>
      ),
      sortable: false,
      className: 'min-w-[480px]',
      render: (row) => (
        <div className="flex flex-col gap-2 min-w-[480px]">
          {!viewCestino ? (
            <div className="flex items-start gap-6">
              {/* Gruppo: AZIONI */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 max-w-[240px]">
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/dipendenti/modifica?id=${row.id}`) }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all shadow-sm"
                    title="Modifica"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Modifica</span>
                  </button>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionDipendente(row);
                      setModal({
                        isOpen: true,
                        type: 'warning',
                        title: 'Conferma Eliminazione',
                        content: `Sei sicuro di voler eliminare ${row.nomeCompleto}? Se ha registrato ore di lavoro, verrà spostato nel Cestino. Altrimenti verrà eliminato definitivamente con tutti i suoi file.`,
                        primaryAction: {
                          label: 'Sì, Elimina',
                          variant: 'danger',
                          onClick: () => handleElimina(row.id)
                        },
                        secondaryAction: {
                          label: 'Annulla',
                          onClick: () => {
                            setModal({ isOpen: false });
                            setActionDipendente(null);
                          }
                        }
                      });
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 transition-all shadow-sm"
                    title="Elimina"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="text-xs font-medium">Elimina</span>
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/dipendenti/trasformazione?id=${row.id}`) }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all shadow-sm"
                    title="Passaggio a Indeterminato"
                  >
                    <Infinity className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Indeterminato</span>
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/dipendenti/cessazione?id=${row.id}`) }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 transition-all shadow-sm"
                    title="Cessazione Rapporto"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Cessa</span>
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/dipendenti/proroghe?id=${row.id}`) }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all shadow-sm"
                    title="Proroga Contratto"
                  >
                    <Hourglass className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Proroga</span>
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/dipendenti/moduli?id=${row.id}`) }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all shadow-sm"
                    title="Moduli Dipendente"
                  >
                    <FileSignature className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Moduli</span>
                  </button>
                </div>
              </div>

              {/* Gruppo: VISUALIZZA */}
              <div className="flex flex-col gap-2 border-l border-slate-700 pl-6">
                <div className="flex flex-wrap items-center gap-2 max-w-[200px]">

                  <button 
                    onClick={(e) => { e.stopPropagation(); setProgrammaFissoModalState({ isOpen: true, idDipendente: row.id }) }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
                    title="Programma Fisso"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium text-indigo-300">PROGRAMMA FISSO</span>
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/dipendenti/scheda/${row.id}`) }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
                    title="Visualizza Scheda"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Scheda</span>
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); setBustePagaModalState({ isOpen: true, dipendenteId: row.id, dipendenteNome: row.nomeCompleto }) }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
                    title="Buste Paga"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Buste Paga</span>
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <button 
              onClick={() => handleRipristina(row)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 text-sm hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all shadow-sm"
              title="Ripristina"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span className="font-medium">Ripristina</span>
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-6 w-full h-[calc(100vh-100px)] flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 rounded-xl">
            <Users className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-50">Database Dipendenti</h1>
            <p className="text-slate-400 text-sm">Visualizza e gestisci l'organico aziendale</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setViewCestino(!viewCestino)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors shadow-sm ${
              viewCestino 
                ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
                : 'bg-red-600 text-white border border-red-700 hover:bg-red-700 shadow-red-500/20'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {viewCestino ? 'Torna agli Attivi' : 'Cestino'}
          </button>
          <button 
            onClick={() => navigate('/admin/dipendenti/nuovo')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" />
            Nuovo Dipendente
          </button>
        </div>
      </div>
      
      {/* Controlli di Ordinamento Superiore e Filtri */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-800 border border-slate-700/80 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ordina elenco per:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('nome')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                sortBy === 'nome' 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-500/20' 
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              Nome / Nominativo
            </button>
            <button
              onClick={() => setSortBy('tipoContratto')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                sortBy === 'tipoContratto' 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-500/20' 
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              Tipo Contratto
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-slate-100 transition-colors">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50"
              checked={nascondiCessati}
              onChange={(e) => setNascondiCessati(e.target.checked)}
            />
            <span className="text-sm font-semibold uppercase tracking-wider">Nascondi Cessati</span>
          </label>
          
          <div className="text-xs text-slate-500 font-medium">
            Dati ordinati localmente
          </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden relative">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/80 z-10 text-indigo-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="font-semibold text-sm">Caricamento elenco...</p>
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={sortedDipendenti} 
            searchPlaceholder="Cerca per nome, codice fiscale o ID..."
            pagination={false}
          />
        )}
      </div>

      <ModernModal 
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        content={modal.content}
        primaryAction={modal.primaryAction}
        secondaryAction={modal.secondaryAction}
        onClose={() => setModal({ isOpen: false })}
      />

      <ProgrammaFissoModal 
        isOpen={programmaFissoModalState.isOpen}
        idDipendente={programmaFissoModalState.idDipendente}
        onClose={() => setProgrammaFissoModalState({ isOpen: false, idDipendente: null })}
      />

      <BustePagaDipendenteModal
        isOpen={bustePagaModalState.isOpen}
        onClose={() => setBustePagaModalState({ isOpen: false, dipendenteId: null, dipendenteNome: '' })}
        dipendenteId={bustePagaModalState.dipendenteId}
        dipendenteNome={bustePagaModalState.dipendenteNome}
      />
    </div>
  );
}
