import { useCallback, useEffect, useState } from 'react';
import { contabilitaPeriod, workflowRequest } from '../../api/workflowElaborati';
import TabellaFatture from './TabellaFatture';
import TabellaPagamenti from './TabellaPagamenti';
import CaricaBusteElaborato from './CaricaBusteElaborato';
import PerUfficioPaghe from './PerUfficioPaghe';
import PerConsulente from './PerConsulente';
import { mesePredefinitoElaborati } from '../../utils/mesePredefinitoElaborati';

const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function ContabilitaElaborati({ tipo }) {
  const today = new Date();
  const [periodoIniziale] = useState(mesePredefinitoElaborati);
  const [mese, setMese] = useState(periodoIniziale.mese);
  const [anno, setAnno] = useState(periodoIniziale.anno);
  const [rows, setRows] = useState([]);
  const [buste, setBuste] = useState([]);
  const [mancanti, setMancanti] = useState(0);
  const [sezioneAttiva, setSezioneAttiva] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedConsultant, setSelectedConsultant] = useState(null);
  const [selectedCc, setSelectedCc] = useState(null);
  const [ccValue, setCcValue] = useState('');
  const [ccError, setCcError] = useState('');
  const [consultantNote, setConsultantNote] = useState('');
  const [consultantError, setConsultantError] = useState('');
  const [numero, setNumero] = useState('');
  const [dataFattura, setDataFattura] = useState(localDate(today));
  const [importo, setImporto] = useState('');
  const [allegato, setAllegato] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const base = import.meta.env.VITE_API_URL || '';
  const exportUrl = formato => `${base}/api/contabilita/tabella/${tipo}/${sezioneAttiva}/${anno}/${mese}.${formato}`;
  const showMessage = text => setMessage({ text, section: sezioneAttiva, period: `${anno}-${mese}`, tipo });
  const selectSection = index => { setSezioneAttiva(index); setMessage(null); setError(''); };

  const load = useCallback(async () => {
    setError('');
    try {
      const [accountingRows, missing, payroll] = await Promise.all([
        workflowRequest(contabilitaPeriod(tipo, mese, anno)),
        workflowRequest(`${contabilitaPeriod(tipo, mese, anno)}/mancanti`),
        tipo === 'dipendente' ? workflowRequest(`buste-paga/mese?mese=${mese}&anno=${anno}`) : Promise.resolve(null)
      ]);
      setRows(accountingRows);
      setMancanti(Number(missing.mancanti) || 0);
      setBuste(payroll?.buste || []);
    }
    catch (err) { setError(err.message); }
  }, [tipo, mese, anno]);
  useEffect(() => { load(); }, [load]);

  const openInvoice = row => {
    if (row.storicoPreesistente && !window.confirm('Questo elaborato era già chiuso prima del nuovo flusso. Verifica su Aruba e nella sezione Fatture che la fattura non sia già stata registrata. Vuoi proseguire?')) return;
    setSelected(row);
    setNumero('');
    setDataFattura(localDate(new Date()));
    setImporto(Math.max(0, Number(row.importoTotale || 0) - Number(row.importoRealmenteFatturato || 0)).toFixed(2));
    setAllegato(null);
  };

  const markInvoiceSent = async row => {
    setBusy(true); setError(''); setMessage(null);
    try {
      await workflowRequest('contabilita/fatture/inviata', { method: 'POST', body: JSON.stringify({ clienteId: row.idCliente, mese, anno }) });
      showMessage(`Fattura di ${row.ragioneSociale} segnata come inviata. Puoi ancora registrarla.`);
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const registerInvoice = async event => {
    event.preventDefault();
    const amount = Number(importo);
    if (!Number.isFinite(amount) || amount < 0) { setError('Importo non valido.'); return; }
    const proposed = Number(selected.importoTotale || 0) - Number(selected.importoRealmenteFatturato || 0);
    const difference = amount - proposed;
    if (!window.confirm(`Confermi la fattura Aruba n. ${numero} del ${dataFattura} per ${selected.ragioneSociale}?\nImporto previsto residuo: ${euro(proposed)}\nImporto registrato: ${euro(amount)}\nDifferenza: ${euro(difference)}\nRegistrazione: ${new Date().toLocaleString('it-IT')}`)) return;
    setBusy(true); setError(''); setMessage(null);
    try {
      const form = new FormData();
      form.append('clienteId', selected.idCliente);
      form.append('mese', String(mese)); form.append('anno', String(anno));
      form.append('numero', numero); form.append('dataFattura', dataFattura); form.append('importo', String(amount));
      if (selected.storicoPreesistente) form.append('confermaStorico', 'true');
      if (allegato) form.append('allegato', allegato);
      const result = await workflowRequest('contabilita/fatture', { method: 'POST', body: form });
      setSelected(null); showMessage(result.stato === 'da_verificare'
        ? 'Fattura registrata nell’elaborato, ma la fattura contabile esistente non coincide: controlla data e importo nel catalogo.'
        : result.stato === 'riconciliata' ? 'Fattura registrata e riconciliata con il documento contabile.'
          : 'Fattura registrata nell’elaborato; in attesa dell’importazione XML/CSV per i report contabili.'); await load();
    } catch (err) { setError(err.message); }
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

  const gruppi = tipo === 'cliente' ? [
    { titolo: 'Fatture da elaborare', etichetta: 'Da elaborare', contatore: 'fatture', elaborate: false, righe: rows.filter(row => !row.fatture?.length && !row.fatturaInviataAt), vuoto: 'Nessuna fattura da elaborare.' },
    { titolo: 'Fatture elaborate', etichetta: 'Elaborate', contatore: 'fatture', elaborate: true, righe: rows.filter(row => row.fatture?.length || row.fatturaInviataAt), vuoto: 'Nessuna fattura elaborata per questo mese.' }
  ] : [];
  const searchTerm = search.trim().toLocaleLowerCase('it-IT');
  const matchesClient = row => !searchTerm || [row.ragioneSociale, ...(row.fatture || []).map(fattura => fattura.numero)]
    .some(value => String(value || '').toLocaleLowerCase('it-IT').includes(searchTerm));
  const matchesEmployee = row => !searchTerm || String(row.cognomeNome || '').toLocaleLowerCase('it-IT').includes(searchTerm);
  const visibleGroup = tipo === 'cliente' ? {
    ...gruppi[sezioneAttiva],
    righe: gruppi[sezioneAttiva].righe.filter(matchesClient),
    vuoto: searchTerm ? 'Nessun cliente o numero fattura corrisponde alla ricerca.' : gruppi[sezioneAttiva].vuoto
  } : null;
  const visibleEmployees = rows.filter(matchesEmployee);
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
    <div className="flex justify-start"><input type="search" aria-label={tipo === 'cliente' ? 'Cerca cliente o numero fattura' : 'Cerca dipendente'} placeholder={tipo === 'cliente' ? 'Cerca cliente o fattura' : 'Cerca dipendente'} value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-500 focus:border-indigo-600 focus:outline-none sm:w-80" /></div>
    {tipo === 'cliente' ? <TabellaFatture key={sezioneAttiva} {...visibleGroup} base={base} onRegistra={openInvoice} onInviata={markInvoiceSent} busy={busy} euro={euro} /> :
      sezioneAttiva === 0 ? <TabellaPagamenti righe={visibleEmployees} vuoto={searchTerm ? 'Nessun dipendente corrisponde alla ricerca.' : 'Nessun dipendente blindato per questo mese.'} euro={euro} onNotaConsulente={row => { setSelectedConsultant(row); setConsultantNote(row.notaConsulente || ''); setConsultantError(''); }} onEliminaBusta={deletePayroll} onModificaCc={row => { setSelectedCc({ idDipendente: row.idDipendente, cognomeNome: row.cognomeNome, mese, anno }); setCcValue(row.cc == null ? '' : String(row.cc).replace('.', ',')); setCcError(''); }} busy={busy} /> :
        sezioneAttiva === 1 ? <PerConsulente key={`${anno}-${mese}`} righe={visibleEmployees} mese={mese} anno={anno} searchActive={Boolean(searchTerm)} /> : <PerUfficioPaghe key={`${anno}-${mese}`} buste={visiblePayroll} mese={mese} anno={anno} euro={euro} onChanged={load} searchActive={Boolean(searchTerm)} />}
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
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={registerInvoice} className="w-full max-w-lg space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl">
        <h2 className="text-lg font-bold">Fattura Aruba · {selected.ragioneSociale}</h2>
        <p className="text-sm text-slate-600">Totale tassato dell’elaborato: {euro(selected.importoTotale)}. Puoi correggere l’importo realmente fatturato.</p>
        <label className="block text-sm">Numero fattura Aruba<input required className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900" value={numero} onChange={e => setNumero(e.target.value)} /></label>
        <label className="block text-sm">Data fattura Aruba<input required type="date" className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900" value={dataFattura} onChange={e => setDataFattura(e.target.value)} /></label>
        <label className="block text-sm">Importo realmente fatturato (€)<input required type="number" step="0.01" min="0" className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900" value={importo} onChange={e => setImporto(e.target.value)} /></label>
        <label className="block text-sm">Allegato facoltativo (PDF/XML, massimo 10 MB)<input type="file" accept=".pdf,.xml,application/pdf,application/xml,text/xml" className="mt-1 w-full text-sm" onChange={e => setAllegato(e.target.files?.[0] || null)} /></label>
        <div className="flex gap-2"><button disabled={busy} type="submit" className="rounded bg-indigo-700 px-4 py-2 text-white hover:bg-indigo-800">Conferma e registra</button>
          <button type="button" className="rounded bg-slate-100 px-4 py-2 text-slate-800 hover:bg-slate-200" onClick={() => setSelected(null)}>Annulla</button></div>
      </form>
    </div>}
  </div>;
}
