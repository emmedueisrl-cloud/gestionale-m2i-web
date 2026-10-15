import { useCallback, useEffect, useState } from 'react';
import { contabilitaPeriod, workflowRequest } from '../../api/workflowElaborati';
import TabellaFatture from './TabellaFatture';
import TabellaPagamenti from './TabellaPagamenti';
import CaricaBusteElaborato from './CaricaBusteElaborato';
import PerUfficioPaghe from './PerUfficioPaghe';
import PerConsulente from './PerConsulente';
import ImportaFattureArubaZip from './ImportaFattureArubaZip';
import GestioneFattureExtra from './GestioneFattureExtra';
import { mesePredefinitoElaborati } from '../../utils/mesePredefinitoElaborati';

const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const rigaFatturazioneExtra = (group, accountingRows) => {
  const imponibile = Number(group.imponibileExtra) || 0;
  const totale = Number(group.totaleExtraPrevisto) || 0;
  const fattura = accountingRows.flatMap(row => row.fatture || [])
    .find(item => String(item.id) === String(group.fatturaRegistrazioneId));
  return { idCliente: group.clienteId, ragioneSociale: group.clienteNome,
    gruppoExtraId: group.id, gruppoExtraTipo: group.tipo, nomeServizioExtra: group.nomiServizi?.join(', ') || group.nome,
    descrizioneFattura: group.descrizioneFattura,
    imponibile, importoTassa: totale - imponibile, importoTotale: totale,
    tipoTassazione: group.tipoTassazione, tuttiBlindati: group.tuttiBlindati,
    notaMensile: group.nomiServizi?.join(', ') || group.nome,
    fatture: fattura ? [fattura] : [], importoRealmenteFatturato: fattura ? Number(fattura.importo) : 0,
    fatturaInviataAt: group.inviataAt, extraRegistrazioneId: group.fatturaRegistrazioneId };
};
const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export default function ContabilitaElaborati({ tipo }) {
  const [periodoIniziale] = useState(mesePredefinitoElaborati);
  const [mese, setMese] = useState(periodoIniziale.mese);
  const [anno, setAnno] = useState(periodoIniziale.anno);
  const [rows, setRows] = useState([]);
  const [gruppiExtra, setGruppiExtra] = useState([]);
  const [tuttiGruppiExtra, setTuttiGruppiExtra] = useState([]);
  const [buste, setBuste] = useState([]);
  const [mancanti, setMancanti] = useState(0);
  const [sezioneAttiva, setSezioneAttiva] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [selectedConsultant, setSelectedConsultant] = useState(null);
  const [selectedCc, setSelectedCc] = useState(null);
  const [ccValue, setCcValue] = useState('');
  const [ccError, setCcError] = useState('');
  const [consultantNote, setConsultantNote] = useState('');
  const [consultantError, setConsultantError] = useState('');
  const [zipFattura, setZipFattura] = useState(null);
  const [anteprimaFattura, setAnteprimaFattura] = useState(null);
  const [erroreFattura, setErroreFattura] = useState('');
  const [emailFattura, setEmailFattura] = useState(null);
  const [emailFatturaBusy, setEmailFatturaBusy] = useState(false);
  const [emailFatturaError, setEmailFatturaError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selectedExportKeys, setSelectedExportKeys] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDate, setExportDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [firstInvoiceNumber, setFirstInvoiceNumber] = useState('');
  const [exportPreview, setExportPreview] = useState(null);
  const [exportError, setExportError] = useState('');
  const base = import.meta.env.VITE_API_URL || '';
  const exportUrl = formato => `${base}/api/contabilita/tabella/${tipo}/${sezioneAttiva}/${anno}/${mese}.${formato}`;
  const showMessage = text => setMessage({ text, section: sezioneAttiva, period: `${anno}-${mese}`, tipo });
  const selectSection = index => { setSezioneAttiva(index); setMessage(null); setError(''); };

  const load = useCallback(async () => {
    setError('');
    try {
      const [accountingRows, missing, payroll, extraGroups] = await Promise.all([
        workflowRequest(contabilitaPeriod(tipo, mese, anno)),
        workflowRequest(`${contabilitaPeriod(tipo, mese, anno)}/mancanti`),
        tipo === 'dipendente' ? workflowRequest(`buste-paga/mese?mese=${mese}&anno=${anno}`) : Promise.resolve(null),
        tipo === 'cliente' ? workflowRequest(`servizi-extra/${anno}/${mese}/gruppi`) : Promise.resolve([])
      ]);
      setRows(accountingRows);
      setGruppiExtra(extraGroups.filter(group => group.servizi?.length));
      setTuttiGruppiExtra(extraGroups);
      setMancanti(Number(missing.mancanti) || 0);
      setBuste(payroll?.buste || []);
    }
    catch (err) { setError(err.message); }
  }, [tipo, mese, anno]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelectedExportKeys([]); setExportOpen(false); setExportPreview(null); }, [tipo, mese, anno]);

  const openInvoice = (row, registration = null) => {
    setSelected(row);
    setSelectedRegistration(registration);
    setZipFattura(null);
    setAnteprimaFattura(null);
    setErroreFattura('');
  };

  const openInvoiceEmail = async registrationId => {
    setEmailFatturaBusy(true); setEmailFatturaError(''); setError('');
    try {
      setEmailFattura(await workflowRequest(`contabilita/fatture/${registrationId}/email/anteprima`));
    } catch (err) { setError(err.message); }
    finally { setEmailFatturaBusy(false); }
  };

  const sendInvoiceEmail = async event => {
    event.preventDefault();
    if (!emailFattura) return;
    setEmailFatturaBusy(true); setEmailFatturaError('');
    try {
      await workflowRequest(`contabilita/fatture/${emailFattura.id}/email/invia`, {
        method: 'POST', body: JSON.stringify({ destinatario: emailFattura.destinatario, oggetto: emailFattura.oggetto, corpo: emailFattura.corpo })
      });
      showMessage(`Fattura ${emailFattura.numero} inviata via email a ${emailFattura.destinatario}.`);
      setEmailFattura(null);
    } catch (err) { setEmailFatturaError(err.message); }
    finally { setEmailFatturaBusy(false); }
  };

  const markInvoiceSent = async row => {
    setBusy(true); setError(''); setMessage(null);
    try {
      if (row.gruppoExtraId && row.gruppoExtraTipo === 'extra') {
        await workflowRequest(`servizi-extra/gruppi/${row.gruppoExtraId}/inviata`, { method: 'POST', body: '{}' });
      } else {
        await workflowRequest('contabilita/fatture/inviata', { method: 'POST', body: JSON.stringify({ clienteId: row.idCliente, mese, anno }) });
      }
      showMessage(`Fattura di ${row.ragioneSociale} segnata come inviata. Puoi ancora registrarla.`);
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const saveDescription = async (row, descrizione) => {
    setBusy(true); setError('');
    try {
      await workflowRequest('contabilita/fatture/descrizione', { method: 'PUT', body: JSON.stringify({
        tipo: row.gruppoExtraId ? 'extra' : 'cliente', soggettoId: row.gruppoExtraId || row.idCliente,
        mese, anno, descrizione
      }) });
      await load();
      showMessage('Descrizione della fattura salvata.');
    } catch (err) { setError(err.message); throw err; }
    finally { setBusy(false); }
  };

  const saveAdjustment = async (row, importo) => {
    setBusy(true); setError('');
    try {
      await workflowRequest('contabilita/fatture/rettifica', { method: 'PUT', body: JSON.stringify({
        clienteId: row.idCliente, mese, anno, importo
      }) });
      await load();
      showMessage('Rettifica della fattura salvata. Imponibile, imposta e totale aggiornati.');
    } catch (err) { setError(err.message); throw err; }
    finally { setBusy(false); }
  };

  const invoicePayload = () => {
    const form = new FormData();
    form.append('clienteId', selected.idCliente);
    form.append('mese', String(mese)); form.append('anno', String(anno));
    if (selectedRegistration) form.append('registrazioneId', String(selectedRegistration.id));
    if (selected.gruppoExtraId && selected.gruppoExtraTipo === 'extra') form.append('gruppoId', selected.gruppoExtraId);
    form.append('zip', zipFattura);
    return form;
  };

  const analyzeInvoice = async event => {
    event.preventDefault();
    if (!zipFattura) { setErroreFattura('Seleziona lo ZIP Aruba con XML e PDF della fattura.'); return; }
    setBusy(true); setErroreFattura(''); setAnteprimaFattura(null);
    try {
      setAnteprimaFattura(await workflowRequest('contabilita/fatture/importazione-singola/anteprima', {
        method: 'POST', body: invoicePayload()
      }));
    } catch (err) { setErroreFattura(err.message); }
    finally { setBusy(false); }
  };

  const registerInvoice = async () => {
    if (!anteprimaFattura || anteprimaFattura.blocchi.length) return;
    setBusy(true); setErroreFattura(''); setMessage(null);
    try {
      const form = invoicePayload();
      form.append('confermaAvvisi', 'true');
      const result = await workflowRequest('contabilita/fatture/importazione-singola/conferma', {
        method: 'POST', body: form
      });
      if (result.importate !== 1) throw new Error(result.risultati?.[0]?.errore || 'Fattura non registrata.');
      setSelected(null);
      await load();
      showMessage(`Fattura ${anteprimaFattura.numero} ${selectedRegistration ? 'sostituita' : 'registrata'} dallo ZIP Aruba.`);
    } catch (err) { setErroreFattura(err.message); }
    finally { setBusy(false); }
  };

  const saveConsultantNote = async event => {
    event.preventDefault();
    if (!selectedConsultant) return;
    setBusy(true); setConsultantError(''); setError(''); setMessage(null);
    try {
      await workflowRequest(`contabilita/dipendenti/${anno}/${mese}/${encodeURIComponent(selectedConsultant.idDipendente)}/nota-consulente`, {
        method: 'PUT', body: JSON.stringify({ testo: consultantNote })
      });
      setSelectedConsultant(null);
      await load();
      showMessage('Nota per consulente salvata.');
    } catch (err) { setConsultantError(err.message); }
    finally { setBusy(false); }
  };

  const saveCc = async event => {
    event.preventDefault();
    if (!selectedCc) return;
    setBusy(true); setCcError(''); setError(''); setMessage(null);
    try {
      await workflowRequest(`contabilita/dipendenti/${selectedCc.anno}/${selectedCc.mese}/${encodeURIComponent(selectedCc.idDipendente)}/cc`, {
        method: 'PUT', body: JSON.stringify({ importo: ccValue })
      });
      setSelectedCc(null);
      await load();
      showMessage('Valore CC salvato.');
    } catch (err) { setCcError(err.message); }
    finally { setBusy(false); }
  };

  const deletePayroll = async row => {
    const busta = buste.find(item => String(item.dipendente_id) === String(row.idDipendente));
    if (!busta) return;
    const warning = busta.email_inviata ? '\nLa busta risulta inviata: eliminarla toglierà anche la spunta Inviata.' : '';
    if (!window.confirm(`Eliminare la busta paga di ${row.cognomeNome} per ${months[mese - 1]} ${anno}?${warning}`)) return;
    setBusy(true); setError(''); setMessage(null);
    try {
      await workflowRequest(`buste-paga/${encodeURIComponent(busta.id)}`, { method: 'DELETE' });
      await load();
      showMessage(`Busta paga di ${row.cognomeNome} eliminata.`);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const registrazioniExtra = new Set(gruppiExtra.map(group => group.fatturaRegistrazioneId).filter(Boolean).map(String));
  const righeOrdinarie = rows.map(row => {
    const fatture = (row.fatture || []).filter(fattura => !registrazioniExtra.has(String(fattura.id)));
    const importoRealmenteFatturato = fatture.reduce((sum, fattura) => sum + Number(fattura.importo || 0), 0);
    return { ...row, fatture, importoRealmenteFatturato,
      differenza: fatture.length ? Number((importoRealmenteFatturato - Number(row.importoTotale || 0)).toFixed(2)) : null };
  }).filter(row => !(row.rigaExtra && !row.fatture.length && !row.documentiAruba?.length));
  const gruppi = tipo === 'cliente' ? [
    { titolo: 'Fatture da elaborare', etichetta: 'Da elaborare', contatore: 'righe', elaborate: false,
      righe: [...righeOrdinarie.filter(row => !row.fatture?.length && !row.documentiAruba?.length && !row.fatturaInviataAt),
        ...gruppiExtra.filter(group => !group.inviataAt && !group.fatturaRegistrazioneId).map(group => rigaFatturazioneExtra(group, rows))], vuoto: 'Nessuna fattura da elaborare.' },
    { titolo: 'Fatture elaborate', etichetta: 'Elaborate', contatore: 'fatture', elaborate: true,
      righe: [...righeOrdinarie.filter(row => row.fatture?.length || row.documentiAruba?.length || row.fatturaInviataAt),
        ...gruppiExtra.filter(group => group.inviataAt || group.fatturaRegistrazioneId).map(group => rigaFatturazioneExtra(group, rows))], vuoto: 'Nessuna fattura elaborata per questo mese.' }
  ] : [];
  const searchTerm = search.trim().toLocaleLowerCase('it-IT');
  const matchesClient = row => !searchTerm || [row.ragioneSociale, row.nomeServizioExtra, row.descrizioneFattura, ...(row.fatture || []).map(fattura => fattura.numero)]
    .some(value => String(value || '').toLocaleLowerCase('it-IT').includes(searchTerm));
  const matchesEmployee = row => !searchTerm || String(row.cognomeNome || '').toLocaleLowerCase('it-IT').includes(searchTerm);
  const visibleGroup = tipo === 'cliente' ? {
    ...gruppi[sezioneAttiva],
    righe: gruppi[sezioneAttiva].righe.filter(matchesClient),
    vuoto: searchTerm ? 'Nessun cliente o numero fattura corrisponde alla ricerca.' : gruppi[sezioneAttiva].vuoto
  } : null;
  const visibleEmployees = rows.filter(matchesEmployee);
  const exportKey = row => row.gruppoExtraId ? `extra:${row.gruppoExtraId}` : `cliente:${row.idCliente}`;
  const selectableForExport = row => !row.rigaExtra && !row.fatture?.length && !row.documentiAruba?.length &&
    !row.fatturaInviataAt && (!row.gruppoExtraId || row.gruppoExtraTipo === 'extra' && row.tuttiBlindati);
  const visibleExportKeys = tipo === 'cliente' && sezioneAttiva === 0
    ? visibleGroup.righe.filter(selectableForExport).map(exportKey) : [];
  const selectedCurrentKeys = selectedExportKeys.filter(key => gruppi[0]?.righe.some(row => exportKey(row) === key && selectableForExport(row)));
  const setExportSelection = (key, checked) => {
    setSelectedExportKeys(previous => checked ? [...new Set([...previous, key])] : previous.filter(item => item !== key));
    setExportPreview(null);
  };
  const exportPayload = () => ({ mese, anno, keys: selectedCurrentKeys, data: exportDate, primoNumero: firstInvoiceNumber.trim() });
  const previewExport = async event => {
    event.preventDefault(); setBusy(true); setExportError(''); setExportPreview(null);
    try { setExportPreview(await workflowRequest('contabilita/fatture/export-aruba/anteprima', {
      method: 'POST', body: JSON.stringify(exportPayload()) })); }
    catch (err) { setExportError(err.message); }
    finally { setBusy(false); }
  };
  const downloadExport = async () => {
    setBusy(true); setExportError('');
    try {
      const response = await fetch(`${base}/api/contabilita/fatture/export-aruba/scarica`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportPayload()) });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        if (result.errors) setExportPreview({ count: 0, errors: result.errors });
        throw new Error(result.error || `Download non riuscito (${response.status}).`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `Fatture_Aruba_${anno}_${String(mese).padStart(2, '0')}.zip`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setExportOpen(false);
      showMessage(`${selectedCurrentKeys.length} XML scaricati nello ZIP. Estrai i file XML e caricali su Aruba dopo aver verificato numeri e importi.`);
    } catch (err) { setExportError(err.message); }
    finally { setBusy(false); }
  };
  const visiblePayroll = buste.filter(busta => !searchTerm || `${busta.cognome || ''} ${busta.nome || ''}`.toLocaleLowerCase('it-IT').includes(searchTerm));
  const totaleGruppo = gruppo => gruppo.righe.reduce((sum, row) => sum + (Number(row.importoTotale) || 0), 0);
  const riepilogoPaghe = buste.reduce((totali, busta) => {
    const gruppo = busta.pagato_ufficio_at ? totali.pagati : totali.daPagare;
    gruppo.count += 1;
    gruppo.importo += Number(busta.importo_netto) || 0;
    return totali;
  }, { pagati: { count: 0, importo: 0 }, daPagare: { count: 0, importo: 0 } });
  const toolbar = <div className="ml-auto flex flex-wrap justify-end gap-2 text-[17px]">
    <select className="rounded border border-slate-300 bg-white p-[10px] text-slate-900" value={mese} onChange={e => setMese(Number(e.target.value))}>{months.map((name, i) => <option value={i + 1} key={name}>{name}</option>)}</select>
    <input className="w-[104px] rounded border border-slate-300 bg-white p-[10px] text-slate-900" type="number" min="2000" max="2100" value={anno} onChange={e => setAnno(Number(e.target.value))} />
    <button className="rounded bg-slate-100 px-4 text-slate-800 hover:bg-slate-200" onClick={load}>Aggiorna</button>
    <a className="rounded bg-indigo-700 px-4 py-[10px] text-white hover:bg-indigo-800" href={exportUrl('pdf')} target="_blank" rel="noreferrer">Stampa tabella</a>
    <a className="rounded bg-emerald-700 px-4 py-[10px] text-white hover:bg-emerald-800" href={exportUrl('xlsx')} download>Scarica Excel</a>
  </div>;

  return <div className="space-y-5 bg-white pt-8 text-slate-900">
    <div className={`grid ${tipo === 'dipendente' ? 'gap-5 items-start 2xl:grid-cols-[auto_minmax(500px,1fr)_auto]' : 'gap-x-5 items-start xl:grid-cols-[auto_minmax(0,1fr)]'}`}>
      <div className="shrink-0">
        <h1 className="whitespace-nowrap text-[29px] font-bold">{tipo === 'cliente' ? `Fatturazione · ${months[mese - 1]} ${anno}` : `Stipendi · ${months[mese - 1]} ${anno}`}</h1>
      </div>
      {tipo === 'cliente' ? <>
      {toolbar}
      <div aria-label="Sezione fatture" className="col-span-full flex flex-wrap items-stretch gap-5">
        <div aria-label={`Clienti non ancora blindati: ${mancanti}`} className="min-h-[100px] min-w-[176px] rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm">
          <div className="text-[13px] font-bold uppercase text-amber-900">Clienti mancanti</div>
          <div className="text-[22px] font-bold text-slate-900">{mancanti}</div>
        </div>
        <button type="button" aria-pressed={sezioneAttiva === 0} onClick={() => selectSection(0)} className={`min-h-[100px] min-w-[176px] rounded-xl border border-sky-300 bg-sky-100 px-4 py-3 text-left transition-colors hover:bg-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 ${sezioneAttiva === 0 ? 'ring-2 ring-sky-600 ring-offset-2' : ''}`}>
          <div className="text-[14px] font-bold uppercase text-sky-900">{gruppi[0].etichetta}</div>
          <div className="text-[22px] font-bold text-slate-900">{euro(totaleGruppo(gruppi[0]))}</div>
          <div className="text-[14px] font-semibold text-sky-900">{gruppi[0].righe.length} {gruppi[0].contatore}</div>
        </button>
        <button type="button" aria-pressed={sezioneAttiva === 1} onClick={() => selectSection(1)} className={`min-h-[100px] min-w-[176px] rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-left transition-colors hover:bg-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${sezioneAttiva === 1 ? 'ring-2 ring-emerald-600 ring-offset-2' : ''}`}>
          <div className="text-[14px] font-bold uppercase text-emerald-900">{gruppi[1].etichetta}</div>
          <div className="text-[22px] font-bold text-slate-900">{euro(totaleGruppo(gruppi[1]))}</div>
          <div className="text-[14px] font-semibold text-emerald-900">{gruppi[1].righe.length} {gruppi[1].contatore}</div>
        </button>
      </div></> : <div aria-label="Sezioni stipendi" className="flex min-w-0 flex-wrap justify-start gap-3">
        {['Da elaborato', 'Per consulente', 'Per ufficio paghe'].map((label, index) => <button
          key={label} type="button" aria-pressed={sezioneAttiva === index} onClick={() => selectSection(index)}
          className={`flex min-h-[72px] min-w-[160px] items-center justify-center rounded-xl border px-4 py-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 ${sezioneAttiva === index ? 'border-sky-400 bg-sky-100 ring-2 ring-sky-600 ring-offset-2' : 'border-slate-200 bg-slate-100 hover:bg-slate-200'}`}
        >
          <span className="text-[14px] font-bold uppercase text-slate-900">{label}</span>
        </button>)}
      </div>}
      {tipo === 'dipendente' && sezioneAttiva !== 2 && toolbar}
      {tipo === 'dipendente' && sezioneAttiva !== 1 &&
      <div className="col-span-full flex flex-wrap items-center justify-between gap-4">
      {tipo === 'dipendente' && sezioneAttiva === 0 && <div aria-label={`Dipendenti non ancora blindati: ${mancanti}`} className="min-w-[170px] rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 shadow-sm">
        <div className="text-[13px] font-bold uppercase text-amber-900">Dipendenti mancanti</div>
        <div className="text-[24px] font-bold leading-tight text-slate-900">{mancanti}</div>
      </div>}
      {tipo === 'dipendente' && sezioneAttiva === 2 && <div className="flex flex-wrap gap-3" aria-label="Riepilogo pagamenti del mese">
        {[
          { label: 'Pagati', count: riepilogoPaghe.pagati.count, importo: riepilogoPaghe.pagati.importo, color: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
          { label: 'Da pagare', count: riepilogoPaghe.daPagare.count, importo: riepilogoPaghe.daPagare.importo, color: 'border-amber-300 bg-amber-50 text-amber-900' },
          { label: 'Totale mese', count: null, importo: riepilogoPaghe.pagati.importo + riepilogoPaghe.daPagare.importo, color: 'border-indigo-300 bg-indigo-50 text-indigo-900' }
        ].map(item => <div key={item.label} className={`min-w-[185px] rounded-xl border px-4 py-3 ${item.color}`}>
          <div className="text-xs font-bold uppercase">{item.label}</div>
          {item.count !== null && <div className="text-sm font-semibold">{item.count} {item.count === 1 ? 'dipendente' : 'dipendenti'}</div>}
          <div className="text-xl font-bold text-slate-900">{euro(item.importo)}</div>
        </div>)}
      </div>}
      {tipo === 'dipendente' && sezioneAttiva === 0
        ? <CaricaBusteElaborato mese={mese} anno={anno} buste={buste} onChanged={load} />
        : toolbar}
      </div>}
    </div>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-800">{error}</div>}
    {message?.section === sezioneAttiva && message.period === `${anno}-${mese}` && message.tipo === tipo && <div role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">{message.text}</div>}
    <div className="flex flex-wrap items-center gap-3"><input type="search" aria-label={tipo === 'cliente' ? 'Cerca cliente o numero fattura' : 'Cerca dipendente'} placeholder={tipo === 'cliente' ? 'Cerca cliente o fattura' : 'Cerca dipendente'} value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-500 focus:border-indigo-600 focus:outline-none sm:w-80" />{tipo === 'cliente' && <><ImportaFattureArubaZip mese={mese} anno={anno} onChanged={async () => { setSezioneAttiva(1); await load(); }} /><GestioneFattureExtra mese={mese} anno={anno} gruppi={tuttiGruppiExtra} onChanged={load} /></>}</div>
    {tipo === 'cliente' && sezioneAttiva === 0 && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <button type="button" disabled={!visibleExportKeys.length || busy} onClick={() => setSelectedExportKeys(previous => [...new Set([...previous, ...visibleExportKeys])])} className="rounded bg-white px-3 py-2 font-semibold text-indigo-800 shadow-sm disabled:opacity-50">Seleziona tutti {searchTerm ? 'i risultati' : ''}</button>
      <button type="button" disabled={!selectedCurrentKeys.length || busy} onClick={() => setSelectedExportKeys([])} className="rounded bg-white px-3 py-2 font-semibold text-slate-700 shadow-sm disabled:opacity-50">Deseleziona tutti</button>
      <span className="text-sm font-semibold text-slate-700">{selectedCurrentKeys.length} selezionate</span>
      <button type="button" disabled={!selectedCurrentKeys.length || busy} onClick={() => { setExportPreview(null); setExportError(''); setExportOpen(true); }} className="ml-auto rounded bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">Scarica XML per Aruba</button>
    </div>}
    {tipo === 'cliente' ? <TabellaFatture key={sezioneAttiva} {...visibleGroup} base={base} onRegistra={openInvoice} onSostituisci={openInvoice} onInviata={markInvoiceSent} onEmail={openInvoiceEmail} onSaveDescription={saveDescription} onSaveAdjustment={saveAdjustment} selectedKeys={selectedCurrentKeys} onSelect={setExportSelection} busy={busy || emailFatturaBusy} euro={euro} /> :
      sezioneAttiva === 0 ? <TabellaPagamenti righe={visibleEmployees} vuoto={searchTerm ? 'Nessun dipendente corrisponde alla ricerca.' : 'Nessun dipendente blindato per questo mese.'} euro={euro} onNotaConsulente={row => { setSelectedConsultant(row); setConsultantNote(row.notaConsulente || ''); setConsultantError(''); }} onEliminaBusta={deletePayroll} onModificaCc={row => { setSelectedCc({ idDipendente: row.idDipendente, cognomeNome: row.cognomeNome, mese, anno }); setCcValue(row.cc == null ? '' : String(row.cc).replace('.', ',')); setCcError(''); }} busy={busy} /> :
        sezioneAttiva === 1 ? <PerConsulente key={`${anno}-${mese}`} righe={visibleEmployees} mese={mese} anno={anno} searchActive={Boolean(searchTerm)} /> : <PerUfficioPaghe key={`${anno}-${mese}`} buste={visiblePayroll} mese={mese} anno={anno} euro={euro} onChanged={load} searchActive={Boolean(searchTerm)} />}
    {exportOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={previewExport} className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-xl">
        <h2 className="text-xl font-bold">XML per Aruba · {selectedCurrentKeys.length} fatture</h2>
        <p className="text-sm text-slate-600">Inserisci la data e il primo numero definitivo. Le fatture successive avranno numeri consecutivi. Il download non segna le fatture come inviate.</p>
        <label className="block text-sm font-semibold">Data fattura<input required type="date" value={exportDate} onChange={event => { setExportDate(event.target.value); setExportPreview(null); }} className="mt-1 block w-full rounded border border-slate-300 p-2" /></label>
        <label className="block text-sm font-semibold">Primo numero fattura<input required type="text" maxLength={20} placeholder="FPR 618/26" value={firstInvoiceNumber} onChange={event => { setFirstInvoiceNumber(event.target.value); setExportPreview(null); }} className="mt-1 block w-full rounded border border-slate-300 p-2" /></label>
        <p className="text-xs text-slate-600">Lo ZIP contiene singoli XML: estraili e seleziona i file XML nella funzione “Carica fattura” di Aruba. Verifica la numerazione prima di inviare a SdI.</p>
        {exportError && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{exportError}</p>}
        {exportPreview && <div className="max-h-56 space-y-2 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          {exportPreview.issuerAddress && <p><strong>Sede fiscale M2I:</strong> {exportPreview.issuerAddress}</p>}
          {exportPreview.errors.length ? exportPreview.errors.map(item => <p key={item.key} className="text-red-800"><strong>{item.client}:</strong> {item.issues.join('; ')}</p>) : <p className="font-semibold text-emerald-800">{exportPreview.count} XML pronti. Controlla data e numeri prima del download.</p>}
          {exportPreview.invoices?.map(item => <p key={item.key}>{item.number} · {item.client}</p>)}
        </div>}
        <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy} className="rounded bg-slate-200 px-4 py-2 font-semibold disabled:opacity-50">Controlla XML</button>
          {exportPreview && !exportPreview.errors.length && <button type="button" disabled={busy} onClick={downloadExport} className="rounded bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Preparazione...' : 'Scarica ZIP XML'}</button>}
          <button type="button" disabled={busy} onClick={() => setExportOpen(false)} className="rounded border border-slate-300 px-4 py-2">Annulla</button></div>
      </form>
    </div>}
    {selectedConsultant && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={saveConsultantNote} className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl">
        <h2 className="text-lg font-semibold">Note per consulente · {selectedConsultant.cognomeNome}</h2>
        <p className="text-sm text-slate-600">{months[mese - 1]} {anno}</p>
        <label className="block text-sm font-medium" htmlFor="nota-consulente">Nota dedicata al consulente</label>
        <textarea id="nota-consulente" value={consultantNote} onChange={event => setConsultantNote(event.target.value)} maxLength={5000} rows={6} className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 focus:border-indigo-500 focus:outline-none" autoFocus />
        {consultantError && <p role="alert" className="text-sm text-red-700">{consultantError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setSelectedConsultant(null)} className="rounded-lg bg-slate-100 px-4 py-2 text-slate-800 hover:bg-slate-200 disabled:opacity-50">Annulla</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-indigo-700 px-4 py-2 text-white hover:bg-indigo-800 disabled:opacity-50">{busy ? 'Salvataggio...' : 'Salva nota'}</button>
        </div>
      </form>
    </div>}
    {selectedCc && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={saveCc} className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl">
        <h2 className="text-lg font-semibold">CC · {selectedCc.cognomeNome}</h2>
        <p className="text-sm text-slate-600">{months[selectedCc.mese - 1]} {selectedCc.anno}</p>
        <label className="block text-sm font-medium" htmlFor="valore-cc">Valore in euro</label>
        <input id="valore-cc" type="text" inputMode="decimal" autoFocus value={ccValue} onChange={event => setCcValue(event.target.value)} placeholder="Es. 100,00" className="w-full rounded-lg border border-slate-300 bg-white p-3 text-lg text-slate-900 focus:border-indigo-500 focus:outline-none" />
        <p className="text-xs text-slate-500">Lascia vuoto per rimuovere il valore.</p>
        {ccError && <p role="alert" className="text-sm text-red-700">{ccError}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setSelectedCc(null)} className="rounded-lg bg-slate-100 px-4 py-2 hover:bg-slate-200 disabled:opacity-50">Annulla</button><button type="submit" disabled={busy} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{busy ? 'Salvataggio...' : 'Salva CC'}</button></div>
      </form>
    </div>}
    {emailFattura && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !emailFatturaBusy) setEmailFattura(null); }}>
      <form onSubmit={sendInvoiceEmail} role="dialog" aria-modal="true" aria-label={`Invia fattura ${emailFattura.numero} via email`} className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-white p-6 text-slate-900 shadow-xl">
        <div><h2 className="text-xl font-bold">Invia fattura {emailFattura.numero}</h2><p className="mt-1 text-sm text-slate-600">Cliente: {emailFattura.cliente}</p></div>
        <label className="block text-sm font-semibold">Email ordinaria del cliente<input required type="email" autoFocus maxLength={254} value={emailFattura.destinatario} onChange={event => setEmailFattura(previous => ({ ...previous, destinatario: event.target.value }))} placeholder="nome@azienda.it" className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label>
        {!emailFattura.destinatario && <p className="text-sm text-amber-800">Nessuna email ordinaria nella scheda cliente: inserisci il destinatario. La PEC non viene usata.</p>}
        <label className="block text-sm font-semibold">Oggetto<input required maxLength={250} value={emailFattura.oggetto} onChange={event => setEmailFattura(previous => ({ ...previous, oggetto: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label>
        <label className="block text-sm font-semibold">Testo<textarea required maxLength={10000} rows={6} value={emailFattura.corpo} onChange={event => setEmailFattura(previous => ({ ...previous, corpo: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm"><strong>PDF allegato:</strong> {emailFattura.allegato}</div>
        {emailFatturaError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{emailFatturaError}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={emailFatturaBusy} onClick={() => setEmailFattura(null)} className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50">Annulla</button><button type="submit" disabled={emailFatturaBusy} className="rounded-lg bg-indigo-700 px-5 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{emailFatturaBusy ? 'Invio...' : 'Invia email con PDF'}</button></div>
      </form>
    </div>}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={analyzeInvoice} className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl">
        <h2 className="text-lg font-bold">{selectedRegistration ? 'Sostituisci fattura Aruba' : 'Fattura Aruba'} · {selected.ragioneSociale}</h2>
        {selectedRegistration && <p className="text-sm font-semibold text-amber-900">Fattura attuale: {selectedRegistration.numero} · {selectedRegistration.data} · {euro(selectedRegistration.importo)}</p>}
        <p className="text-sm text-slate-600">Seleziona lo ZIP Aruba della fattura: il gestionale leggerà l’XML e allegherà il PDF. {selectedRegistration && 'I documenti precedenti resteranno nello storico delle rettifiche.'}</p>
        <p className="text-sm font-semibold">{selected.gruppoExtraId ? 'Importo previsto per la fattura extra' : 'Importo previsto per il mese'}: {euro(Number(selected.importoTotale || 0) - Number(selected.importoRealmenteFatturato || 0) + Number(selectedRegistration?.importo || 0))}</p>
        <label className="block text-sm font-medium">ZIP Aruba (XML + PDF)<input required type="file" accept=".zip,application/zip" className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm" onChange={e => { setZipFattura(e.target.files?.[0] || null); setAnteprimaFattura(null); }} /></label>
        <p className="text-xs text-slate-500">Massimo 20 MB per archivio.</p>
        {erroreFattura && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{erroreFattura}</p>}
        {anteprimaFattura && <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-bold">Dati letti dall’XML</p>
          <p>Fattura {anteprimaFattura.numero || '—'} · {anteprimaFattura.data || '—'}</p>
          <p>Cliente XML: {anteprimaFattura.clienteXml || '—'}</p>
          {anteprimaFattura.abbinamentoFiscale && <p className="font-semibold text-emerald-800">Cliente verificato tramite {anteprimaFattura.abbinamentoFiscale}.</p>}
          <p>Imponibile {euro(anteprimaFattura.imponibile)} · IVA {euro(anteprimaFattura.iva)}</p>
          {anteprimaFattura.importoRitenuta > 0 && <p>Ritenuta {euro(anteprimaFattura.importoRitenuta)} · totale lordo {euro(anteprimaFattura.importoLordo)}</p>}
          <p className="font-bold">Importo da registrare: {euro(anteprimaFattura.importo)}</p>
          {anteprimaFattura.blocchi.map((blocco, index) => <p key={index} className="font-semibold text-red-800">{blocco}</p>)}
          {anteprimaFattura.avvisi.map((avviso, index) => <p key={index} className="font-semibold text-amber-800">{avviso}</p>)}
        </div>}
        <div className="flex flex-wrap gap-2"><button disabled={busy || !zipFattura} type="submit" className="rounded bg-indigo-700 px-4 py-2 text-white hover:bg-indigo-800 disabled:opacity-50">{busy ? 'Controllo...' : 'Leggi e controlla'}</button>
          {anteprimaFattura && !anteprimaFattura.blocchi.length && <button disabled={busy} type="button" onClick={registerInvoice} className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{busy ? 'Salvataggio...' : selectedRegistration ? 'Sostituisci fattura' : 'Registra fattura'}</button>}
          <button type="button" disabled={busy} className="rounded bg-slate-100 px-4 py-2 text-slate-800 hover:bg-slate-200" onClick={() => setSelected(null)}>Annulla</button></div>
      </form>
    </div>}
  </div>;
}
