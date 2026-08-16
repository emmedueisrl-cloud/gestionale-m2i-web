import React, { useState, useEffect } from 'react';
import { Briefcase, Download, Loader2 } from 'lucide-react';
import { calcolaProvvigioni } from '../../api/commerciale';
import DataTable from '../../components/ui/DataTable';

export default function Provvigioni() {
  const dataOdierna = new Date();
  const [mese, setMese] = useState(dataOdierna.getMonth() === 0 ? 12 : dataOdierna.getMonth());
  const [anno, setAnno] = useState(dataOdierna.getMonth() === 0 ? dataOdierna.getFullYear() - 1 : dataOdierna.getFullYear());
  
  const [dati, setDati] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const mesi = [
    { val: 1, label: 'Gennaio' }, { val: 2, label: 'Febbraio' }, { val: 3, label: 'Marzo' },
    { val: 4, label: 'Aprile' }, { val: 5, label: 'Maggio' }, { val: 6, label: 'Giugno' },
    { val: 7, label: 'Luglio' }, { val: 8, label: 'Agosto' }, { val: 9, label: 'Settembre' },
    { val: 10, label: 'Ottobre' }, { val: 11, label: 'Novembre' }, { val: 12, label: 'Dicembre' }
  ];

  const caricaElaborato = async () => {
    setIsLoading(true);
    try {
      const resp = await calcolaProvvigioni(mese, anno);
      setDati(resp || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    caricaElaborato();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mese, anno]);

  const columns = [
    { header: 'Agente / Commerciale', accessor: 'agente' },
    { header: 'Cliente Gestito', accessor: 'cliente' },
    { 
      header: 'Fatturato Cliente', 
      accessor: 'fatturato',
      render: (row) => `€ ${parseFloat(row.fatturato || 0).toFixed(2)}`
    },
    { 
      header: 'Ore Erogate', 
      accessor: 'oreLavorate',
      render: (row) => <span className="font-medium">{parseFloat(row.oreLavorate || 0).toFixed(2)}</span>
    },
    { 
      header: 'Tipo Provvigione', 
      accessor: 'tipoCalcolo', // es. "% su Fatturato", "Fissa su Ore"
      render: (row) => <span className="text-xs font-bold text-slate-400 uppercase">{row.tipoCalcolo}</span>
    },
    { 
      header: 'Base/Valore', 
      accessor: 'valoreBase', // es. "5%", "1.50€"
      render: (row) => <span className="font-mono text-sm">{row.valoreBase}</span>
    },
    { 
      header: 'Provvigione Spettante', 
      accessor: 'totaleProvvigione',
      render: (row) => <span className="font-bold text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/30">€ {parseFloat(row.totaleProvvigione || 0).toFixed(2)}</span>
    },
    {
      header: 'Azioni',
      accessor: 'azioni',
      render: (row) => (
        <button 
          onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/pdf/provvigioni?mese=${mese}&anno=${anno}&cliente_id=${row.cliente_id}`)}
          className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
          title="Scarica PDF Provvigione"
        >
          <Download className="w-4 h-4" />
        </button>
      )
    }
  ];

  const totaleMese = dati.reduce((acc, row) => acc + (parseFloat(row.totaleProvvigione) || 0), 0);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Provvigioni Commerciali</h1>
          <p className="text-slate-400 mt-1">Calcolo provvigioni su base ore o fatturato</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="bg-slate-800 px-6 py-4 rounded-xl border border-violet-500/50 shadow-sm inline-flex flex-col">
          <span className="text-slate-400 font-medium text-xs uppercase tracking-wider mb-1">Totale Provvigioni del Mese</span>
          <span className="font-black text-violet-300 text-2xl">€ {totaleMese.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex-1 bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-800/70 z-10 flex flex-col items-center justify-center text-violet-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
          </div>
        )}
        <DataTable 
          columns={columns} 
          data={dati} 
          searchPlaceholder="Cerca agente o cliente..."
          itemsPerPage={15}
        />
      </div>
    </div>
  );
}
