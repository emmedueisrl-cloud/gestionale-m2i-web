import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { workflowRequest } from '../../api/workflowElaborati';
import { leggiBonifici, normalizza, suggerisciFatture } from './riconciliaBonifici';
import UnilavReview from './UnilavReview';
import VisuraReview from './VisuraReview';

const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const cents = value => Math.round(Number(value || 0) * 100);
const dateIt = value => value ? `${value.slice(8)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '—';
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });

function Bonifico({ bonifico, fatture, onRegistered }) {
  const { open, suggestions, proposed, proposedGroup } = useMemo(() => suggerisciFatture(bonifico, fatture), [bonifico, fatture]);
  const [selected, setSelected] = useState({});
  const [date, setDate] = useState(bonifico.date);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requestKey] = useState(() => bonifico.disposition ? `bank-${bonifico.disposition}` : crypto.randomUUID());
  useEffect(() => {
    const suggested = proposedGroup.length ? proposedGroup : proposed ? [proposed] : [];
    if (suggested.length && !success) setSelected(current => Object.keys(current).length ? current :
      Object.fromEntries(suggested.map(invoice => [invoice.id, proposedGroup.length ? invoice.residuo :
        Math.min(cents(invoice.residuo), cents(bonifico.amount)) / 100])));
  }, [proposed, proposedGroup, success, bonifico.amount]);
  const chosen = open.filter(invoice => Object.hasOwn(selected, invoice.id));
  const allocated = Object.values(selected).reduce((sum, amount) => sum + cents(amount), 0);
  const sameClient = new Set(chosen.map(invoice => String(invoice.clienteId))).size <= 1;
  const amountsValid = chosen.every(invoice => cents(selected[invoice.id]) > 0 && cents(selected[invoice.id]) <= cents(invoice.residuo));
  const canSubmit = !bonifico.error && chosen.length > 0 && sameClient && amountsValid && allocated === cents(bonifico.amount) && date && date <= today();
  const candidates = (showAll ? open : suggestions).filter(invoice => !search || normalizza(`${invoice.cliente} ${invoice.numero} ${invoice.descrizione || ''}`).includes(normalizza(search)));
  const toggle = invoice => {
    setError('');
    setSelected(current => {
      const next = { ...current };
      if (Object.hasOwn(next, invoice.id)) delete next[invoice.id];
      else next[invoice.id] = Math.max(0, Math.min(cents(invoice.residuo), cents(bonifico.amount) - Object.values(current).reduce((sum, value) => sum + cents(value), 0))) / 100;
      return next;
    });
  };
  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true); setError('');
    try {
      const current = await workflowRequest('contabilita/incassi-insoluti');
      for (const invoice of chosen) {
        const fresh = current.fatture.find(row => String(row.id) === String(invoice.id));
        if (!fresh || !fresh.gestibile || fresh.incongruenza || cents(fresh.residuo) < cents(selected[invoice.id])) throw new Error('Una fattura è cambiata. Rianalizza il messaggio prima di registrare.');
      }
      const result = await workflowRequest('contabilita/incassi-insoluti/incassi-batch', {
        method: 'POST', body: JSON.stringify({
          data: date, totale: Number(bonifico.amount).toFixed(2), incassi: chosen.map(invoice => ({ fatturaId: invoice.id, importo: Number(selected[invoice.id]).toFixed(2) })),
          nota: `Azioni veloci · bonifico da ${bonifico.payer || 'mittente non indicato'}`, idempotencyKey: requestKey
        })
      });
      setSuccess(result.alreadyRegistered ? 'Questo pagamento era già stato registrato.' : `Registrato ${euro(bonifico.amount)} su ${chosen.length} ${chosen.length === 1 ? 'fattura' : 'fatture'} alla data ${dateIt(date)}.`);
      onRegistered();
    } catch (err) { setError(err.message || 'Registrazione non riuscita.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-slate-700 bg-slate-800 p-5 text-slate-100">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Bonifico di {euro(bonifico.amount)}</h2>
      <p className="text-sm text-slate-300">Mittente: {bonifico.payer || 'non riconosciuto'}{bonifico.periodo && ` · Periodo: ${bonifico.periodo}`}{bonifico.numeri?.length > 0 && ` · Fatture indicate: ${bonifico.numeri.join(', ')}`}</p>
      {bonifico.description && <p className="mt-1 text-sm text-slate-400">{bonifico.description}</p>}</div>
      {(proposed || proposedGroup.length > 0) && <span className="rounded-full bg-emerald-900 px-3 py-1 text-xs font-semibold text-emerald-200">Corrispondenza proposta</span>}</div>
    {bonifico.error && <p role="alert" className="mt-3 text-amber-300">{bonifico.error}</p>}
    {bonifico.dateInferred && <p className="mt-3 rounded-lg bg-amber-950/50 p-3 text-sm text-amber-200">Il messaggio dice “OGGI”: ho impostato la data odierna. Se il messaggio è di un altro giorno, correggi la data prima di confermare.</p>}
    {!bonifico.payer && <p className="mt-3 text-sm text-amber-200">Mittente non trovato: scegli manualmente la fattura.</p>}
    {bonifico.payer && !proposed && !proposedGroup.length && <p className="mt-3 text-sm text-amber-200">Nessuna corrispondenza univoca tra cliente, fattura e importo. Verifica i suggerimenti.</p>}
    {suggestions[0]?.match.clientScore >= 0.65 && cents(suggestions[0].residuo) !== cents(bonifico.amount) && <p className="mt-2 text-sm text-amber-200">Cliente probabile: {suggestions[0].cliente}. Il residuo della prima fattura ({euro(suggestions[0].residuo)}) è diverso dal bonifico. Puoi scegliere più fatture o registrare un acconto.</p>}
    <div className="mt-5 flex flex-wrap gap-3"><label className="text-sm font-semibold">Data incasso
      <input required type="date" value={date} max={today()} onChange={event => setDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-500 bg-slate-900 px-3 py-2 text-white" /></label>
      <label className="min-w-56 flex-1 text-sm font-semibold">Cerca fattura o cliente
      <input type="search" value={search} onChange={event => { setSearch(event.target.value); if (event.target.value) setShowAll(true); }} placeholder="Nome, numero o descrizione" className="mt-1 block w-full rounded-lg border border-slate-500 bg-slate-900 px-3 py-2 text-white" /></label></div>
    <div className="mt-5 flex items-center justify-between gap-3"><h3 className="font-bold">Fatture non pagate</h3>
      <button type="button" onClick={() => setShowAll(value => !value)} className="text-sm font-semibold text-indigo-300 underline">{showAll ? 'Mostra suggerimenti' : `Mostra tutte (${open.length})`}</button></div>
    <div className="mt-2 space-y-2">
      {!candidates.length && <p className="rounded-lg bg-slate-900 p-3 text-sm text-slate-300">Nessuna fattura aperta corrisponde alla ricerca.</p>}
      {candidates.map(invoice => <div key={invoice.id} className="rounded-lg border border-slate-600 bg-slate-900/70 p-3">
        <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={Object.hasOwn(selected, invoice.id)} onChange={() => toggle(invoice)} disabled={Boolean(success)} className="mt-1 h-4 w-4 accent-indigo-500" />
          <span className="flex-1 text-sm"><strong>{invoice.cliente}</strong> · {invoice.numero ? `Fattura ${invoice.numero}` : 'Fattura inviata'} · {invoice.periodo || 'periodo non indicato'}<br />
            <span className="text-slate-300">Residuo {euro(invoice.residuo)} · Totale {euro(invoice.totale)}{invoice.descrizione && ` · ${invoice.descrizione}`}</span><br />
            <span className="text-indigo-300">{[invoice.match?.numberMatch && 'numero coincidente', invoice.match?.periodMatch && 'mese coincidente', invoice.match?.amountMatch && 'importo coincidente', invoice.match?.clientScore >= 0.65 && 'cliente simile'].filter(Boolean).join(' · ') || 'Da verificare manualmente'}</span>
          </span></label>
        {Object.hasOwn(selected, invoice.id) && <label className="mt-3 block pl-7 text-sm">Importo da assegnare (€)
          <input type="number" min="0.01" max={invoice.residuo} step="0.01" value={selected[invoice.id]} disabled={Boolean(success)} onChange={event => setSelected(current => ({ ...current, [invoice.id]: event.target.value }))} className="ml-2 w-32 rounded border border-slate-500 bg-slate-800 px-2 py-1 text-white" /></label>}
      </div>)}</div>
    <div className="mt-5 rounded-lg bg-slate-900 p-4 text-sm">Bonifico: <strong>{euro(bonifico.amount)}</strong> · Assegnato: <strong>{euro(allocated / 100)}</strong> · Differenza: <strong>{euro((cents(bonifico.amount) - allocated) / 100)}</strong>
      {!sameClient && <p className="mt-2 text-amber-300">Seleziona fatture di un solo cliente.</p>}
      {chosen.length > 0 && !amountsValid && <p className="mt-2 text-amber-300">Ogni importo deve essere positivo e non superare il residuo.</p>}</div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
    {success && <p role="status" className="mt-3 rounded-lg bg-emerald-950 p-3 text-emerald-200">{success}</p>}
    {!success && <button type="button" disabled={!canSubmit || busy} onClick={submit} className="mt-4 rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{busy ? 'Registrazione...' : 'Conferma e registra il pagamento'}</button>}
  </section>;
}

export default function AzioniVeloci() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('tipo') === 'visura' ? 'file' : 'testo');
  const [pdfKind, setPdfKind] = useState(searchParams.get('tipo') === 'visura' ? 'visura' : 'unilav');
  const [text, setText] = useState('');
  const [fileText, setFileText] = useState('');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [unilavPreview, setUnilavPreview] = useState(null);
  const [visuraPreview, setVisuraPreview] = useState(null);
  const [messages, setMessages] = useState([]);
  const [fatture, setFatture] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [version, setVersion] = useState(0);
  const unilavReviewRef = useRef(null);
  const closingResultsRef = useRef(false);
  const [closingResults, setClosingResults] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const closeResults = useCallback(async () => {
    if (closingResultsRef.current) return;
    closingResultsRef.current = true;
    if (unilavPreview) {
      setClosingResults(true);
      try {
        const result = await unilavReviewRef.current?.saveDraftOnClose();
        if (result) setDraftSaved(true);
      }
      catch { setClosingResults(false); closingResultsRef.current = false; return; }
      setClosingResults(false);
    }
    setShowResults(false);
    closingResultsRef.current = false;
  }, [unilavPreview]);
  useEffect(() => {
    if (!showResults || !messages.length) return;
    let active = true;
    setLoadingInvoices(true);
    workflowRequest('contabilita/incassi-insoluti')
      .then(result => { if (active) setFatture(result.fatture || []); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoadingInvoices(false); });
    return () => { active = false; };
  }, [messages, version, showResults]);
  useEffect(() => {
    if (!showResults) return;
    const previous = document.body.style.overflow;
    const onEscape = event => { if (event.key === 'Escape') closeResults(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onEscape);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onEscape); };
  }, [showResults, closeResults]);
  const analyze = async () => {
    setError('');
    setDraftSaved(false);
    if (mode === 'file' && file && /\.pdf$/i.test(file.name)) {
      setLoading(true);
      try {
        const body = new FormData();
        body.append('file', file);
        const result = await workflowRequest(`azioni-veloci/${pdfKind}/anteprima`, { method: 'POST', body });
        setUnilavPreview(pdfKind === 'unilav' ? result : null);
        setVisuraPreview(pdfKind === 'visura' ? result : null);
        setMessages([]);
        setShowResults(true);
      } catch (err) { setError(err.message || 'Impossibile leggere il PDF.'); }
      finally { setLoading(false); }
      return;
    }
    const parsed = leggiBonifici(mode === 'testo' ? text : fileText);
    if (!parsed.length) { setError(mode === 'testo' ? 'Scrivi o incolla un messaggio di pagamento.' : 'Carica un file di testo con il messaggio.'); return; }
    setUnilavPreview(null);
    setVisuraPreview(null);
    setFatture([]);
    setLoadingInvoices(true);
    setMessages(parsed);
    setShowResults(true);
  };
  const readFile = async event => {
    const selectedFile = event.target.files?.[0]; if (!selectedFile) return;
    setError(''); setFileName(selectedFile.name); setFileText(''); setFile(null);
    if (!/\.(txt|csv|md|pdf)$/i.test(selectedFile.name)) { setError('Carica un PDF UNILAV o visura, oppure un file .txt, .csv o .md.'); return; }
    if (selectedFile.size > 10 * 1024 * 1024) { setError('Il file supera 10 MB.'); return; }
    setFile(selectedFile);
    if (/\.pdf$/i.test(selectedFile.name)) return;
    if (selectedFile.size > 1024 * 1024) { setFile(null); setError('Il file di testo supera 1 MB.'); return; }
    setLoading(true);
    try { setFileText(await selectedFile.text()); } catch { setError('Impossibile leggere il file.'); }
    finally { setLoading(false); }
  };
  return <section className="mx-auto max-w-4xl space-y-6 text-slate-100">
    <header><h1 className="text-2xl font-bold">Azioni veloci</h1><p className="mt-2 text-slate-400">Analizza un messaggio di pagamento, un UNILAV o una visura camerale; verifica i dati trovati prima di salvarli.</p></header>
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setMode('testo'); setError(''); }} aria-pressed={mode === 'testo'} className={`rounded-lg px-4 py-2 font-semibold ${mode === 'testo' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>Scrivi testo</button>
        <button type="button" onClick={() => { setMode('file'); setError(''); }} aria-pressed={mode === 'file'} className={`rounded-lg px-4 py-2 font-semibold ${mode === 'file' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>Carica file</button></div>
      {mode === 'testo' ? <div className="mt-5">
        <label htmlFor="testo-bonifico" className="block text-sm font-semibold">Messaggio di pagamento</label>
        <textarea id="testo-bonifico" value={text} onChange={event => setText(event.target.value)} rows={10} className="mt-2 w-full resize-y rounded-lg border border-slate-600 bg-slate-900 p-4 text-base text-white" />
      </div> : <div className="mt-5">
        <label htmlFor="file-bonifico" className="block text-sm font-semibold">Seleziona un PDF o un file di testo</label>
        <input id="file-bonifico" type="file" accept=".pdf,.txt,.csv,.md,application/pdf,text/plain,text/csv,text/markdown" onChange={readFile} className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-900 p-4 text-sm" />
        {file && /\.pdf$/i.test(file.name) && <label className="mt-3 block text-sm font-semibold">Tipo di PDF<select value={pdfKind} onChange={event => setPdfKind(event.target.value)} className="mt-1 block w-full max-w-sm rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"><option value="unilav">UNILAV</option><option value="visura">Visura camerale</option></select></label>}
        <p className="mt-2 text-sm text-slate-400">PDF con testo leggibile: UNILAV o visura camerale. Messaggi di pagamento: .txt, .csv, .md.</p>
        {fileName && <p className="mt-2 text-sm text-slate-200">File selezionato: {fileName}</p>}
      </div>}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      {draftSaved && <p role="status" className="mt-3 rounded-lg border border-emerald-700 bg-emerald-950/50 p-3 text-sm text-emerald-200">Bozza UNILAV salvata. La trovi in Anagrafica dipendenti, pulsante “Bozze”.</p>}
      <button type="button" disabled={loading || !(mode === 'testo' ? text.trim() : (file && /\.pdf$/i.test(file.name)) || fileText.trim())} onClick={analyze} className="mt-4 rounded-lg bg-indigo-600 px-5 py-3 font-bold hover:bg-indigo-500 disabled:opacity-50">{loading ? 'Lettura...' : 'Trova'}</button>
      {loading && mode === 'file' && pdfKind === 'visura' && <p role="status" className="mt-2 text-sm text-slate-300">Se il PDF è una scansione, il riconoscimento delle pagine può richiedere alcuni secondi.</p>}
    </div>
    {showResults && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-2 sm:p-4 lg:p-8" onMouseDown={event => { if (event.target === event.currentTarget) closeResults(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="azioni-veloci-results-title" className="flex h-full max-h-[960px] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-700 px-5 py-4 sm:px-7">
          <div><h2 id="azioni-veloci-results-title" className="text-2xl font-bold">{unilavPreview ? 'Verifica UNILAV' : visuraPreview ? 'Verifica visura camerale' : 'Fatture trovate'}</h2><p className="mt-1 text-sm text-slate-300">{unilavPreview ? 'Controlla il dipendente e le modifiche lette dal documento.' : visuraPreview ? 'Controlla il cliente e i dati estratti prima di salvare.' : 'Verifica cliente, importi e data prima di registrare il pagamento.'}</p></div>
          <button type="button" disabled={closingResults} onClick={closeResults} aria-label="Chiudi risultati" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"><X size={24} /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-7">
          {unilavPreview && file ? <UnilavReview ref={unilavReviewRef} file={file} preview={unilavPreview} onSaved={() => setShowResults(false)} /> : visuraPreview && file ? <VisuraReview file={file} preview={visuraPreview} /> : <>
            {loadingInvoices && <p role="status" className="rounded-lg bg-slate-800 p-4">Ricerca delle fatture aperte...</p>}
            {error && <p role="alert" className="rounded-lg bg-red-950 p-4 text-red-200">{error}</p>}
            {(!loadingInvoices || fatture.length > 0) && messages.map(message => <Bonifico key={`${message.id}-${message.raw}`} bonifico={message} fatture={fatture} onRegistered={() => setVersion(value => value + 1)} />)}
          </>}
        </div>
      </div>
    </div>}
  </section>;
}
