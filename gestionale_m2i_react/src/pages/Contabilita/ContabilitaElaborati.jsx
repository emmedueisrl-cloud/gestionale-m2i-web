import { useCallback, useEffect, useState } from 'react';
import { contabilitaPeriod, workflowRequest } from '../../api/workflowElaborati';
import TabellaFatture from './TabellaFatture';

const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function ContabilitaElaborati({ tipo }) {
  const today = new Date();
  const [mese, setMese] = useState(today.getMonth() + 1);
  const [anno, setAnno] = useState(today.getFullYear());
  const [rows, setRows] = useState([]);
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
    try { setRows(await workflowRequest(contabilitaPeriod(tipo, mese, anno))); }
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
    if (!window.confirm(`Confermi il pagamento a ${row.cognomeNome}?\nNetto spettante: ${euro(row.stipendioNetto)}\nData e ora: ${new Date().toLocaleString('it-IT')}`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await workflowRequest('contabilita/pagamenti', { method: 'POST', body: JSON.stringify({ dipendenteId: row.idDipendente, mese, anno, confermaStorico: Boolean(row.storicoPreesistente) }) });
      setMessage('Pagamento registrato.'); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const gruppi = tipo === 'cliente' ? [
    { titolo: 'Fatture da elaborare', righe: rows.filter(row => !row.fatture?.length && !row.fatturaInviataAt), vuoto: 'Nessuna fattura da elaborare.' },
    { titolo: 'Fatture elaborate', righe: rows.filter(row => row.fatture?.length || row.fatturaInviataAt), vuoto: 'Nessuna fattura elaborata per questo mese.' }
  ] : [];
  const totaleGruppo = gruppo => gruppo.righe.reduce((sum, row) => sum + (Number(row.importoTotale) || 0), 0);

  return <div className="space-y-5 bg-white text-slate-900">
    <div className="flex flex-wrap items-center gap-3">
      <div><h1 className="text-2xl font-bold">{tipo === 'cliente' ? 'Clienti · Fatture Aruba' : 'Dipendenti · Pagamenti'}</h1>
        <p className="text-sm text-slate-600">Sono visibili solo le righe blindate o appartenenti a un mese chiuso.</p></div>
      {tipo === 'cliente' && <div className="flex flex-wrap gap-2">
        <div className="min-w-[160px] rounded-lg border border-sky-300 bg-sky-100 px-3 py-2">
          <div className="text-xs font-bold uppercase text-sky-900">Da fatturare</div>
          <div className="text-lg font-bold text-slate-900">{euro(totaleGruppo(gruppi[0]))}</div>
          <div className="text-xs font-semibold text-sky-900">{gruppi[0].righe.length} fatture</div>
        </div>
        <div className="min-w-[160px] rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2">
          <div className="text-xs font-bold uppercase text-emerald-900">Fatturato</div>
          <div className="text-lg font-bold text-slate-900">{euro(totaleGruppo(gruppi[1]))}</div>
          <div className="text-xs font-semibold text-emerald-900">{gruppi[1].righe.length} fatture</div>
        </div>
      </div>}
      <div className="ml-auto flex flex-wrap gap-2">
        <select className="rounded border border-slate-300 bg-white p-2 text-slate-900" value={mese} onChange={e => setMese(Number(e.target.value))}>{months.map((name, i) => <option value={i + 1} key={name}>{name}</option>)}</select>
        <input className="w-24 rounded border border-slate-300 bg-white p-2 text-slate-900" type="number" min="2000" max="2100" value={anno} onChange={e => setAnno(Number(e.target.value))} />
        <button className="rounded bg-slate-100 px-3 text-slate-800 hover:bg-slate-200" onClick={load}>Aggiorna</button>
        <a className="rounded bg-indigo-700 px-3 py-2 text-white hover:bg-indigo-800" href={tipo === 'cliente' ? `${base}/api/contabilita/pdf/report-clienti/${anno}/${mese}` : `${base}/api/contabilita/pdf/${tipo}/${anno}/${mese}`} target="_blank" rel="noreferrer">Stampa {tipo === 'cliente' ? 'fatture' : 'elaborato'}</a>
      </div>
    </div>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-800">{error}</div>}
    {message && <div role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">{message}</div>}
    {!rows.length && tipo !== 'cliente' && <div className="rounded border border-slate-200 bg-white p-5 text-slate-600">Nessuna riga blindata per questo mese.</div>}
    {tipo === 'cliente' ? <>
      {gruppi.map(gruppo => <TabellaFatture key={gruppo.titolo} {...gruppo} base={base} onRegistra={openInvoice} onInviata={markInvoiceSent} busy={busy} euro={euro} />)}
    </> :
      <div className="space-y-3">{rows.map(row => <section key={row.idDipendente} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold">{row.cognomeNome}</h2>
        <a className="text-indigo-700 underline" href={`${base}/api/contabilita/pdf/dipendente/${anno}/${mese}/${encodeURIComponent(row.idDipendente)}`} target="_blank" rel="noreferrer">Stampa singola</a></div>
      {row.storicoPreesistente && <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-800">Mese storico precedente al nuovo flusso: lo stato di fatturazione o pagamento va verificato prima di registrarlo.</p>}
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6"><span>Ore: {Number(row.oreLavorate || 0).toFixed(1)}</span>
          <span>Paga {row.tipoPaga === 'Mensile' ? 'mensile' : 'oraria'}: {euro(row.pagaOraria)}</span><span>Lavorato: {euro(row.pagaLavorato)}</span><span>Ferie/permessi/malattia: {euro(row.pagaFPM)}</span>
          <span>Maggiorazioni: {euro(row.maggiorazioni)}</span><span>Detrazioni: {euro(row.detrazioni)}</span>
          <strong>Netto spettante: {euro(row.stipendioNetto)}</strong></div>
        <p className="mt-2 text-sm text-slate-600">IBAN: {row.iban || 'N/D'}</p>
        {(row.noteMaggiorazioni || row.noteDetrazioni) && <p className="mt-1 text-sm text-slate-600">Regolazioni: {[row.noteMaggiorazioni, row.noteDetrazioni].filter(Boolean).join(' | ')}</p>}
        {row.pagamento ? <p className="mt-3 text-emerald-700">Pagato: {euro(row.pagamento.importo)} · {new Date(row.pagamento.pagatoAt).toLocaleString('it-IT')}</p> : Number(row.stipendioNetto || 0) <= 0 ?
          <p className="mt-3 text-amber-700">Nessun importo positivo da pagare: verifica l’elaborato.</p> :
          <button className="mt-3 rounded bg-indigo-700 px-3 py-2 text-sm text-white hover:bg-indigo-800 disabled:opacity-50" disabled={busy} onClick={() => registerPayment(row)}>Conferma pagamento effettuato</button>}
      {(row.notaFissa || row.notaMensile) && <div className="mt-3 border-t border-slate-200 pt-2 text-sm text-slate-700">
        {row.notaFissa && <p>Nota fissa: {row.notaFissa}</p>}{row.notaMensile && <p>Nota del mese: {row.notaMensile}</p>}
      </div>}
      </section>)}</div>}
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
