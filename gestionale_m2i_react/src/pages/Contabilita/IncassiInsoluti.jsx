import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDown, ArrowUp, ArrowUpDown, ChartNoAxesCombined, ChevronLeft, ChevronRight, History, RefreshCw, X } from 'lucide-react';
import { workflowRequest } from '../../api/workflowElaborati';

const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const cents = value => Math.round(Number(value || 0) * 100);
const dateIt = value => value && /^\d{4}-\d{2}-\d{2}/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '—';
const monthOf = value => typeof value === 'string' && /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : null;
const italyDate = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const shiftMonth = (value, offset) => {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = value => `${months[Number(value.slice(5)) - 1]} ${value.slice(0, 4)}`;
const shortCompany = value => String(value || '').trim().split(/\s+/).slice(0, 4).join(' ');
const daysSince = (issueDate, today) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate || '')) return '—';
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${issueDate}T00:00:00Z`)) / 86400000);
  if (!Number.isFinite(days)) return '—';
  if (days < 0) return 'Data futura';
  return `${days} ${days === 1 ? 'giorno' : 'giorni'}`;
};
const invoiceSortColumns = [
  { key: 'cliente', label: 'Azienda', value: invoice => shortCompany(invoice.cliente) },
  { key: 'numero', label: 'Fattura', value: invoice => invoice.registrata ? invoice.numero : 'Da registrare' },
  { key: 'eta', label: 'Emessa da', value: invoice => -Date.parse(`${invoice.dataFattura}T00:00:00Z`) || 0 },
  { key: 'totale', label: 'Totale', value: invoice => cents(invoice.totale) },
  { key: 'incassato', label: 'Incassato', value: invoice => cents(invoice.incassato) },
  { key: 'residuo', label: 'Residuo', value: invoice => cents(invoice.residuo) },
  { key: 'stato', label: 'Stato', value: invoice => invoice.stato }
];

function Metric({ label, amount, detail, style }) {
  return <div className={`min-w-[190px] flex-1 rounded-xl border px-4 py-3 ${style}`}>
    <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
    <p className="mt-1 text-2xl font-bold">{euro(amount)}</p>
    {detail && <p className="text-sm font-medium">{detail}</p>}
  </div>;
}

function InvoiceTable({ rows, empty, today, expandedId, onExpand, onPay, onCancel }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const selectedColumn = invoiceSortColumns.find(column => column.key === sortKey);
  const orderedRows = selectedColumn ? [...rows].sort((a, b) => {
    const first = selectedColumn.value(a);
    const second = selectedColumn.value(b);
    const comparison = typeof first === 'number' && typeof second === 'number'
      ? first - second : String(first || '').localeCompare(String(second || ''), 'it', { numeric: true, sensitivity: 'base' });
    return sortDirection === 'asc' ? comparison : -comparison;
  }) : rows;
  const changeSort = key => {
    if (key === sortKey) setSortDirection(current => current === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
  };
  return <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
    <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
      <thead className="bg-slate-100 text-xs uppercase"><tr>{invoiceSortColumns.map(column => <th key={column.key} scope="col" aria-sort={sortKey === column.key ? sortDirection === 'asc' ? 'ascending' : 'descending' : 'none'} className="border-b border-slate-300 px-3 py-3"><button type="button" onClick={() => changeSort(column.key)} className="inline-flex items-center gap-1 font-bold hover:text-indigo-700 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">{column.label}{sortKey === column.key ? sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />}</button></th>)}<th scope="col" className="border-b border-slate-300 px-3 py-3">Azioni</th></tr></thead>
      <tbody>
        {!rows.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">{empty}</td></tr>}
        {orderedRows.map((invoice, index) => <Fragment key={invoice.id}>
          <tr className={invoice.incongruenza ? 'bg-amber-50' : index % 2 ? 'bg-sky-50' : 'bg-white'}>
            <td className="border-b border-slate-200 px-3 py-4 font-semibold" title={invoice.cliente}>{shortCompany(invoice.cliente)}</td>
            <td className="border-b border-slate-200 px-3 py-4 font-semibold">{invoice.registrata ? invoice.numero : 'Da registrare'}</td>
            <td className="border-b border-slate-200 px-3 py-4 whitespace-nowrap" title={`${invoice.registrata ? 'Emessa' : 'Segnata come inviata'} il ${dateIt(invoice.dataFattura)}`}>{daysSince(invoice.dataFattura, today)}</td>
            <td className="border-b border-slate-200 px-3 py-4 whitespace-nowrap">{euro(invoice.totale)}</td>
            <td className="border-b border-slate-200 px-3 py-4 whitespace-nowrap">{euro(invoice.incassato)}</td>
            <td className="border-b border-slate-200 px-3 py-4 whitespace-nowrap font-bold">{euro(invoice.residuo)}</td>
            <td className="border-b border-slate-200 px-3 py-4"><span className={`rounded-full px-2 py-1 text-xs font-bold ${invoice.stato === 'Incassata' ? 'bg-emerald-100 text-emerald-800' : invoice.stato === 'Insoluta' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{invoice.stato}</span></td>
            <td className="border-b border-slate-200 px-3 py-4"><div className="flex flex-wrap gap-2">
              {invoice.residuo > 0 && invoice.gestibile && !invoice.incongruenza && <>
                <button type="button" onClick={() => onPay(invoice, true)} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-800">Segna come incassata</button>
                <button type="button" onClick={() => onPay(invoice, false)} className="rounded-lg bg-indigo-100 px-3 py-2 text-xs font-bold text-indigo-900 hover:bg-indigo-200">Registra acconto</button>
              </>}
              {invoice.gestibile ? <button type="button" onClick={() => onExpand(invoice.id)} aria-expanded={expandedId === invoice.id} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold hover:bg-slate-200"><History className="h-3.5 w-3.5" />Storico</button> : <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900" title={invoice.sincronizzazioneDaVerificare ? 'Gli incassi della fattura elaborata devono essere riconciliati con quelli della fattura importata.' : 'La fattura inviata deve ancora essere registrata.'}>{invoice.sincronizzazioneDaVerificare ? 'Verifica incassi' : 'In attesa registrazione'}</span>}
            </div></td>
          </tr>
          {invoice.incongruenza && <tr className="bg-amber-50"><td colSpan={8} className="border-b border-amber-200 px-3 pb-3 font-medium text-amber-900">{invoice.stato === 'Importo da verificare' ? 'Importo dell’elaborato non disponibile: verifica la riga in Fatturazione.' : invoice.sincronizzazioneDaVerificare ? 'Gli incassi registrati prima dell’importazione richiedono una verifica con la fattura importata.' : 'Gli importi della fattura e del registro non coincidono. Verifica prima di aggiungere incassi.'}</td></tr>}
          {expandedId === invoice.id && <tr className="bg-slate-50"><td colSpan={8} className="border-b border-slate-300 px-4 py-4">
            <h4 className="mb-3 font-bold">Storico incassi · {invoice.registrata ? invoice.numero : invoice.cliente}</h4>
            {!invoice.storico.length ? <p className="text-slate-600">Nessun incasso registrato.</p> : <div className="space-y-2">{invoice.storico.map(receipt => <div key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div><span className="font-semibold">{receipt.data ? dateIt(receipt.data) : 'Data non disponibile'} · {euro(receipt.importo)}</span>
                {receipt.origine === 'storico' && <span className="ml-2 rounded bg-slate-100 px-2 py-1 text-xs">Storico cumulativo</span>}
                {receipt.annullatoAt && <span className="ml-2 rounded bg-red-100 px-2 py-1 text-xs text-red-800">Annullato</span>}
                {receipt.nota && <p className="mt-1 text-slate-600">{receipt.nota}</p>}
                {receipt.motivoAnnullamento && <p className="mt-1 text-red-700">Motivo: {receipt.motivoAnnullamento}</p>}
              </div>
              {!receipt.annullatoAt && receipt.origine !== 'storico' && <button type="button" onClick={() => onCancel(invoice, receipt)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Annulla incasso</button>}
            </div>)}</div>}
          </td></tr>}
        </Fragment>)}
      </tbody>
    </table>
  </div>;
}

export default function IncassiInsoluti() {
  const [data, setData] = useState({ fatture: [], riepilogo: {} });
  const [period, setPeriod] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [payment, setPayment] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(italyDate);
  const [note, setNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [requestKey, setRequestKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [chartOpen, setChartOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await workflowRequest('contabilita/incassi-insoluti');
      setData(result);
      setPeriod(current => current || (result.fatture.some(invoice => (invoice.periodo || monthOf(invoice.dataFattura)) === italyDate().slice(0, 7))
        ? italyDate().slice(0, 7) : result.fatture.map(invoice => invoice.periodo || monthOf(invoice.dataFattura)).filter(Boolean).sort().at(-1) || italyDate().slice(0, 7)));
    } catch (err) { setError(err.message || 'Impossibile caricare gli incassi.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!chartOpen) return undefined;
    const onKeyDown = event => { if (event.key === 'Escape') setChartOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chartOpen]);

  const invoices = data.fatture;
  const month = period || italyDate().slice(0, 7);
  const receipts = useMemo(() => invoices.flatMap(invoice => invoice.storico.map(receipt => ({ ...receipt, invoice }))), [invoices]);
  const monthInvoices = invoices.filter(invoice => (invoice.periodo || monthOf(invoice.dataFattura)) === month);
  const priority = (a, b) => Number(b.stato === 'Insoluta') - Number(a.stato === 'Insoluta') ||
    (a.scadenza || '9999-12-31').localeCompare(b.scadenza || '9999-12-31');
  const isOpen = invoice => invoice.residuo > 0 || invoice.stato === 'Importo da verificare';
  const monthOpen = monthInvoices.filter(isOpen).sort(priority);
  const monthPaid = monthInvoices.filter(invoice => !isOpen(invoice) && invoice.stato !== 'Nota di credito');
  const monthCredits = monthInvoices.filter(invoice => invoice.stato === 'Nota di credito');
  const allOpen = invoices.filter(isOpen).sort(priority);
  const matchesSearch = invoice => `${invoice.cliente} ${invoice.numero}`.toLocaleLowerCase('it-IT').includes(search.trim().toLocaleLowerCase('it-IT'));
  const visibleMonthOpen = monthOpen.filter(matchesSearch);
  const visibleMonthPaid = monthPaid.filter(matchesSearch);
  const visibleMonthCredits = monthCredits.filter(matchesSearch);
  const visibleOpen = allOpen.filter(matchesSearch);
  const shownCount = (visible, total) => search.trim() ? `${visible} di ${total}` : total;
  const monthReceipts = receipts.filter(receipt => !receipt.annullatoAt && monthOf(receipt.data) === month);
  const monthRevenue = monthInvoices.reduce((sum, invoice) => sum + cents(invoice.totale), 0) / 100;
  const monthCollected = monthReceipts.reduce((sum, receipt) => sum + cents(receipt.importo), 0) / 100;
  const monthRemaining = monthOpen.reduce((sum, invoice) => sum + cents(invoice.residuo), 0) / 100;
  const chart = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const key = shiftMonth(month, index - 11);
    return { mese: `${months[Number(key.slice(5)) - 1].slice(0, 3)} ${key.slice(2, 4)}`,
      fatturato: invoices.filter(invoice => (invoice.periodo || monthOf(invoice.dataFattura)) === key).reduce((sum, invoice) => sum + cents(invoice.totale), 0) / 100,
      incassato: receipts.filter(receipt => !receipt.annullatoAt && monthOf(receipt.data) === key).reduce((sum, receipt) => sum + cents(receipt.importo), 0) / 100 };
  }), [invoices, receipts, month]);
  const legacy = receipts.filter(receipt => receipt.origine === 'storico' && !receipt.annullatoAt);

  const openPayment = (invoice, full) => {
    setPayment(invoice); setAmount(full ? invoice.residuo.toFixed(2) : ''); setPaymentDate(italyDate()); setNote(''); setError('');
    setRequestKey(window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  };
  const submitPayment = async event => {
    event.preventDefault(); if (!payment) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await workflowRequest(`contabilita/incassi-insoluti/${encodeURIComponent(payment.id)}/incassi`, {
        method: 'POST', body: JSON.stringify({ data: paymentDate, importo: amount, nota: note, idempotencyKey: requestKey })
      });
      const label = payment.registrata ? `fattura ${payment.numero}` : `fattura inviata a ${payment.cliente}`;
      await load(); setPayment(null); setMessage(`Incasso della ${label} registrato.`);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const submitCancel = async event => {
    event.preventDefault(); if (!cancelTarget) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await workflowRequest(`contabilita/incassi-insoluti/incassi/${encodeURIComponent(cancelTarget.receipt.id)}/annulla`, { method: 'POST', body: JSON.stringify({ motivo: cancelReason }) });
      await load(); setCancelTarget(null); setMessage('Incasso annullato. Il residuo della fattura è stato aggiornato.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const tableActions = { today: data.oggi || italyDate(), expandedId, onExpand: id => setExpandedId(current => current === id ? null : id), onPay: openPayment,
    onCancel: (invoice, receipt) => { setCancelTarget({ invoice, receipt }); setCancelReason(''); setError(''); } };

  return <div className="space-y-7 bg-white pb-12 text-slate-900">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-3"><h1 className="text-[29px] font-bold">Incassi e Insoluti</h1><button type="button" onClick={() => setChartOpen(true)} aria-label="Apri grafico fatturato e incassato" title="Visualizza grafico" className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-indigo-700 hover:bg-indigo-100"><ChartNoAxesCombined className="h-5 w-5" /></button></div><p className="text-sm text-slate-600">Fatture emesse, incassi registrati e importi ancora aperti.</p></div>
      <button type="button" disabled={busy} onClick={() => { setBusy(true); void load().finally(() => setBusy(false)); }} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 font-semibold hover:bg-slate-200 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Aggiorna</button></header>
    <section aria-label="Riepilogo generale" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Fatturato totale" amount={data.riepilogo?.fatturato} detail={`${invoices.length} fatture`} style="border-indigo-300 bg-indigo-50 text-indigo-900" />
      <Metric label="Incassato" amount={data.riepilogo?.incassato} style="border-emerald-300 bg-emerald-50 text-emerald-900" />
      <Metric label="Da incassare" amount={data.riepilogo?.daIncassare} detail={`${allOpen.length} fatture aperte`} style="border-amber-300 bg-amber-50 text-amber-900" />
      <Metric label="Di cui insoluti" amount={data.riepilogo?.insoluto} style="border-red-300 bg-red-50 text-red-900" />
    </section>
    {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">{message}</p>}
    {loading && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">Caricamento fatture e incassi...</p>}
    {error && !payment && !cancelTarget && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-4"><div>{showAll ? <h2 className="text-2xl font-bold">Tutti i mesi</h2> : <><h2 className="text-2xl font-bold">{monthLabel(month)}</h2><p className="text-sm text-slate-600">Fatture raggruppate per mese di riferimento in Fatturazione.</p></>}</div><div className="flex flex-wrap items-center gap-2">{!showAll && <button type="button" aria-label="Mese precedente" onClick={() => setPeriod(shiftMonth(month, -1))} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-100"><ChevronLeft className="h-5 w-5" /></button>}<input type="month" aria-label="Mese da visualizzare" value={month} onChange={event => { if (event.target.value) { setPeriod(event.target.value); setShowAll(false); } }} className="rounded-lg border border-slate-300 bg-white p-2 font-semibold" />{!showAll && <button type="button" aria-label="Mese successivo" onClick={() => setPeriod(shiftMonth(month, 1))} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-100"><ChevronRight className="h-5 w-5" /></button>}<button type="button" onClick={() => setShowAll(current => !current)} aria-pressed={showAll} className={`rounded-lg border px-4 py-2 font-semibold ${showAll ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-300 bg-white hover:bg-slate-100'}`}>{showAll ? 'Vedi mese' : 'Vedi tutte'}</button></div></div>
      <div className="flex justify-end"><input type="search" aria-label="Cerca azienda o numero fattura" placeholder="Cerca azienda o fattura" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64" /></div>
      {!showAll && <>
      <div className="grid gap-3 sm:grid-cols-3"><Metric label="Fatturato del mese" amount={monthRevenue} detail={`${monthInvoices.length} fatture elaborate`} style="border-indigo-300 bg-indigo-50 text-indigo-900" /><Metric label="Incassato nel mese" amount={monthCollected} detail={`${monthReceipts.length} registrazioni`} style="border-emerald-300 bg-emerald-50 text-emerald-900" /><Metric label="Residuo delle fatture del mese" amount={monthRemaining} style="border-amber-300 bg-amber-50 text-amber-900" /></div>
      <div className="space-y-3"><h3 className="text-lg font-bold">Da incassare · {shownCount(visibleMonthOpen.length, monthOpen.length)}</h3><InvoiceTable rows={visibleMonthOpen} empty={search ? 'Nessuna fattura da incassare corrisponde alla ricerca.' : 'Nessuna fattura aperta emessa in questo mese.'} {...tableActions} /></div>
      <div className="space-y-3"><h3 className="text-lg font-bold">Incassate · {shownCount(visibleMonthPaid.length, monthPaid.length)}</h3><InvoiceTable rows={visibleMonthPaid} empty={search ? 'Nessuna fattura incassata corrisponde alla ricerca.' : 'Nessuna fattura interamente incassata emessa in questo mese.'} {...tableActions} /></div>
      {monthCredits.length > 0 && <div className="space-y-3"><h3 className="text-lg font-bold">Note di credito · {shownCount(visibleMonthCredits.length, monthCredits.length)}</h3><InvoiceTable rows={visibleMonthCredits} empty="Nessuna nota di credito corrisponde alla ricerca." {...tableActions} /></div>}
      </>}
      {showAll && <div className="space-y-3"><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold">Tutte le fatture da incassare</h2><span className="text-sm font-semibold text-slate-600">{shownCount(visibleOpen.length, allOpen.length)} · {euro(data.riepilogo?.daIncassare)}</span></div><InvoiceTable rows={visibleOpen} empty={search ? 'Nessuna fattura corrisponde alla ricerca.' : 'Non ci sono fatture da incassare.'} {...tableActions} /></div>}
    </section>

    {chartOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="incassi-chart-title" className="w-full max-w-6xl rounded-xl bg-white p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="incassi-chart-title" className="text-xl font-bold">Fatturato e incassato per mese</h2><p className="text-sm text-slate-600">Fatturato per mese di riferimento · incassato per data di pagamento</p></div><button type="button" onClick={() => setChartOpen(false)} aria-label="Chiudi grafico" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      <div className="h-[360px] w-full overflow-x-auto"><div className="h-full min-w-[700px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ top: 8, right: 12, left: 12, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="mese" tick={{ fill: '#475569', fontSize: 11 }} interval={0} /><YAxis tickFormatter={value => `${Math.round(value / 1000)}k`} tick={{ fill: '#475569', fontSize: 11 }} /><Tooltip formatter={(value, name) => [euro(value), name]} /><Legend /><Bar name="Fatturato" dataKey="fatturato" fill="#4f46e5" radius={[4, 4, 0, 0]} /><Bar name="Incassato" dataKey="incassato" fill="#059669" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
      {legacy.length > 0 && <p className="mt-3 text-xs text-slate-600">Gli incassi precedenti al nuovo registro sono totali cumulativi: se datati sono attribuiti all’ultima data disponibile, senza dettaglio delle rate.{legacy.some(receipt => !receipt.data) && ' I totali storici senza data non compaiono nel grafico.'}</p>}
    </div></div>}
    {payment && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"><form onSubmit={submitPayment} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Registra incasso</h2><p className="text-sm text-slate-600">{payment.cliente} · {payment.registrata ? `Fattura ${payment.numero}` : 'Fattura inviata da registrare'}</p></div><button type="button" disabled={busy} onClick={() => setPayment(null)} aria-label="Chiudi"><X className="h-5 w-5" /></button></div><p className="rounded-lg bg-amber-50 p-3 font-semibold text-amber-900">Residuo: {euro(payment.residuo)}</p><label className="block text-sm font-semibold">Data incasso<input required type="date" max={italyDate()} value={paymentDate} onChange={event => setPaymentDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-base" /></label><label className="block text-sm font-semibold">Importo incassato (€)<input required type="number" min="0.01" max={payment.residuo} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-base" /></label><label className="block text-sm font-semibold">Nota facoltativa<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-base" /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setPayment(null)} className="rounded-lg bg-slate-100 px-4 py-2">Annulla</button><button type="submit" disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Registrazione...' : 'Conferma incasso'}</button></div></form></div>}
    {cancelTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"><form onSubmit={submitCancel} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold">Annulla incasso</h2><p className="text-sm text-slate-700">{cancelTarget.invoice.registrata ? `Fattura ${cancelTarget.invoice.numero}` : `Fattura inviata a ${cancelTarget.invoice.cliente}`} · {euro(cancelTarget.receipt.importo)} del {dateIt(cancelTarget.receipt.data)}. L’operazione rimarrà nello storico e il residuo sarà aggiornato.</p><label className="block text-sm font-semibold">Motivo dell’annullamento<textarea required minLength={3} maxLength={1000} rows={3} value={cancelReason} onChange={event => setCancelReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-base" /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setCancelTarget(null)} className="rounded-lg bg-slate-100 px-4 py-2">Torna indietro</button><button type="submit" disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Conferma annullamento</button></div></form></div>}
  </div>;
}
