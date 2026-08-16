import React, { useState, useEffect } from 'react';
import { Calculator, Download, Loader2, Lock, Unlock, CheckCircle, Info, Printer } from 'lucide-react';
import { ottieniElaboratoMensile, chiudiMeseDipendenti, sbloccaMeseDipendenti, recuperaNoteElaborato, salvaNoteElaborato } from '../../api/elaborati';
import DataTable from '../../components/ui/DataTable';
import ModernModal from '../../components/ui/ModernModal';
import CellaNota from '../../components/ui/CellaNota';

export default function ElaboratoDipendenti() {
  const dataOdierna = new Date();
  const [mese, setMese] = useState(dataOdierna.getMonth() === 0 ? 12 : dataOdierna.getMonth());
  const [anno, setAnno] = useState(dataOdierna.getMonth() === 0 ? dataOdierna.getFullYear() - 1 : dataOdierna.getFullYear());
  
  const [dati, setDati] = useState([]);
  const [isChiuso, setIsChiuso] = useState(false);
  const [dataChiusura, setDataChiusura] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [modalState, setModalState] = useState({ isOpen: false, type: '', title: '', message: '', primaryAction: null });
  const [note, setNote] = useState({});

  const mesi = [
    { val: 1, label: 'Gennaio' }, { val: 2, label: 'Febbraio' }, { val: 3, label: 'Marzo' },
    { val: 4, label: 'Aprile' }, { val: 5, label: 'Maggio' }, { val: 6, label: 'Giugno' },
    { val: 7, label: 'Luglio' }, { val: 8, label: 'Agosto' }, { val: 9, label: 'Settembre' },
    { val: 10, label: 'Ottobre' }, { val: 11, label: 'Novembre' }, { val: 12, label: 'Dicembre' }
  ];

  const caricaElaborato = async () => {
    setIsLoading(true);
    try {
      const resp = await ottieniElaboratoMensile(mese, anno);
      if (resp && typeof resp === 'object' && !Array.isArray(resp)) {
        setIsChiuso(resp.chiuso);
        setDataChiusura(resp.dataChiusura);
        setDati(resp.dati || []);
      } else {
        // Fallback for old API structure
        setIsChiuso(false);
        setDataChiusura(null);
        setDati(Array.isArray(resp) ? resp : []);
      }
      // Carica note
      const noteArr = await recuperaNoteElaborato('dipendente', mese, anno);
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
      title: 'Conferma Chiusura Mese',
      content: (
        <div className="text-left space-y-4">
          <p>
            <strong>Cosa significa chiudere un mese?</strong><br/>
            Chiudendo un mese, andrai a "congelare" e storicizzare tutti i calcoli di stipendio per il mese selezionato.
          </p>
          <p>
            Da questo momento in poi, <strong>gli importi calcolati in questo mese rimarranno intatti</strong>, anche se in futuro modificherai la paga oraria di un dipendente. Questo è essenziale per mantenere uno storico coerente con le buste paga e i pagamenti già effettuati.
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
            await chiudiMeseDipendenti(mese, anno, dati);
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
      title: 'Sblocca Mese',
      content: `ATTENZIONE: Sbloccando il mese, i dati storicizzati verranno ricalcolati usando le paghe orarie E I COSTI ATTUALI dei dipendenti. Se hai modificato le paghe nel frattempo, gli stipendi di questo mese cambieranno! (La fattura dei clienti non cambierà a meno che tu non sblocchi anche il loro mese). Continuare?`,
      primaryAction: {
        label: 'Sblocca e Ricalcola',
        onClick: async () => {
          setModalState({ ...modalState, isOpen: false });
          setIsLoading(true);
          try {
            await sbloccaMeseDipendenti(mese, anno);
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
    { header: 'ID', accessor: 'idDipendente' },
    { header: 'Dipendente', accessor: 'cognomeNome' },
    { 
      header: 'Ore Totali', 
      accessor: 'oreLavorate',
      render: (row) => <span className="font-bold">{parseFloat(row.oreLavorate || 0).toFixed(2)}</span>
    },
    { 
      header: 'Paga Oraria', 
      accessor: 'pagaOraria',
      render: (row) => (
        <div>
          <span>{row.tipoPaga === 'Mensile' ? '📅 Mensile' : '⏱ Oraria'}: </span>
          <span className="font-medium">€ {parseFloat(row.pagaOraria || 0).toFixed(2)}</span>
        </div>
      )
    },
    { 
      header: 'Netto per Lavorato', 
      accessor: 'pagaLavorato',
      render: (row) => `€ ${parseFloat(row.pagaLavorato || 0).toFixed(2)}`
    },
    { 
      header: 'Paga F.P.M.', 
      accessor: 'pagaFPM',
      render: (row) => (
        <div>
          <span className="font-medium">€ {parseFloat(row.pagaFPM || 0).toFixed(2)}</span>
          {row.dettaglioFPM && Object.keys(row.dettaglioFPM).length > 0 && (
            <div className="text-xs text-slate-400 mt-0.5 space-y-0.5">
              {Object.entries(row.dettaglioFPM)
                .filter(([causale]) => !causale.toLowerCase().includes('extra'))
                .map(([causale, ore]) => (
                  <div key={causale}>{causale}: {parseFloat(ore).toFixed(1)}h</div>
                ))}
            </div>
          )}
        </div>
      )
    },
    { 
      header: 'Magg./Rimb.', 
      accessor: 'maggiorazioni',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400 font-medium">+ €{parseFloat(row.maggiorazioni || 0).toFixed(2)}</span>
          {row.noteMaggiorazioni && row.maggiorazioni > 0 && (
            <Info 
              className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-emerald-300 transition-colors" 
              title="Clicca per leggere le note"
              onClick={() => showInfoModal('Note Maggiorazione', row.noteMaggiorazioni)}
            />
          )}
        </div>
      )
    },
    { 
      header: 'Trattenute', 
      accessor: 'detrazioni',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="text-red-400 font-medium">- €{parseFloat(row.detrazioni || 0).toFixed(2)}</span>
          {row.noteDetrazioni && row.detrazioni > 0 && (
            <Info 
              className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-red-300 transition-colors" 
              title="Clicca per leggere le note"
              onClick={() => showInfoModal('Note Trattenuta', row.noteDetrazioni)}
            />
          )}
        </div>
      )
    },
    { 
      header: 'Netto Spettante', 
      accessor: 'stipendioNetto',
      render: (row) => <span className="font-bold text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded">€ {parseFloat(row.stipendioNetto || 0).toFixed(2)}</span>
    },
    { 
      header: 'Note',
      accessor: 'note',
      sortable: false,
      render: (row) => (
        <CellaNota
          testo={note[row.idDipendente] || ''}
          onSave={async (testo) => {
            try {
              await salvaNoteElaborato('dipendente', row.idDipendente, mese, anno, testo);
              setNote(prev => ({ ...prev, [row.idDipendente]: testo }));
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
        <button 
          onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/pdf/elaborato-dipendente?mese=${mese}&anno=${anno}&dipendente_id=${row.idDipendente}`)}
          className="p-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
          title="Scarica Busta Paga (Prospetto)"
        >
          <Download className="w-4 h-4" />
        </button>
      )
    }
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 flex items-center gap-3">
            Elaborato Mensile Dipendenti
            {isChiuso && (
              <span className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
                <Lock className="w-3.5 h-3.5" /> MESE CHIUSO ({new Date(dataChiusura).toLocaleDateString()})
              </span>
            )}
          </h1>
          <p className="text-slate-400 mt-1">Calcolo stipendi in base alle presenze</p>
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
            onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/pdf/stampa-elaborato-dipendenti?mese=${mese}&anno=${anno}`, '_blank')}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-medium shadow flex items-center gap-2 transition-colors"
            title="Stampa l'intero elaborato in PDF"
          >
            <Printer className="w-4 h-4" /> Stampa Elaborato
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-800/70 z-10 flex flex-col items-center justify-center text-emerald-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
          </div>
        )}
        <DataTable 
          columns={columns} 
          data={dati} 
          searchPlaceholder="Cerca dipendente..."
          itemsPerPage={15}
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
    </div>
  );
}
