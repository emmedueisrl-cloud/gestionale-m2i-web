import { useCallback, useEffect, useState } from 'react';
import { contabilitaPeriod, workflowRequest } from '../../api/workflowElaborati';
import TabellaFatture from './TabellaFatture';
import TabellaPagamenti from './TabellaPagamenti';
import { raggruppaPagamenti, totaleDaPagare, totalePagato } from './gruppiPagamenti';
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
  const [mancanti, setMancanti] = useState(0);
  const [sezioneAttiva, setSezioneAttiva] = useState(0);
  const [selected, setSelected] = useState(null);
  const [numero, setNumero] = useState('');
  const [dataFattura, setDataFattura] = useState(localDate(today));
  const [importo, setImporto] = useState('');
  const [allegato, setAllegato] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const base = import.meta.env.VITE_API_URL || '';

  const load = useCallback(async () => {
    setError('');
    try {
      const [accountingRows, missing] = await Promise.all([
        workflowRequest(contabilitaPeriod(tipo, mese, anno)),
        workflowRequest(`${contabilitaPeriod(tipo, mese, anno)}/mancanti`)
      ]);
      setRows(accountingRows);
      setMancanti(Number(missing.mancanti) || 0);
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
    setBusy(true); setError(''); setMessage('');
    try {
      await workflowRequest('contabilita/fatture/inviata', { method: 'POST', body: JSON.stringify({ clienteId: row.idCliente, mese, anno }) });
      setMessage(`Fattura di ${row.ragioneSociale} segnata come inviata. Puoi ancora registrarla.`);
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
    setBusy(true); setError(''); setMessage('');
    try {
      const form = new FormData();
      form.append('clienteId', selected.idCliente);
      form.append('mese', String(mese)); form.append('anno', String(anno));
      form.append('numero', numero); form.append('dataFattura', dataFattura); form.append('importo', String(amount));
      if (selected.storicoPreesistente) form.append('confermaStorico', 'true');
      if (allegato) form.append('allegato', allegato);
      const result = await workflowRequest('contabilita/fatture', { method: 'POST', body: form });
      setSelected(null); setMessage(result.stato === 'da_verificare'
        ? 'Fattura registrata nell’elaborato, ma la fattura contabile esistente non coincide: controlla data e importo nel catalogo.'
        : result.stato === 'riconciliata' ? 'Fattura registrata e riconciliata con il documento contabile.'
          : 'Fattura registrata nell’elaborato; in attesa dell’importazione XML/CSV per i report contabili.'); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const registerPayment = async row => {
    if (row.storicoPreesistente && !window.confirm('Questo elaborato era già chiuso prima del nuovo flusso. Verifica che il pagamento non sia già avvenuto. Vuoi proseguire?')) return;
    if (!window.confirm(`Confermi il pagamento a ${row.cognomeNome}?\nNetto da elaborato: ${euro(row.stipendioNetto)}\nNetto busta: ${row.nettoBusta == null ? 'Busta non caricata' : euro(row.nettoBusta)}\nData e ora: ${new Date().toLocaleString('it-IT')}`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await workflowRequest('contabilita/pagamenti', { method: 'POST', body: JSON.stringify({ dipendenteId: row.idDipendente, mese, anno, confermaStorico: Boolean(row.storicoPreesistente) }) });
      setMessage('Pagamento registrato.'); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const gruppiPagamenti = tipo === 'dipendente' ? raggruppaPagamenti(rows) : null;
  const gruppi = tipo === 'cliente' ? [
    { titolo: 'Fatture da elaborare', etichetta: 'Da elaborare', contatore: 'fatture', elaborate: false, righe: rows.filter(row => !row.fatture?.length && !row.fatturaInviataAt), vuoto: 'Nessuna fattura da elaborare.' },
    { titolo: 'Fatture elaborate', etichetta: 'Elaborate', contatore: 'fatture', elaborate: true, righe: rows.filter(row => row.fatture?.length || row.fatturaInviataAt), vuoto: 'Nessuna fattura elaborata per questo mese.' }
  ] : [
    { titolo: 'Dipendenti da pagare', etichetta: 'Da pagare', contatore: 'dipendenti', pagati: false, righe: gruppiPagamenti.daPagare, vuoto: 'Nessun dipendente da pagare.' },
    { titolo: 'Pagamenti effettuati', etichetta: 'Pagati', contatore: 'dipendenti', pagati: true, righe: gruppiPagamenti.pagati, vuoto: 'Nessun pagamento effettuato per questo mese.' }
  ];
  const totaleGruppo = gruppo => tipo === 'cliente'
    ? gruppo.righe.reduce((sum, row) => sum + (Number(row.importoTotale) || 0), 0)
    : gruppo.pagati ? totalePagato(gruppo.righe) : totaleDaPagare(gruppo.righe);

  return <div className="space-y-5 bg-white pt-8 text-slate-900">
    <div className="grid items-center gap-5 xl:grid-cols-[auto_minmax(372px,1fr)_auto]">
      <div className="relative shrink-0">
        <h1 className="whitespace-nowrap text-[29px] font-bold">{tipo === 'cliente' ? `Fatturazione · ${months[mese - 1]} ${anno}` : `Stipendi · ${months[mese - 1]} ${anno}`}</h1>
        <div aria-label={`${tipo === 'cliente' ? 'Clienti' : 'Dipendenti'} non ancora blindati: ${mancanti}`} className="pointer-events-none absolute left-0 top-[calc(100%+16px)] min-w-[170px] rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 shadow-sm">
          <div className="text-[13px] font-bold uppercase text-amber-900">{tipo === 'cliente' ? 'Clienti mancanti' : 'Dipendenti mancanti'}</div>
          <div className="text-[24px] font-bold leading-tight text-slate-900">{mancanti}</div>
        </div>
      </div>
      <div aria-label={tipo === 'cliente' ? 'Sezione fatture' : 'Sezione pagamenti'} className="flex min-w-[372px] flex-nowrap justify-center gap-5">
        <button type="button" aria-pressed={sezioneAttiva === 0} onClick={() => setSezioneAttiva(0)} className={`min-w-[176px] rounded-xl border border-sky-300 bg-sky-100 px-4 py-3 text-left transition-colors hover:bg-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 ${sezioneAttiva === 0 ? 'ring-2 ring-sky-600 ring-offset-2' : ''}`}>
          <div className="text-[14px] font-bold uppercase text-sky-900">{gruppi[0].etichetta}</div>
          <div className="text-[22px] font-bold text-slate-900">{euro(totaleGruppo(gruppi[0]))}</div>
          <div className="text-[14px] font-semibold text-sky-900">{gruppi[0].righe.length} {gruppi[0].contatore}</div>
        </button>
        <button type="button" aria-pressed={sezioneAttiva === 1} onClick={() => setSezioneAttiva(1)} className={`min-w-[176px] rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-left transition-colors hover:bg-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${sezioneAttiva === 1 ? 'ring-2 ring-emerald-600 ring-offset-2' : ''}`}>
          <div className="text-[14px] font-bold uppercase text-emerald-900">{gruppi[1].etichetta}</div>
          <div className="text-[22px] font-bold text-slate-900">{euro(totaleGruppo(gruppi[1]))}</div>
          <div className="text-[14px] font-semibold text-emerald-900">{gruppi[1].righe.length} {gruppi[1].contatore}</div>
        </button>
      </div>
      <div className="ml-auto flex shrink-0 flex-nowrap gap-2 text-[17px]">
        <select className="rounded border border-slate-300 bg-white p-[10px] text-slate-900" value={mese} onChange={e => setMese(Number(e.target.value))}>{months.map((name, i) => <option value={i + 1} key={name}>{name}</option>)}</select>
        <input className="w-[104px] rounded border border-slate-300 bg-white p-[10px] text-slate-900" type="number" min="2000" max="2100" value={anno} onChange={e => setAnno(Number(e.target.value))} />
        <button className="rounded bg-slate-100 px-4 text-slate-800 hover:bg-slate-200" onClick={load}>Aggiorna</button>
        <a className="rounded bg-indigo-700 px-4 py-[10px] text-white hover:bg-indigo-800" href={tipo === 'cliente' ? `${base}/api/contabilita/pdf/report-clienti/${anno}/${mese}` : `${base}/api/contabilita/pdf/report-dipendenti/${anno}/${mese}`} target="_blank" rel="noreferrer">Stampa elaborato</a>
      </div>
    </div>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-800">{error}</div>}
    {message && <div role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">{message}</div>}
    {tipo === 'cliente' ? <TabellaFatture key={sezioneAttiva} {...gruppi[sezioneAttiva]} base={base} onRegistra={openInvoice} onInviata={markInvoiceSent} busy={busy} euro={euro} /> :
      <TabellaPagamenti key={sezioneAttiva} {...gruppi[sezioneAttiva]} onPaga={registerPayment} busy={busy} euro={euro} />}
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
