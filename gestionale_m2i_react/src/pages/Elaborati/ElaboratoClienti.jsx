import React, { useState, useEffect } from 'react';
import { Building2, Download, Loader2, Lock, Unlock, CheckCircle, Calendar, Search, Info, Printer } from 'lucide-react';
import { ottieniElaboratoClienti, chiudiMeseClienti, sbloccaMeseClienti, recuperaNoteElaborato, salvaNoteElaborato } from '../../api/elaborati';
import DataTable from '../../components/ui/DataTable';
import ModernModal from '../../components/ui/ModernModal';
import CalendarioClienteModal from '../../components/ui/CalendarioClienteModal';
import CellaNota from '../../components/ui/CellaNota';

export default function ElaboratoClienti() {
  const dataOdierna = new Date();
  const [mese, setMese] = useState(dataOdierna.getMonth() === 0 ? 12 : dataOdierna.getMonth());
  const [anno, setAnno] = useState(dataOdierna.getMonth() === 0 ? dataOdierna.getFullYear() - 1 : dataOdierna.getFullYear());
  
  const [dati, setDati] = useState([]);
  const [isChiuso, setIsChiuso] = useState(false);
  const [dataChiusura, setDataChiusura] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [modalState, setModalState] = useState({ isOpen: false, type: '', title: '', message: '', primaryAction: null });
  const [modalCalendario, setModalCalendario] = useState({ isOpen: false, clienteId: null, nomeCliente: '' });
  const [note, setNote] = useState({}); // { [idCliente]: 'testo nota' }

  const mesi = [
    { val: 1, label: 'Gennaio' }, { val: 2, label: 'Febbraio' }, { val: 3, label: 'Marzo' },
    { val: 4, label: 'Aprile' }, { val: 5, label: 'Maggio' }, { val: 6, label: 'Giugno' },
    { val: 7, label: 'Luglio' }, { val: 8, label: 'Agosto' }, { val: 9, label: 'Settembre' },
    { val: 10, label: 'Ottobre' }, { val: 11, label: 'Novembre' }, { val: 12, label: 'Dicembre' }
  ];

  const caricaElaborato = async () => {
    setIsLoading(true);
    try {
      const resp = await ottieniElaboratoClienti(mese, anno);
      if (resp && typeof resp === 'object' && !Array.isArray(resp)) {
        setIsChiuso(resp.chiuso);
        setDataChiusura(resp.dataChiusura);
        setDati(resp.dati || []);
      } else {
        setIsChiuso(false);
        setDataChiusura(null);
        setDati(Array.isArray(resp) ? resp : []);
      }
      // Carica note
      const noteArr = await recuperaNoteElaborato('cliente', mese, anno);
      const noteMap = {};
      (noteArr || []).forEach(n => { noteMap[n.soggetto_id] = n.testo; });
      setNote(noteMap);
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

  const handleChiudiMese = async () => {
    setModalState({
      isOpen: true,
      type: 'warning',
      title: 'Conferma Chiusura Mese Clienti',
      content: (
        <div className="text-left space-y-4">
          <p>
            <strong>Cosa significa chiudere un mese?</strong><br/>
            Chiudendo un mese, andrai a "congelare" e storicizzare tutti i calcoli di fatturazione per il mese selezionato.
          </p>
          <p>
            Da questo momento in poi, <strong>gli importi calcolati in questo mese rimarranno intatti</strong>, anche se in futuro modificherai la tariffa oraria di un cliente. Questo è essenziale per mantenere uno storico coerente con le fatture già emesse.
          </p>
          <p className="text-indigo-400">
            Avrai comunque 30 giorni di tempo per "Sbloccare" il mese in caso di errore.
          </p>
        </div>
      ),
      primaryAction: {
        label: 'Conferma Chiusura',
        onClick: async () => {
          setModalState({ ...modalState, isOpen: false });
          setIsLoading(true);
          try {
            await chiudiMeseClienti(mese, anno, dati);
            await caricaElaborato();
          } catch (err) {
            console.error(err);
            setModalState({
              isOpen: true,
              type: 'error',
              title: 'Errore',
              content: 'Errore durante la chiusura del mese.',
              primaryAction: { label: 'Chiudi', onClick: () => setModalState(prev => ({ ...prev, isOpen: false })) }
            });
          } finally {
            setIsLoading(false);
          }
        }
      },
      secondaryAction: {
        label: 'Annulla',
        onClick: () => setModalState(prev => ({ ...prev, isOpen: false }))
      }
    });
  };

  const handleSbloccaMese = async () => {
    setModalState({
      isOpen: true,
      type: 'danger',
      title: 'Sblocca Mese Clienti',
      content: `ATTENZIONE: Sbloccando il mese, i dati storicizzati verranno ricalcolati usando le TARIFFE ATTUALI dei clienti. Se hai modificato le tariffe nel frattempo, gli importi di questo mese cambieranno! Continuare?`,
      primaryAction: {
        label: 'Sblocca e Ricalcola',
        onClick: async () => {
          setModalState({ ...modalState, isOpen: false });
          setIsLoading(true);
          try {
            await sbloccaMeseClienti(mese, anno);
            await caricaElaborato();
          } catch (err) {
            console.error(err);
            setModalState({
              isOpen: true,
              type: 'error',
              title: 'Errore',
              content: err.message || "Errore durante lo sblocco del mese.",
              primaryAction: { label: 'Chiudi', onClick: () => setModalState(prev => ({ ...prev, isOpen: false })) }
            });
          } finally {
            setIsLoading(false);
          }
        }
      },
      secondaryAction: {
        label: 'Annulla',
        onClick: () => setModalState(prev => ({ ...prev, isOpen: false }))
      }
    });
  };

  const showInfoModal = (title, text) => {
    setModalState({
      isOpen: true,
      type: 'info',
      title: title,
      content: text,
      primaryAction: {
        label: 'Chiudi',
        onClick: () => setModalState(prev => ({ ...prev, isOpen: false }))
      },
      secondaryAction: null
    });
  };

  const columns = [
    { 
      header: 'Cliente', 
      accessor: 'ragioneSociale',
      render: (row) => (
        <div className="flex items-center gap-2 group max-w-[200px]">
          <span className="truncate text-xs">{row.ragioneSociale}</span>
          <div 
            title="Clicca per leggere il nome completo" 
            className="cursor-pointer opacity-50 hover:opacity-100 flex-shrink-0"
            onClick={() => showInfoModal('Ragione Sociale Completa', row.ragioneSociale)}
          >
            <Search className="w-3.5 h-3.5 text-indigo-400" />
          </div>
        </div>
      )
    },
    { 
      header: 'Ore Erogate', 
      accessor: 'oreLavorate',
      render: (row) => <span className="font-bold">{parseFloat(row.oreLavorate || 0).toFixed(2)}</span>
    },
    { 
      header: 'Tariffa Oraria', 
      accessor: 'tariffaOraria',
      render: (row) => `€ ${parseFloat(row.tariffaOraria || 0).toFixed(2)}`
    },
    { 
      header: 'Base Imponibile', 
      accessor: 'baseImponibile',
      render: (row) => `€ ${parseFloat(row.baseImponibile || 0).toFixed(2)}`
    },
    { 
      header: 'Sconti/Magg.', 
      accessor: 'sconti', 
      render: (row) => {
        const diff = parseFloat(row.maggiorazioni || 0) - parseFloat(row.sconti || 0);
        const notes = [row.noteMaggiorazioni, row.noteSconti].filter(Boolean).join(" | ");
        if (diff === 0 && !notes) return '€ 0.00';
        return (
          <div className="flex items-center gap-1.5">
            <span className={diff > 0 ? 'text-emerald-400 font-medium' : (diff < 0 ? 'text-red-400 font-medium' : 'text-slate-400')}>
              {diff > 0 ? '+' : ''}€ {diff.toFixed(2)}
            </span>
            {notes && (
              <Info 
                className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-indigo-300 transition-colors" 
                title="Clicca per leggere le note"
                onClick={() => showInfoModal('Note Regolazione', notes)}
              />
            )}
          </div>
        );
      }
    },
    { 
      header: 'Totale Imponibile', 
      accessor: 'imponibile',
      render: (row) => <span className="font-bold text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded">€ {parseFloat(row.imponibile || 0).toFixed(2)}</span>
    },
    {
      header: 'Regime Fiscale',
      accessor: 'tipoTassazione',
      render: (row) => {
        const tipo = (row.tipoTassazione || 'IVA').toUpperCase();
        const colorClass = tipo === 'REVERSE CHARGE' 
          ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
          : tipo.includes('TRAT') 
            ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
        const label = tipo === 'REVERSE CHARGE' ? 'REVERSE' : tipo.includes('TRAT') ? 'TRAT. ACC.' : 'IVA';
        return <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${colorClass}`}>{label}</span>;
      }
    },
    {
      header: '% Tassa',
      accessor: 'percentualeTassazione',
      render: (row) => {
        const tipo = (row.tipoTassazione || 'IVA').toUpperCase();
        if (tipo === 'REVERSE CHARGE') return <span className="text-amber-400 font-bold">0%</span>;
        return `${parseFloat(row.percentualeTassazione || 0).toFixed(0)}%`;
      }
    },
    { 
      header: 'Totale Tassato', 
      accessor: 'importoTotale',
      render: (row) => <span className="font-bold text-slate-50">€ {parseFloat(row.importoTotale || 0).toFixed(2)}</span>
    },
    { 
      header: 'Note',
      accessor: 'note',
      sortable: false,
      render: (row) => (
        <CellaNota
          testo={note[row.idCliente] || ''}
          onSave={async (testo) => {
            try {
              await salvaNoteElaborato('cliente', row.idCliente, mese, anno, testo);
              setNote(prev => ({ ...prev, [row.idCliente]: testo }));
            } catch (err) {
              setModalState({
                isOpen: true,
                type: 'error',
                title: 'Errore Salvataggio',
                content: "Errore durante il salvataggio della nota. Assicurati di aver riavviato il server backend (finestra nera) dopo le ultime modifiche.\n\nDettaglio: " + err.message,
                primaryAction: { label: 'Chiudi', onClick: () => setModalState(prev => ({ ...prev, isOpen: false })) }
              });
              throw err;
            }
          }}
        />
      )
    },
    {
      header: 'Azioni',
      accessor: 'azioni',
      render: (row) => (
        <div className="flex gap-2">
          <button 
            onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/pdf/elaborato-cliente?mese=${mese}&anno=${anno}&cliente_id=${row.idCliente}`)}
            className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
            title="Scarica PDF Rendiconto"
          >
            <Download className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setModalCalendario({ isOpen: true, clienteId: row.idCliente, nomeCliente: row.ragioneSociale })}
            className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
            title="Vedi Calendario Ore"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 flex items-center gap-3">
            Elaborato Mensile Clienti
            {isChiuso && (
              <span className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
                <Lock className="w-3.5 h-3.5" /> MESE CHIUSO ({new Date(dataChiusura).toLocaleDateString()})
              </span>
            )}
          </h1>
          <p className="text-slate-400 mt-1">Anteprima fatturazione clienti basata su ore lavorate e scadenze fisse</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-700">
          <select 
            value={mese} 
            onChange={(e) => setMese(Number(e.target.value))}
            className="p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {mesi.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
          <input 
            type="number" 
            value={anno} 
            onChange={(e) => setAnno(Number(e.target.value))}
            className="p-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-24"
          />

          {!isChiuso ? (
            <button 
              onClick={handleChiudiMese}
              disabled={isLoading || dati.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm ml-2 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" /> Chiudi Mese
            </button>
          ) : (
            <button 
              onClick={handleSbloccaMese}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-sm ml-2 border border-slate-600"
            >
              <Unlock className="w-4 h-4" /> Sblocca Mese
            </button>
          )}
          <button
            onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/pdf/stampa-elaborato-clienti?mese=${mese}&anno=${anno}`, '_blank')}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-medium shadow flex items-center gap-2 transition-colors"
            title="Stampa l'intero elaborato in PDF"
          >
            <Printer className="w-4 h-4" /> Stampa Elaborato
          </button>
        </div>
      </div>

      {/* Riepilogo Mensile */}
      {dati.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">Clienti</p>
            <p className="text-2xl font-bold text-slate-50">{dati.length}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">Ore Totali</p>
            <p className="text-2xl font-bold text-slate-50">
              {dati.reduce((sum, r) => sum + parseFloat(r.oreLavorate || 0), 0).toFixed(1)}
            </p>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-indigo-400 uppercase font-semibold tracking-wider mb-1">Totale Imponibile</p>
            <p className="text-2xl font-bold text-indigo-300">
              € {dati.reduce((sum, r) => sum + parseFloat(r.imponibile || 0), 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-emerald-400 uppercase font-semibold tracking-wider mb-1">Totale Tassato</p>
            <p className="text-2xl font-bold text-emerald-300">
              € {dati.reduce((sum, r) => sum + parseFloat(r.importoTotale || 0), 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-800/70 z-10 flex flex-col items-center justify-center text-amber-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
          </div>
        )}
        <DataTable 
          columns={columns} 
          data={dati} 
          searchPlaceholder="Cerca cliente..."
          pagination={false}
          nowrap={false}
          tableClassName="text-xs"
        />
      </div>

      <ModernModal 
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        content={modalState.content}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        primaryAction={modalState.primaryAction}
        secondaryAction={modalState.secondaryAction}
      />

      <CalendarioClienteModal
        isOpen={modalCalendario.isOpen}
        onClose={() => setModalCalendario({ ...modalCalendario, isOpen: false })}
        clienteId={modalCalendario.clienteId}
        nomeCliente={modalCalendario.nomeCliente}
        mese={mese}
        anno={anno}
      />
    </div>
  );
}
