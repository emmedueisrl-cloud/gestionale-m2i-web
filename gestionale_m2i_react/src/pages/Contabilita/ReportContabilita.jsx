import { useEffect, useMemo, useState } from 'react';
import { workflowRequest } from '../../api/workflowElaborati';
import { mesePredefinitoElaborati } from '../../utils/mesePredefinitoElaborati';

const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const ore = value => Number(value || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 });
const columns = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'ore', label: 'Ore cliente', type: 'hours' },
  { key: 'tariffaOraria', label: 'Tariffa oraria', type: 'hourly' },
  { key: 'costoOrarioDipendente', label: 'Costo orario dipendente', type: 'hourly' },
  { key: 'differenzaOraria', label: 'Differenza oraria', type: 'hourly' },
  { key: 'imponibile', label: 'Imponibile fattura', type: 'money' },
  { key: 'costoDipendenti', label: 'Costo dipendenti', type: 'money' },
  { key: 'rimanenza', label: 'Rimanenza', type: 'money' }
];
const formatCell = (value, type) => value == null ? '—' : type === 'hours' ? `${ore(value)} h`
  : type === 'hourly' ? `${euro(value)} / h` : type === 'money' ? euro(value) : value;
const remainderColors = [
  { share: 0, rgb: [252, 165, 165] },
  { share: 0.4, rgb: [253, 186, 116] },
  { share: 0.7, rgb: [187, 247, 208] },
  { share: 1, rgb: [134, 239, 172] }
];
const remainderColor = row => {
  if (row.rimanenza == null) return undefined;
  const share = row.imponibile > 0 ? Math.max(0, Math.min(1, row.rimanenza / row.imponibile)) : 0;
  const upper = remainderColors.findIndex(stop => share <= stop.share);
  if (upper <= 0) return `rgb(${remainderColors[0].rgb.join(', ')})`;
  const start = remainderColors[upper - 1], end = remainderColors[upper];
  const progress = (share - start.share) / (end.share - start.share);
  return `rgb(${start.rgb.map((value, index) => Math.round(value + (end.rgb[index] - value) * progress)).join(', ')})`;
};

export default function ReportContabilita() {
  const [initial] = useState(mesePredefinitoElaborati);
  const [mese, setMese] = useState(initial.mese);
  const [anno, setAnno] = useState(initial.anno);
  const [report, setReport] = useState(null);
  const [f24Input, setF24Input] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sort, setSort] = useState({ key: 'cliente', direction: 'asc' });

  useEffect(() => {
    let current = true;
    setLoading(true); setReport(null); setError(''); setMessage('');
    workflowRequest(`contabilita/report/costo-dipendenti/${anno}/${mese}`)
      .then(data => { if (current) { setReport(data); setF24Input(data.f24 == null ? '' : String(data.f24).replace('.', ',')); } })
      .catch(cause => { if (current) setError(cause.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [mese, anno]);

  const saveF24 = async event => {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const data = await workflowRequest(`contabilita/report/costo-dipendenti/${anno}/${mese}/f24`, {
        method: 'PUT', body: JSON.stringify({ importo: f24Input })
      });
      setReport(data);
      setF24Input(String(data.f24).replace('.', ','));
      setMessage('Importo F24 salvato per il mese selezionato.');
    } catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  };

  const f24Modificato = report?.f24 != null && f24Input.replace(',', '.') !== String(report.f24);
  const sortedClients = useMemo(() => [...(report?.clientiDettaglio || [])].sort((a, b) => {
    const first = a[sort.key], second = b[sort.key];
    if (first == null || second == null) return first == null && second == null ? 0 : first == null ? 1 : -1;
    const comparison = sort.key === 'cliente'
      ? String(first).localeCompare(String(second), 'it', { sensitivity: 'base' })
      : Number(first) - Number(second);
    return (sort.direction === 'asc' ? 1 : -1) * comparison ||
      a.cliente.localeCompare(b.cliente, 'it', { sensitivity: 'base' });
  }), [report, sort]);
  const changeSort = key => setSort(current => ({ key,
    direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));

  return <main className="space-y-6 bg-white pt-8 text-slate-900">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[29px] font-bold">Report</h1>
        <p className="mt-1 text-sm text-slate-600">Costo orario dei dipendenti e tariffa media dei clienti.</p>
      </div>
      <div className="flex gap-2">
        <label className="text-sm font-semibold">Mese
          <select value={mese} onChange={event => setMese(Number(event.target.value))} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2">
            {mesi.map((nome, index) => <option key={nome} value={index + 1}>{nome}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Anno
          <input type="number" min="2000" max="2100" value={anno} onChange={event => setAnno(Number(event.target.value))} className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      </div>
    </header>

    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}
    {loading && <p className="text-slate-600">Caricamento report...</p>}
    {report && <>
      <form onSubmit={saveF24} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <label className="text-sm font-semibold">F24 del mese (€)
          <input type="text" inputMode="decimal" value={f24Input} onChange={event => { setF24Input(event.target.value); setMessage(''); }} placeholder="Es. 1500,00" className="mt-1 block w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base" />
        </label>
        <button type="submit" disabled={saving || !f24Input.trim()} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{saving ? 'Salvataggio...' : 'Salva F24'}</button>
        {f24Modificato && <span className="text-sm text-amber-800">Salva il nuovo importo per aggiornare il calcolo.</span>}
      </form>

      <section aria-label="Calcolo costo orario dipendenti" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Netti buste paga · Totale mese', euro(report.totaleNetti)],
            ['Totale CC', euro(report.totaleCc)],
            ['F24 salvato', report.f24 == null ? 'Da inserire' : euro(report.f24)],
            ['Ore totali', `${ore(report.oreTotali)} h`]
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>)}
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6">
          <p className="text-sm font-semibold text-indigo-900">Costo medio orario dipendente</p>
          <p className="mt-2 text-4xl font-bold text-indigo-950">{report.costoOrario == null ? '—' : `${euro(report.costoOrario)} / h`}</p>
          <p className="mt-2 text-sm text-indigo-900">({euro(report.totaleNetti)} netti + {euro(report.totaleCc)} CC + {report.f24 == null ? 'F24 da inserire' : euro(report.f24)}) ÷ {ore(report.oreTotali)} ore</p>
        </div>
        {report.oreTotali <= 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Non ci sono ore totali nel mese: non è possibile dividere il costo.</p>}
      </section>

      <section aria-label="Calcolo tariffa media clienti" className="space-y-4 border-t border-slate-200 pt-6">
        <div>
          <h2 className="text-xl font-bold">Tariffa media clienti</h2>
          <p className="mt-1 text-sm text-slate-600">Somma degli imponibili dei clienti con almeno un’ora, divisa per le ore lavorate, ferie, permessi e malattia dei dipendenti.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Imponibile clienti con ore', euro(report.imponibileClienti)],
            ['Ore lavorate dipendenti', `${ore(report.oreLavorateEffettive)} h`],
            ['Ferie, permessi e malattia', `${ore(report.oreFeriePermessiMalattia)} h`],
            ['Ore totali per la tariffa', `${ore(report.oreTariffaClienti)} h`]
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>)}
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-sm font-semibold text-emerald-900">Tariffa media clienti</p>
          <p className="mt-2 text-4xl font-bold text-emerald-950">{report.tariffaMediaClienti == null ? '—' : `${euro(report.tariffaMediaClienti)} / h`}</p>
          <p className="mt-2 text-sm text-emerald-900">{euro(report.imponibileClienti)} ÷ {ore(report.oreTariffaClienti)} ore · {report.clientiConOre} clienti inclusi · {report.clientiEsclusiZeroOre} clienti con zero ore esclusi</p>
        </div>
        {report.oreTariffaClienti <= 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Non ci sono ore utili nel mese: non è possibile calcolare la tariffa media.</p>}
      </section>

      <section aria-label="Redditività per cliente" className="space-y-4 border-t border-slate-200 pt-6">
        <div>
          <h2 className="text-xl font-bold">Clienti con almeno un’ora lavorata</h2>
          <p className="mt-1 text-sm text-slate-600">La rimanenza è l’imponibile meno il costo orario dipendente moltiplicato per le ore del cliente. Le righe passano dal rosso all’arancione e poi al verde quando cresce la percentuale di imponibile rimasta.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
            <p className="text-sm font-semibold text-sky-900">Totale imponibili dei clienti in tabella</p>
            <p className="mt-2 text-3xl font-bold text-sky-950">{euro(report.imponibileDettaglio)}</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
            <p className="text-sm font-semibold text-indigo-900">Totale costo personale incluse BP, CC e F24</p>
            <p className="mt-2 text-3xl font-bold text-indigo-950">{report.costoTotale == null ? '—' : euro(report.costoTotale)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-semibold text-emerald-900">Totale rimanenze</p>
            <p className="mt-2 text-3xl font-bold text-emerald-950">{report.rimanenzaTotale == null ? '—' : euro(report.rimanenzaTotale)}</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-sm">
          <table className="w-full min-w-[1380px] border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-slate-900"><tr>{columns.map(column =>
              <th key={column.key} scope="col" aria-sort={sort.key === column.key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'} className="border-b border-slate-300 px-3 py-3">
                <button type="button" onClick={() => changeSort(column.key)} className="flex w-full items-center justify-between gap-2 text-left font-semibold hover:text-indigo-700" aria-label={`Ordina per ${column.label}`}>
                  {column.label}<span aria-hidden="true" className="text-slate-500">{sort.key === column.key ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span>
                </button>
              </th>)}</tr></thead>
            <tbody>
              {!sortedClients.length && <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-slate-600">Nessun cliente con almeno un’ora lavorata nel mese.</td></tr>}
              {sortedClients.map(row => <tr key={row.id} style={{ backgroundColor: remainderColor(row) }} className="border-b border-slate-300 last:border-b-0">
                {columns.map(column => <td key={column.key} className={`px-3 py-3 ${column.key === 'cliente' ? 'font-semibold' : 'whitespace-nowrap tabular-nums'} ${column.key === 'rimanenza' ? 'font-bold' : ''}`}>
                  {formatCell(row[column.key], column.type)}
                </td>)}
              </tr>)}
            </tbody>
          </table>
        </div>
        {report.costoOrario == null && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Inserisci l’F24 e verifica le ore totali per vedere costo, differenze e rimanenza dei clienti.</p>}
      </section>
    </>}
  </main>;
}
