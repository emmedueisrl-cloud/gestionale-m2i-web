import React, { useState, useEffect } from 'react';
import { Download, Loader2, Lock, Unlock, CheckCircle, Calendar, Search, Info, Printer } from 'lucide-react';
import { ottieniElaboratoClienti, chiudiMeseClienti, sbloccaMeseClienti, recuperaNoteElaborato, salvaNoteElaborato } from '../../api/elaborati';
import DataTable from '../../components/ui/DataTable';
import ModernModal from '../../components/ui/ModernModal';
import CalendarioClienteModal from '../../components/ui/CalendarioClienteModal';
import CellaNota from '../../components/ui/CellaNota';
import { workflowRequest, workflowPeriod, contabilitaPeriod } from '../../api/workflowElaborati';
import useElementHeight from '../../hooks/useElementHeight';
import { mesePredefinitoElaborati } from '../../utils/mesePredefinitoElaborati';

export default function ElaboratoClienti() {
  const [periodoIniziale] = useState(mesePredefinitoElaborati);
  const [mese, setMese] = useState(periodoIniziale.mese);
  const [anno, setAnno] = useState(periodoIniziale.anno);
  
  const [dati, setDati] = useState([]);
  const [isChiuso, setIsChiuso] = useState(false);
  const [dataChiusura, setDataChiusura] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [modalState, setModalState] = useState({ isOpen: false, type: '', title: '', message: '', primaryAction: null });
  const [modalCalendario, setModalCalendario] = useState({ isOpen: false, clienteId: null, nomeCliente: '' });
  const [note, setNote] = useState({}); // { [idCliente]: 'testo nota' }
  const [workflow, setWorkflow] = useState({ bloccati: [] });
  const [fatturato, setFatturato] = useState({});
  const [serviziExtra, setServiziExtra] = useState([]);
  const [stickyTopRef, stickyTopHeight] = useElementHeight();

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
      const [state, accounting, extras] = await Promise.all([
        workflowRequest(`${workflowPeriod('cliente', mese, anno)}/stato`),
        workflowRequest(contabilitaPeriod('cliente', mese, anno)),
        workflowRequest(`servizi-extra/${anno}/${mese}`)
      ]);
      setWorkflow(state);
      setServiziExtra(extras);
      setFatturato(Object.fromEntries(accounting.map(r => [r.idCliente, r])));
      const frozen = new Map(accounting.map(r => [r.idCliente, r]));
      setDati(prev => prev.map(r => {
        const contabilita = frozen.get(r.idCliente) || {};
        return {
          ...r,
          ...contabilita,
          importoRealmenteFatturato: Number(contabilita.importoRealmenteFatturato) || 0,
          rigaBloccata: Boolean(contabilita.rigaBloccata ?? r.rigaBloccata)
        };
      }));
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
      title: elaboratoVuoto ? 'Attenzione: elaborato clienti vuoto' : 'Conferma Chiusura Mese Clienti',
      content: (
        <div className="text-left space-y-4">
          {elaboratoVuoto && <p className="font-bold text-amber-300">Questo elaborato non contiene alcun cliente. Confermando, il mese sarà chiuso con zero righe. Verifica che sia davvero ciò che desideri.</p>}
          <p>
            <strong>Cosa significa chiudere un mese?</strong><br/>
            Chiudendo un mese, andrai a "congelare" e storicizzare tutti i calcoli di fatturazione per il mese selezionato.
          </p>
          <p>
            Da questo momento in poi, <strong>gli importi calcolati in questo mese rimarranno intatti</strong>, anche se in futuro modificherai la tariffa oraria di un cliente. Questo è essenziale per mantenere uno storico coerente con le fatture già emesse.
          </p>
          <p className="text-indigo-400">
            Potrai sbloccare il mese entro 30 giorni, finché nessuna fattura del periodo sarà stata inviata o registrata.
          </p>
        </div>
      ),
      primaryAction: {
        label: elaboratoVuoto ? 'Confermo: chiudi vuoto' : 'Conferma Chiusura',
        onClick: async () => {
          setModalState({ ...modalState, isOpen: false });
          setIsLoading(true);
          try {
            await chiudiMeseClienti(mese, anno, dati, elaboratoVuoto);
            await caricaElaborato();
          } catch (err) {
            console.error(err);
            setModalState({
              isOpen: true,
              type: 'error',
              title: 'Errore',
              content: err.message || 'Errore durante la chiusura del mese.',
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

  const toggleLock = async row => {
    if (row.isExtra) {
      try { await workflowRequest(`servizi-extra/${row.extraId}/${row.rigaBloccata ? 'sblocca' : 'blinda'}`, { method: 'POST', body: '{}' }); await caricaElaborato(); }
      catch (err) { window.alert(err.message); }
      return;
    }
    const action = row.rigaBloccata ? 'sblocca' : 'blinda';
    if (!window.confirm(`${row.rigaBloccata ? 'Sbloccare' : 'Blindare'} la riga di ${row.ragioneSociale} per ${mese}/${anno}? ${row.rigaBloccata ? 'La riga tornerà modificabile solo se la fattura non è stata inviata né registrata.' : 'Importi e note diventeranno disponibili alla contabilità.'}`)) return;
    try { await workflowRequest(`${workflowPeriod('cliente', mese, anno)}/righe/${encodeURIComponent(row.idCliente)}/${action}`, { method: 'POST', body: '{}' }); await caricaElaborato(); }
    catch (err) { window.alert(err.message); }
  };

  const valoreExtra = (extra, cliente) => {
    const imponibile = Number(extra.imponibile);
    const regime = String(cliente.tipoTassazione || 'IVA').trim().toUpperCase();
    if (regime === 'REVERSE CHARGE') return imponibile;
    if (regime === 'TRAT. ACC.' || regime === 'TRATTENUTA ACCONTO') return Math.round(imponibile * 100 * 1.18) / 100;
    return Math.round(imponibile * 100 * (1 + (Number(cliente.percentualeTassazione) || 22) / 100)) / 100;
  };
  const extraPerCliente = serviziExtra.reduce((map, extra) => {
    if (!map[extra.clienteId]) map[extra.clienteId] = [];
    map[extra.clienteId].push(extra);
    return map;
  }, {});
  for (const extras of Object.values(extraPerCliente)) extras.sort((a, b) =>
    Number(b.gruppoTipo === 'mensile') - Number(a.gruppoTipo === 'mensile') ||
    String(a.gruppoId).localeCompare(String(b.gruppoId)) || a.dataServizio.localeCompare(b.dataServizio));
  const clientiVisibili = [...dati];
  for (const [clienteId, extras] of Object.entries(extraPerCliente)) {
    if (!clientiVisibili.some(row => String(row.idCliente) === String(clienteId))) {
      const first = extras[0];
      const row = { idCliente: clienteId, ragioneSociale: first.clienteNome || 'Cliente con soli extra',
        soloExtra: true, isExtra: true, id: first.id, extraId: first.id, nomeExtra: first.nome,
        gruppoNome: first.gruppoNome, gruppoTipo: first.gruppoTipo, inviataAt: first.inviataAt,
        gruppoId: first.gruppoId, gruppoTotale: first.gruppoTotale,
        fatturaRegistrazioneId: first.fatturaRegistrazioneId, rigaBloccata: Boolean(first.bloccatoAt),
        oreLavorate: first.lavori.reduce((sum, work) => sum + work.giornate.reduce((part, day) => part + Number(day.ore), 0), 0),
        tariffaOraria: 0, baseImponibile: Number(first.imponibile), maggiorazioni: 0,
        sconti: 0, imponibile: Number(first.imponibile), tipoTassazione: first.tipoTassazione || 'IVA',
        percentualeTassazione: first.percentualeTassazione || 0 };
      row.importoTotale = valoreExtra(first, row);
      clientiVisibili.push(row);
    }
  }
  const righeExtra = row => (extraPerCliente[row.idCliente] || []).filter(extra => !row.soloExtra || extra.id !== row.extraId).map(extra => ({
    ...row, id: extra.id, isExtra: true, extraId: extra.id, nomeExtra: extra.nome,
    gruppoNome: extra.gruppoNome, gruppoTipo: extra.gruppoTipo, inviataAt: extra.inviataAt,
    gruppoId: extra.gruppoId, gruppoTotale: extra.gruppoTotale,
    fatturaRegistrazioneId: extra.fatturaRegistrazioneId, rigaBloccata: Boolean(extra.bloccatoAt),
    oreLavorate: extra.lavori.reduce((sum, work) => sum + work.giornate.reduce((part, day) => part + Number(day.ore), 0), 0),
    tariffaOraria: 0, baseImponibile: Number(extra.imponibile), maggiorazioni: 0, sconti: 0,
    imponibile: Number(extra.imponibile), importoTotale: valoreExtra(extra, row)
  }));

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
      cardLabel: 'Cliente',
      cardFullWidth: true,
      width: 190,
      render: (row) => (
        <div className="flex min-w-0 items-center justify-center gap-1 group">
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
      header: <>Ore<br />Erogate</>,
      accessor: 'oreLavorate',
      cardLabel: 'Ore erogate',
      width: 72,
      render: (row) => <span className="font-bold">{parseFloat(row.oreLavorate || 0).toFixed(2)}</span>
    },
    { 
      header: <>Tariffa<br />Oraria</>,
      accessor: 'tariffaOraria',
      cardLabel: 'Tariffa oraria',
      width: 88,
      render: (row) => row.isExtra ? '—' : `€ ${parseFloat(row.tariffaOraria || 0).toFixed(2)}`
    },
    { 
      header: <>Base<br />Imponibile</>,
      accessor: 'baseImponibile',
      cardLabel: 'Base imponibile',
      width: 89,
      render: (row) => row.isExtra ? <span title={row.nomeExtra}>€ {parseFloat(row.baseImponibile || 0).toFixed(2)}</span> : `€ ${parseFloat(row.baseImponibile || 0).toFixed(2)}`
    },
    { 
      header: <>Sconti/<br />Magg.</>,
      accessor: 'sconti', 
      cardLabel: 'Sconti/Magg.',
      width: 90,
      render: (row) => {
        if (row.isExtra) return <span className="text-slate-500">—</span>;
        const diff = parseFloat(row.maggiorazioni || 0) - parseFloat(row.sconti || 0);
        const notes = [row.noteMaggiorazioni, row.noteSconti].filter(Boolean).join(" | ");
        if (diff === 0 && !notes) return '€ 0.00';
        return (
          <div className="flex flex-wrap items-center gap-1">
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
      header: <>Totale<br />Imponibile</>,
      accessor: 'imponibile',
      cardLabel: 'Totale imponibile',
      width: 96,
      render: (row) => <span className="font-bold text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded">€ {parseFloat(row.imponibile || 0).toFixed(2)}</span>
    },
    {
      header: <>Regime<br />Fiscale</>,
      accessor: 'tipoTassazione',
      cardLabel: 'Regime fiscale',
      width: 71,
      render: (row) => {
        const tipo = (row.tipoTassazione || 'IVA').toUpperCase();
        const colorClass = tipo === 'REVERSE CHARGE' 
          ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
          : tipo.includes('TRAT') 
            ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
        const label = tipo === 'REVERSE CHARGE' ? 'REV' : tipo.includes('TRAT') ? 'TRAT' : 'IVA';
        return <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${colorClass}`}>{label}</span>;
      }
    },
    { 
      header: <>Totale<br />Tassato</>,
      accessor: 'importoTotale',
      cardLabel: 'Totale tassato',
      width: 90,
      render: (row) => <span className="font-bold text-slate-50">€ {parseFloat(row.importoTotale || 0).toFixed(2)}</span>
    },
    { header: <>Realmente<br />Fatturato</>, cardLabel: 'Realmente fatturato', accessor: 'importoRealmenteFatturato', width: 110, render: row => {
      if (row.isExtra) {
        if (row.gruppoTipo === 'mensile' && !row.soloExtra) return <span className="text-slate-500">↥ mensile</span>;
        const first = (extraPerCliente[row.idCliente] || []).find(extra => extra.gruppoId === row.gruppoId);
        if (first?.id !== row.extraId) return <span className="text-slate-500">↥ stessa fattura</span>;
        const invoice = fatturato[row.idCliente]?.fatture?.find(item => Number(item.id) === Number(row.fatturaRegistrazioneId));
        const amount = invoice?.importo ?? row.gruppoTotale;
        return amount != null ? <strong className="text-emerald-300">€ {Number(amount).toFixed(2)}</strong> : <span className="text-slate-500">—</span>;
      }
      const record = fatturato[row.idCliente];
      const separateIds = new Set((extraPerCliente[row.idCliente] || []).filter(extra => extra.gruppoTipo === 'extra').map(extra => Number(extra.fatturaRegistrazioneId)).filter(Boolean));
      const ordinaryAmount = (record?.fatture || []).filter(invoice => !separateIds.has(Number(invoice.id))).reduce((sum, invoice) => sum + Number(invoice.importo), 0);
      return ordinaryAmount ? <strong>€ {ordinaryAmount.toFixed(2)}</strong> : <span className="text-slate-500">—</span>;
    } },
    { 
      header: 'Note',
      accessor: 'note',
      cardLabel: 'Note',
      cardFullWidth: true,
      width: 135,
      sortable: false,
      render: (row) => (
        row.isExtra ? <span className="text-xs text-slate-300" title={row.nomeExtra}><strong className="block text-indigo-300">{row.nomeExtra}</strong>{row.gruppoTipo === 'mensile' ? 'Con mensile' : String(row.gruppoNome || '').trim().toLocaleLowerCase('it-IT') !== String(row.nomeExtra || '').trim().toLocaleLowerCase('it-IT') ? row.gruppoNome : null}</span> :
        <CellaNota
          testo={note[row.idCliente] ?? row.notaMensile ?? ''}
          notaFissa={row.notaFissa || ''}
          onShowFixedNote={() => showInfoModal(`Note fisse · ${row.ragioneSociale}`, <span className="block whitespace-pre-wrap break-words text-left">{row.notaFissa}</span>)}
          readOnly={isChiuso || row.rigaBloccata}
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
    { header: 'Blindatura', cardLabel: 'Blindatura', accessor: 'rigaBloccata', width: 93, render: row => {
      if (row.isExtra) {
        const colore = row.fatturaRegistrazioneId ? 'bg-emerald-700 text-white' : row.inviataAt ? 'bg-sky-700 text-white' : row.rigaBloccata ? 'bg-amber-400 text-slate-950' : 'bg-indigo-700 text-white';
        return <button type="button" className={`rounded px-2 py-1 text-xs font-semibold disabled:opacity-70 ${colore}`} disabled={Boolean(row.inviataAt || row.fatturaRegistrazioneId || isChiuso)} onClick={() => toggleLock(row)}>{row.fatturaRegistrazioneId ? 'Registrata' : row.inviataAt ? 'Inviata' : row.rigaBloccata ? 'Sblocca' : 'Blinda'}</button>;
      }
      if (isChiuso && !workflow.bloccati.includes(row.idCliente)) return <span className="text-emerald-300">Mese storico</span>;
      const registrata = Boolean(row.fatture?.length);
      const inviata = !registrata && Boolean(row.fatturaInviataAt);
      const elaborata = row.rigaBloccata && (registrata || inviata);
      const colore = registrata ? 'bg-emerald-700 text-white' : inviata ? 'bg-sky-700 text-white' : row.rigaBloccata ? 'bg-amber-700 text-white' : 'bg-indigo-700 text-white';
      return <button className={`rounded px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-80 ${colore}`}
        disabled={elaborata}
        title={elaborata ? `${registrata ? 'Fattura registrata' : 'Fattura inviata'}: sblindatura non consentita` : undefined}
        onClick={() => toggleLock(row)}>
        {registrata ? 'Registrata' : inviata ? 'Inviata' : row.rigaBloccata ? 'Sblocca riga' : 'Blinda riga'}
      </button>;
    } },
    {
      header: 'Azioni',
      accessor: 'azioni',
      cardLabel: 'Azioni',
      width: 72,
      render: (row) => (
        row.isExtra ? <span className="text-xs text-indigo-300">Extra</span> :
        <div className="flex gap-1">
          <button 
            onClick={() => window.open(`${import.meta.env.VITE_API_URL || ''}/api/contabilita/pdf/cliente/${anno}/${mese}/${encodeURIComponent(row.idCliente)}`)}
            className="p-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
            title="Scarica PDF Rendiconto"
          >
            <Download className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setModalCalendario({ isOpen: true, clienteId: row.idCliente, nomeCliente: row.ragioneSociale })}
            className="p-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
            title="Vedi Calendario Ore"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="elaborato-page min-w-0 flex flex-col">
      <div ref={stickyTopRef} className="elaborato-sticky-header sticky z-40 bg-slate-900 pb-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
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
              disabled={isLoading || Object.values(fatturato).some(row => row.fatturaInviataAt || row.fatture?.length)}
              title={Object.values(fatturato).some(row => row.fatturaInviataAt || row.fatture?.length) ? 'Una o più fatture sono state inviate o registrate' : undefined}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors shadow-sm ml-2 border border-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Unlock className="w-4 h-4" /> Sblocca Mese
            </button>
          )}
          <button
            onClick={() => window.open(`${import.meta.env.VITE_API_URL || ''}/api/pdf/stampa-elaborato-clienti?mese=${mese}&anno=${anno}&grafico=1`, '_blank')}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-medium shadow flex items-center gap-2 transition-colors"
            title="Stampa l'intero elaborato in PDF"
          >
            <Printer className="w-4 h-4" /> Stampa Elaborato
          </button>
        </div>
      </div>

      {/* Riepilogo Mensile */}
      {clientiVisibili.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">Clienti</p>
            <p className="text-2xl font-bold text-slate-50">{clientiVisibili.length}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">Ore Totali</p>
            <p className="text-2xl font-bold text-slate-50">
              {clientiVisibili.reduce((sum, r) => sum + parseFloat(r.oreLavorate || 0) + righeExtra(r).reduce((part, extra) => part + extra.oreLavorate, 0), 0).toFixed(1)}
            </p>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-indigo-400 uppercase font-semibold tracking-wider mb-1">Totale Imponibile</p>
            <p className="text-2xl font-bold text-indigo-300">
              € {clientiVisibili.reduce((sum, r) => sum + parseFloat(r.imponibile || 0) + righeExtra(r).reduce((part, extra) => part + extra.imponibile, 0), 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-emerald-400 uppercase font-semibold tracking-wider mb-1">Totale Tassato</p>
            <p className="text-2xl font-bold text-emerald-300">
              € {clientiVisibili.reduce((sum, r) => sum + parseFloat(r.importoTotale || 0) + righeExtra(r).reduce((part, extra) => part + extra.importoTotale, 0), 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}
      </div>

      <div className="min-w-0 bg-slate-800 rounded-xl shadow-sm border border-slate-700 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-800/70 z-10 flex flex-col items-center justify-center text-amber-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
          </div>
        )}
        <DataTable 
          columns={columns} 
          data={clientiVisibili}
          subRows={righeExtra}
          searchPlaceholder="Cerca cliente..."
          pagination={false}
          nowrap={false}
          tableClassName="text-xs"
          compact
          stickyHeader
          responsiveCards
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
