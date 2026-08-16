import React, { useState, useEffect } from 'react';
import { CreditCard, Search, Loader2, DollarSign, CalendarClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { recuperaPagamenti, registraPagamento } from '../../api/commerciale';
import DataTable from '../../components/ui/DataTable';
import ModernModal from '../../components/ui/ModernModal';

export default function Pagamenti() {
  const navigate = useNavigate();
  
  const [pagamenti, setPagamenti] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, type: '', message: '' });

  const caricaDati = async () => {
    setIsLoading(true);
    try {
      const dati = await recuperaPagamenti();
      setPagamenti(dati || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    caricaDati();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegistraIncasso = async (idFattura, importo) => {
    try {
      await registraPagamento({ idFattura, dataPagamento: new Date().toISOString().split('T')[0], importoIncassato: importo });
      caricaDati();
      setModalState({ isOpen: true, type: 'success', message: 'Incasso registrato con successo.' });
    } catch (err) {
      console.error(err);
      setModalState({ isOpen: true, type: 'error', message: 'Errore registrazione.' });
    }
  };

  const columns = [
    { header: 'Cliente', accessor: 'cliente' },
    { header: 'Fattura N.', accessor: 'numeroFattura' },
    { header: 'Data Emissione', accessor: 'dataEmissione' },
    { 
      header: 'Scadenza', 
      accessor: 'dataScadenza',
      render: (row) => {
        const scaduta = new Date(row.dataScadenza) < new Date();
        return (
          <span className={`font-semibold ${scaduta && row.stato !== 'Saldato' ? 'text-red-400' : 'text-slate-200'}`}>
            {row.dataScadenza} {scaduta && row.stato !== 'Saldato' && '⚠️'}
          </span>
        );
      }
    },
    { 
      header: 'Importo', 
      accessor: 'importo',
      render: (row) => <span className="font-bold">€ {parseFloat(row.importo).toFixed(2)}</span>
    },
    { 
      header: 'Stato', 
      accessor: 'stato', // Da Incassare, Saldato
      render: (row) => (
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${row.stato === 'Saldato' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
          {row.stato}
        </span>
      )
    },
    {
      header: 'Azioni',
      accessor: 'azioni',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.stato !== 'Saldato' && (
            <button 
              onClick={() => handleRegistraIncasso(row.idFattura, row.importo)}
              className="flex items-center gap-1.5 p-2 bg-slate-900 border border-slate-700 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 rounded-lg transition-all shadow-sm text-xs font-bold uppercase tracking-wider"
              title="Registra Incasso Completo"
            >
              <DollarSign className="w-4 h-4" /> Incassa
            </button>
          )}
        </div>
      )
    }
  ];

  const statSaldati = pagamenti.filter(p => p.stato === 'Saldato').reduce((acc, p) => acc + parseFloat(p.importo), 0);
  const statDaIncassare = pagamenti.filter(p => p.stato !== 'Saldato').reduce((acc, p) => acc + parseFloat(p.importo), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 rounded-xl">
            <CreditCard className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-50">Scadenziario Pagamenti</h1>
            <p className="text-slate-400 text-sm">Monitoraggio incassi e fatture scadute</p>
          </div>
        </div>

        <div className="flex gap-4 text-sm">
          <div className="bg-slate-800 px-4 py-3 rounded-xl border border-emerald-500/50 shadow-sm flex flex-col">
            <span className="text-slate-400 font-medium text-xs uppercase mb-1">Totale Incassato</span>
            <span className="font-bold text-emerald-400 text-lg">€ {statSaldati.toFixed(2)}</span>
          </div>
          <div className="bg-slate-800 px-4 py-3 rounded-xl border border-red-200 shadow-sm flex flex-col">
            <span className="text-slate-400 font-medium text-xs uppercase mb-1">Da Incassare</span>
            <span className="font-bold text-red-400 text-lg">€ {statDaIncassare.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-800/70 z-10 flex items-center justify-center text-emerald-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}
        <DataTable 
          columns={columns} 
          data={pagamenti} 
          searchPlaceholder="Cerca cliente o fattura..."
          itemsPerPage={15}
        />
      </div>

      <ModernModal 
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.type === 'error' ? 'Errore' : 'Avviso'}
        message={modalState.message}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />
    </div>
  );
}
