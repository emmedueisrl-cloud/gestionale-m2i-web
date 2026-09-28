import { useCallback, useEffect, useState } from 'react';
import { contabilitaPeriod, workflowRequest } from '../../api/workflowElaborati';

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

  return <div className="space-y-5 text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">{tipo === 'cliente' ? 'Clienti · Fatture Aruba' : 'Dipendenti · Pagamenti'}</h1>
        <p className="text-sm text-slate-400">Sono visibili solo le righe blindate o appartenenti a un mese chiuso.</p></div>
      <div className="flex gap-2">
        <select className="rounded bg-slate-800 p-2" value={mese} onChange={e => setMese(Number(e.target.value))}>{months.map((name, i) => <option value={i + 1} key={name}>{name}</option>)}</select>
        <input className="w-24 rounded bg-slate-800 p-2" type="number" min="2000" max="2100" value={anno} onChange={e => setAnno(Number(e.target.value))} />
        <button className="rounded bg-slate-700 px-3" onClick={load}>Aggiorna</button>
        <a className="rounded bg-indigo-700 px-3 py-2" href={`${base}/api/contabilita/pdf/${tipo}/${anno}/${mese}`} target="_blank" rel="noreferrer">Stampa</a>
      </div>
    </div>
    {error && <div role="alert" className="rounded bg-red-900/40 p-3 text-red-200">{error}</div>}
    {message && <div role="status" className="rounded bg-emerald-900/40 p-3 text-emerald-200">{message}</div>}
    {!rows.length && <div className="rounded border border-slate-700 p-5 text-slate-400">Nessuna riga blindata per questo mese.</div>}
    <div className="space-y-3">{rows.map(row => <section key={tipo === 'cliente' ? row.idCliente : row.idDipendente} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold">{tipo === 'cliente' ? row.ragioneSociale : row.cognomeNome}</h2>
        <a className="text-indigo-300 underline" href={`${base}/api/contabilita/pdf/${tipo}/${anno}/${mese}/${encodeURIComponent(tipo === 'cliente' ? row.idCliente : row.idDipendente)}`} target="_blank" rel="noreferrer">Stampa singola</a></div>
      {row.storicoPreesistente && <p className="mt-2 rounded bg-amber-900/30 p-2 text-sm text-amber-200">Mese storico precedente al nuovo flusso: lo stato di fatturazione o pagamento va verificato prima di registrarlo.</p>}
      {tipo === 'cliente' ? <>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <span>Ore: {Number(row.oreLavorate || 0).toFixed(1)}</span><span>Tariffa: {euro(row.tariffaOraria)}</span>
          <span>Base: {euro(row.baseImponibile)}</span><span>Sconti: {euro(row.sconti)}</span><span>Maggiorazioni: {euro(row.maggiorazioni)}</span>
          <span>Imponibile: {euro(row.imponibile)}</span><span>Tassazione: {row.tipoTassazione || 'IVA'} {Number(row.percentualeTassazione || 0)}%</span>
          <span className="font-bold">Totale tassato: {euro(row.importoTotale)}</span>
        </div>
        {(row.noteMaggiorazioni || row.noteSconti) && <p className="mt-2 text-sm text-slate-400">Regolazioni: {[row.noteMaggiorazioni, row.noteSconti].filter(Boolean).join(' | ')}</p>}
        <div className="mt-3 text-sm">Realmente fatturato: <strong>{row.fatture.length ? euro(row.importoRealmenteFatturato) : 'Da fatturare'}</strong>
          {row.fatture.length > 0 && <span className="ml-2 text-amber-300">({row.differenza >= 0 ? '+' : '−'}{euro(Math.abs(row.differenza))})</span>}</div>
        <div className="mt-2 space-y-1 text-sm">{row.fatture.map(f => <div key={f.id}>Fattura {f.numero} · {f.data} · {euro(f.importo)} · registrata {new Date(f.registrataAt).toLocaleString('it-IT')} · {f.statoRiconciliazione === 'riconciliata' ? 'Riconciliata' : f.statoRiconciliazione === 'da_verificare' ? 'Da verificare' : 'In attesa XML/CSV'}
          {f.allegato && <a className="ml-2 text-indigo-300 underline" href={`${base}/api/contabilita/fatture/${f.id}/allegato`}>Allegato</a>}</div>)}</div>
        <button className="mt-3 rounded bg-indigo-600 px-3 py-2 text-sm" onClick={() => openInvoice(row)}>{row.fatture.length ? 'Aggiungi fattura' : 'Registra fattura'}</button>
      </> : <>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6"><span>Ore: {Number(row.oreLavorate || 0).toFixed(1)}</span>
          <span>Paga {row.tipoPaga === 'Mensile' ? 'mensile' : 'oraria'}: {euro(row.pagaOraria)}</span><span>Lavorato: {euro(row.pagaLavorato)}</span><span>Ferie/permessi/malattia: {euro(row.pagaFPM)}</span>
          <span>Maggiorazioni: {euro(row.maggiorazioni)}</span><span>Detrazioni: {euro(row.detrazioni)}</span>
          <strong>Netto spettante: {euro(row.stipendioNetto)}</strong></div>
        <p className="mt-2 text-sm text-slate-400">IBAN: {row.iban || 'N/D'}</p>
        {(row.noteMaggiorazioni || row.noteDetrazioni) && <p className="mt-1 text-sm text-slate-400">Regolazioni: {[row.noteMaggiorazioni, row.noteDetrazioni].filter(Boolean).join(' | ')}</p>}
        {row.pagamento ? <p className="mt-3 text-emerald-300">Pagato: {euro(row.pagamento.importo)} · {new Date(row.pagamento.pagatoAt).toLocaleString('it-IT')}</p> : Number(row.stipendioNetto || 0) <= 0 ?
          <p className="mt-3 text-amber-300">Nessun importo positivo da pagare: verifica l’elaborato.</p> :
          <button className="mt-3 rounded bg-indigo-600 px-3 py-2 text-sm disabled:opacity-50" disabled={busy} onClick={() => registerPayment(row)}>Conferma pagamento effettuato</button>}
      </>}
      {(row.notaFissa || row.notaMensile) && <div className="mt-3 border-t border-slate-700 pt-2 text-sm text-slate-300">
        {row.notaFissa && <p>Nota fissa: {row.notaFissa}</p>}{row.notaMensile && <p>Nota del mese: {row.notaMensile}</p>}
      </div>}
    </section>)}</div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={registerInvoice} className="w-full max-w-lg space-y-3 rounded-xl border border-slate-600 bg-slate-800 p-5 shadow-xl">
        <h2 className="text-lg font-bold">Fattura Aruba · {selected.ragioneSociale}</h2>
        <p className="text-sm text-slate-300">Totale tassato dell’elaborato: {euro(selected.importoTotale)}. Puoi correggere l’importo realmente fatturato.</p>
        <label className="block text-sm">Numero fattura Aruba<input required className="mt-1 w-full rounded bg-slate-900 p-2" value={numero} onChange={e => setNumero(e.target.value)} /></label>
        <label className="block text-sm">Data fattura Aruba<input required type="date" className="mt-1 w-full rounded bg-slate-900 p-2" value={dataFattura} onChange={e => setDataFattura(e.target.value)} /></label>
        <label className="block text-sm">Importo realmente fatturato (€)<input required type="number" step="0.01" min="0" className="mt-1 w-full rounded bg-slate-900 p-2" value={importo} onChange={e => setImporto(e.target.value)} /></label>
        <label className="block text-sm">Allegato facoltativo (PDF/XML, massimo 10 MB)<input type="file" accept=".pdf,.xml,application/pdf,application/xml,text/xml" className="mt-1 w-full text-sm" onChange={e => setAllegato(e.target.files?.[0] || null)} /></label>
        <div className="flex gap-2"><button disabled={busy} type="submit" className="rounded bg-indigo-600 px-4 py-2">Conferma e registra</button>
          <button type="button" className="rounded bg-slate-700 px-4 py-2" onClick={() => setSelected(null)}>Annulla</button></div>
      </form>
    </div>}
  </div>;
}
