import React, { useState, useEffect } from 'react';
import { Download, Loader2, Lock, Unlock, CheckCircle, Info, Printer } from 'lucide-react';
import { ottieniElaboratoMensile, chiudiMeseDipendenti, sbloccaMeseDipendenti, recuperaNoteElaborato, salvaNoteElaborato } from '../../api/elaborati';
import DataTable from '../../components/ui/DataTable';
import ModernModal from '../../components/ui/ModernModal';
import CellaNota from '../../components/ui/CellaNota';
import { workflowRequest, workflowPeriod, contabilitaPeriod } from '../../api/workflowElaborati';
import useElementHeight from '../../hooks/useElementHeight';

export default function ElaboratoDipendenti() {
  const dataOdierna = new Date();
  const [mese, setMese] = useState(dataOdierna.getMonth() + 1);
  const [anno, setAnno] = useState(dataOdierna.getFullYear());
  
  const [dati, setDati] = useState([]);
  const [isChiuso, setIsChiuso] = useState(false);
  const [dataChiusura, setDataChiusura] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [modalState, setModalState] = useState({ isOpen: false, type: '', title: '', message: '', primaryAction: null });
  const [note, setNote] = useState({});
  const [workflow, setWorkflow] = useState({ bloccati: [] });
  const [nettiBusta, setNettiBusta] = useState({});
  const [stickyTopRef, stickyTopHeight] = useElementHeight();

  const mesi = [
    { val: 1, label: 'Gennaio' }, { val: 2, label: 'Febbraio' }, { val: 3, label: 'Marzo' },
    { val: 4, label: 'Aprile' }, { val: 5, label: 'Maggio' }, { val: 6, label: 'Giugno' },
    { val: 7, label: 'Luglio' }, { val: 8, label: 'Agosto' }, { val: 9, label: 'Settembre' },
    { val: 10, label: 'Ottobre' }, { val: 11, label: 'Novembre' }, { val: 12, label: 'Dicembre' }
  ];

  const caricaElaborato = async () => {
    setIsLoading(true);
    setNettiBusta({});
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
      const [state, accounting, payroll] = await Promise.all([
        workflowRequest(`${workflowPeriod('dipendente', mese, anno)}/stato`),
        workflowRequest(contabilitaPeriod('dipendente', mese, anno)),
        workflowRequest(`buste-paga/mese?mese=${mese}&anno=${anno}`)
      ]);
      setWorkflow(state);
      setNettiBusta(Object.fromEntries((payroll.buste || []).map(busta => [busta.dipendente_id, Number(busta.importo_netto)])));
      const frozen = new Map(accounting.map(r => [r.idDipendente, r]));
      setDati(prev => prev.map(r => ({ ...r, ...(frozen.get(r.idDipendente) || {}) })));
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
    const elaboratoVuoto = dati.length === 0;
    setModalState({
      isOpen: true,
      type: 'warning',
      title: elaboratoVuoto ? 'Attenzione: elaborato vuoto' : 'Conferma Chiusura Mese',
      content: (
        <div className="text-left space-y-4">
          {elaboratoVuoto && <p className="font-bold text-amber-300">Questo elaborato non contiene alcun dipendente. Confermando, il mese sarà chiuso con zero righe. Verifica che sia davvero ciò che desideri.</p>}
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
        label: elaboratoVuoto ? 'Confermo: chiudi vuoto' : 'Conferma Chiusura',
        onClick: async () => {
          setModalState({ ...modalState, isOpen: false });
          setIsLoading(true);
          try {
            await chiudiMeseDipendenti(mese, anno, dati, elaboratoVuoto);
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

  const toggleLock = async row => {
    const action = row.rigaBloccata ? 'sblocca' : 'blinda';
    if (!window.confirm(`${row.rigaBloccata ? 'Sbloccare' : 'Blindare'} la riga di ${row.cognomeNome} per ${mese}/${anno}? ${row.rigaBloccata ? 'La riga tornerà modificabile solo se non è stata pagata.' : 'Importi e note diventeranno disponibili alla contabilità.'}`)) return;
    try { await workflowRequest(`${workflowPeriod('dipendente', mese, anno)}/righe/${encodeURIComponent(row.idDipendente)}/${action}`, { method: 'POST', body: '{}' }); await caricaElaborato(); }
    catch (err) { window.alert(err.message); }
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
    { header: 'ID', cardLabel: 'ID', accessor: 'idDipendente', width: 76,
      render: row => <span className="block truncate" title={row.idDipendente}>{row.idDipendente}</span>,
      cardRender: row => <span className="break-all">{row.idDipendente}</span> },
    { header: 'Dipendente', cardLabel: 'Dipendente', accessor: 'cognomeNome', width: 170,
      render: row => <span className="block truncate" title={row.cognomeNome}>{row.cognomeNome}</span>,
      cardRender: row => row.cognomeNome },
    { 
      header: <>Ore<br />Totali</>,
      accessor: 'oreLavorate',
      cardLabel: 'Ore totali',
      width: 70,
      render: (row) => <span className="font-bold">{parseFloat(row.oreLavorate || 0).toFixed(2)}</span>
    },
    { 
      header: <>Paga<br />Oraria</>,
      accessor: 'pagaOraria',
      cardLabel: 'Paga oraria',
      width: 130,
      render: (row) => (
        <div>
          <span>{row.tipoPaga === 'Mensile' ? '📅 Mensile' : '⏱ Oraria'}: </span>
          <span className="font-medium">€ {parseFloat(row.pagaOraria || 0).toFixed(2)}</span>
        </div>
      )
    },
    { 
      header: <>Netto per<br />Lavorato</>,
      accessor: 'pagaLavorato',
      cardLabel: 'Netto per lavorato',
      width: 110,
      render: (row) => `€ ${parseFloat(row.pagaLavorato || 0).toFixed(2)}`
    },
    { 
      header: <>Paga<br />F.P.M.</>,
      accessor: 'pagaFPM',
      cardLabel: 'Paga F.P.M.',
      width: 100,
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-medium">€ {parseFloat(row.pagaFPM || 0).toFixed(2)}</span>
          {row.dettaglioFPM && Object.keys(row.dettaglioFPM).length > 0 && (
            <button
              type="button"
              title="Leggi il dettaglio di ferie, permessi e malattia"
              onClick={() => showInfoModal('Dettaglio F.P.M.', <span className="whitespace-pre-wrap">{Object.entries(row.dettaglioFPM)
                .filter(([causale]) => !causale.toLowerCase().includes('extra'))
                .map(([causale, ore]) => `${causale}: ${parseFloat(ore).toFixed(1)} h`).join('\n')}</span>)}
              className="text-slate-400 hover:text-indigo-300"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    },
    { 
      header: <>Magg./<br />Rimb.</>,
      accessor: 'maggiorazioni',
      cardLabel: 'Maggiorazioni/Rimborsi',
      width: 105,
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
      cardLabel: 'Trattenute',
      width: 95,
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
      header: <>Netto<br />Spettante</>,
      accessor: 'stipendioNetto',
      cardLabel: 'Netto spettante',
      width: 105,
      render: (row) => <span className="font-bold text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded">€ {parseFloat(row.stipendioNetto || 0).toFixed(2)}</span>
    },
    { header: 'Netto busta', cardLabel: 'Netto busta', accessor: 'nettoBusta', width: 135, sortable: false, render: row => Object.hasOwn(nettiBusta, row.idDipendente)
      ? <span className="font-semibold text-emerald-300">€ {nettiBusta[row.idDipendente].toFixed(2)}</span>
      : <span className="text-slate-500">Busta non caricata</span> },
    { 
      header: 'Note',
      accessor: 'note',
      cardLabel: 'Note',
      cardFullWidth: true,
      width: 130,
      sortable: false,
      render: (row) => (
        <CellaNota
          testo={note[row.idDipendente] ?? row.notaMensile ?? ''}
          notaFissa={row.notaFissa || ''}
          onShowFixedNote={() => showInfoModal(`Note fisse · ${row.cognomeNome}`, <span className="block whitespace-pre-wrap break-words text-left">{row.notaFissa}</span>)}
          readOnly={isChiuso || row.rigaBloccata}
          uniformHeight
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
    { header: 'Blindatura', cardLabel: 'Blindatura', accessor: 'rigaBloccata', width: 95, sortable: false, render: row => isChiuso && !workflow.bloccati.includes(row.idDipendente) ? <span className="text-emerald-300">Mese storico</span> :
      <button className={`rounded px-2 py-1 text-xs ${row.rigaBloccata ? 'bg-amber-700' : 'bg-indigo-700'}`} onClick={() => toggleLock(row)}>
        {row.rigaBloccata ? 'Sblocca riga' : 'Blinda riga'}
      </button> },
    {
      header: 'Azioni',
      accessor: 'azioni',
      cardLabel: 'Azioni',
      width: 72,
      sortable: false,
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => window.open(`${import.meta.env.VITE_API_URL || ''}/api/pdf/stampa-elaborato-dipendenti?mese=${mese}&anno=${anno}&dipendente_id=${encodeURIComponent(row.idDipendente)}`, '_blank', 'noopener,noreferrer')}
            className="p-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
            title="Stampa questa riga (apre il PDF)"
            aria-label={`Stampa la riga di ${row.cognomeNome}`}
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => window.open(`${import.meta.env.VITE_API_URL || ''}/api/contabilita/pdf/dipendente/${anno}/${mese}/${encodeURIComponent(row.idDipendente)}`)}
            className="p-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
            title="Scarica Busta Paga (Prospetto)"
            aria-label={`Scarica il prospetto di ${row.cognomeNome}`}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="elaborato-page min-w-0 flex flex-col">
      <div ref={stickyTopRef} className="elaborato-sticky-header sticky z-40 bg-slate-900 pb-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 flex flex-wrap items-center gap-3">
            Elaborato Mensile Dipendenti
            {isChiuso && (
              <span className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
                <Lock className="w-3.5 h-3.5" /> MESE CHIUSO ({new Date(dataChiusura).toLocaleDateString()})
              </span>
            )}
          </h1>
          <p className="text-slate-400 mt-1">Calcolo stipendi in base alle presenze</p>
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-3 bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-700">
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
              disabled={isLoading}
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
            onClick={() => window.open(`${import.meta.env.VITE_API_URL || ''}/api/pdf/stampa-elaborato-dipendenti?mese=${mese}&anno=${anno}&grafico=1`, '_blank', 'noopener,noreferrer')}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-medium shadow flex items-center gap-2 transition-colors"
            title="Stampa l'intero elaborato con la nuova grafica PDF"
          >
            <Printer className="w-4 h-4" /> Stampa Elaborato
          </button>
        </div>
      </div>
      </div>

      <div className="min-w-0 bg-slate-800 rounded-xl shadow-sm border border-slate-700 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-800/70 z-10 flex flex-col items-center justify-center text-emerald-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
          </div>
        )}
        <DataTable 
          columns={columns} 
          data={dati} 
          searchPlaceholder="Cerca dipendente..."
          pagination={false}
          nowrap={false}
          tableClassName="text-xs"
          compact
          stickyHeader
          responsiveCards
          uniformRows
          continuous
          stickyTopOffset={`calc(${stickyTopHeight}px - var(--elaborato-sticky-inset))`}
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
