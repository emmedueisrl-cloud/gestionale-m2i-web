import { useEffect, useMemo, useState } from 'react';
import { Info, Pencil, Trash2 } from 'lucide-react';
import { workflowRequest } from '../../api/workflowElaborati';
import { mesePredefinitoElaborati } from '../../utils/mesePredefinitoElaborati';

const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const euroOrarioPreciso = value => `${Number(value).toLocaleString('it-IT', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} €/h`;
const ore = value => Number(value || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 });
const shortClientName = value => String(value || '').trim().split(/\s+/).slice(0, 4).join(' ');
const adjustmentLabels = {
  totaleNetti: 'Netti buste paga · Totale mese', totaleCc: 'Totale CC',
  f24: 'F24 salvato', oreTotali: 'Ore totali', imponibileClienti: 'Imponibile clienti con ore'
};
const columns = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'ore', label: 'Ore cliente', type: 'hours' },
  { key: 'tariffaOraria', label: 'Tariffa oraria', type: 'hourly' },
  { key: 'costoOrarioDipendente', label: 'Costo orario dipendente', type: 'hourly' },
  { key: 'differenzaOraria', label: 'Differenza oraria', type: 'hourly' },
  { key: 'imponibile', label: 'Imponibile fattura', type: 'money' },
  { key: 'costoDipendenti', label: 'Costo dipendenti', type: 'money' },
  { key: 'rimanenza', label: 'Rimanenza', type: 'money' },
  { key: 'percentualeGuadagno', label: 'Guadagno su imponibile (%)', type: 'percentage' }
];
const employeeColumns = [
  { key: 'dipendente', label: 'Dipendente' },
  { key: 'ore', label: 'Ore senza malattia' },
  { key: 'stipendio', label: 'Stipendio' },
  { key: 'costoOrario', label: 'Costo orario' },
  { key: 'resa', label: 'Resa' }
];
const formatCell = (value, type) => value == null ? '—' : type === 'hours' ? `${ore(value)} h`
  : type === 'hourly' ? `${euro(value)} / h` : type === 'money' ? euro(value)
    : type === 'percentage' ? `${Number(value).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : value;
const percentageGain = row => row.rimanenza == null || Number(row.imponibile) <= 0
  ? null : (Number(row.rimanenza) / Number(row.imponibile)) * 100;
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

function AdjustableCard({ field, label, value, adjustments, clientAdjustments = [], employeeAdjustments = [], pairedAdjustments = [], onEdit, onDelete, deletingId, hours = false }) {
  const clientField = field === 'oreTotali' ? 'ore' : field === 'imponibileClienti' ? 'imponibile' : null;
  const employeeField = field === 'oreTotali' ? 'ore' : field === 'totaleNetti' ? 'netto' : null;
  const notes = [...adjustments.filter(item => item.voce === field),
    ...clientAdjustments.filter(item => item.voce === clientField).map(item => ({
      ...item, valore: item.differenza, nota: `${item.cliente}: ${item.nota}` })),
    ...employeeAdjustments.filter(item => item.voce === employeeField).map(item => ({
      ...item, valore: item.differenza, nota: `${item.dipendente}: ${item.nota}` })),
    ...(field === 'oreTotali' ? pairedAdjustments.map(item => ({
      pairedId: item.id, valore: item.abbinamenti.reduce((sum, row) => sum + row.differenza, 0), nota: item.nota })) : [])];
  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <button type="button" onClick={() => onEdit(field)} aria-label={`Rettifica ${label}`} title={`Rettifica ${label}`} className="rounded-lg p-2 text-indigo-700 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700">
        <Pencil size={18} aria-hidden="true" />
      </button>
    </div>
    <p className="mt-2 text-2xl font-bold">{value}</p>
    {notes.length > 0 && <ul className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
      {notes.map(item => <li key={item.clienteId ? `client:${item.clienteId}:${item.voce}` : item.dipendenteId ? `employee:${item.dipendenteId}:${item.voce}` : item.pairedId ? `paired:${item.pairedId}` : item.id} className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-words"><strong className={item.valore < 0 ? 'text-red-700' : 'text-emerald-700'}>{item.valore < 0 ? '−' : '+'}{hours ? `${ore(Math.abs(item.valore))} h` : euro(Math.abs(item.valore))}</strong> · {item.nota}</span>
        <button type="button" disabled={deletingId === (item.clienteId ? `client:${item.clienteId}:${item.voce}` : item.dipendenteId ? `employee:${item.dipendenteId}:${item.voce}` : item.pairedId ? `paired:${item.pairedId}` : `global:${item.id}`)} onClick={() => onDelete(item)} aria-label={`Elimina rettifica: ${item.nota}`} title="Elimina rettifica" className="shrink-0 rounded p-1 text-slate-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </li>)}
    </ul>}
  </div>;
}

function HourlyCostBreakdown({ row, report }) {
  if (row.costoOrario == null) return null;
  const quotaF24c = report.f24cConMalattia / report.oreRipartizioneDipendenti;
  const quotaStipendio = row.stipendio / row.ore;
  return <div className="mt-1 space-y-0.5 whitespace-normal text-xs font-normal leading-snug text-slate-600">
    <p>Quota F24C: {euro(report.f24cConMalattia)} ÷ {ore(report.oreRipartizioneDipendenti)} h = {euroOrarioPreciso(quotaF24c)}</p>
    <p>Quota stipendio: {euro(row.stipendio)} ÷ {ore(row.ore)} h = {euroOrarioPreciso(quotaStipendio)}</p>
    <p>Somma: {euroOrarioPreciso(quotaF24c)} + {euroOrarioPreciso(quotaStipendio)} = {euroOrarioPreciso(quotaF24c + quotaStipendio)}</p>
    <p className="font-semibold text-slate-700">Arrotondato: {euro(row.costoOrario)} / h</p>
  </div>;
}

export default function ReportContabilita() {
  const [initial] = useState(mesePredefinitoElaborati);
  const [mese, setMese] = useState(initial.mese);
  const [anno, setAnno] = useState(initial.anno);
  const [report, setReport] = useState(null);
  const [f24Input, setF24Input] = useState('');
  const [f24cInput, setF24cInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingF24c, setSavingF24c] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sort, setSort] = useState({ key: 'cliente', direction: 'asc' });
  const [employeeSort, setEmployeeSort] = useState({ key: 'dipendente', direction: 'asc' });
  const [adjustmentField, setAdjustmentField] = useState(null);
  const [adjustmentOperation, setAdjustmentOperation] = useState('aggiungi');
  const [adjustmentValue, setAdjustmentValue] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [adjustmentError, setAdjustmentError] = useState('');
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);
  const [deletingAdjustmentId, setDeletingAdjustmentId] = useState(null);
  const [clientCell, setClientCell] = useState(null);
  const [clientValue, setClientValue] = useState('');
  const [clientNote, setClientNote] = useState('');
  const [clientError, setClientError] = useState('');
  const [clientSaving, setClientSaving] = useState(false);
  const [employeeCell, setEmployeeCell] = useState(null);
  const [employeeValue, setEmployeeValue] = useState('');
  const [employeeNote, setEmployeeNote] = useState('');
  const [employeeError, setEmployeeError] = useState('');
  const [employeeSaving, setEmployeeSaving] = useState(false);
  const [pairedCell, setPairedCell] = useState(null);
  const [pairedValue, setPairedValue] = useState('');
  const [pairedNote, setPairedNote] = useState('');
  const [pairedAllocations, setPairedAllocations] = useState({});
  const [pairedError, setPairedError] = useState('');
  const [pairedSaving, setPairedSaving] = useState(false);
  const [pairedNoteEdit, setPairedNoteEdit] = useState(null);
  const [pairedNoteDraft, setPairedNoteDraft] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true); setReport(null); setError(''); setMessage('');
    setAdjustmentField(null);
    setClientCell(null);
    setEmployeeCell(null);
    setPairedCell(null);
    workflowRequest(`contabilita/report/costo-dipendenti/${anno}/${mese}`)
      .then(data => { if (current) { setReport(data); setF24Input(data.valoriBase.f24 == null ? '' : String(data.valoriBase.f24).replace('.', ','));
        setF24cInput(data.f24c == null ? '' : String(data.f24c).replace('.', ',')); } })
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
      setF24Input(String(data.valoriBase.f24).replace('.', ','));
      setMessage('Importo F24 salvato per il mese selezionato.');
    } catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  };

  const saveF24c = async event => {
    event.preventDefault(); setSavingF24c(true); setError(''); setMessage('');
    try {
      const data = await workflowRequest(`contabilita/report/costo-dipendenti/${anno}/${mese}/f24c`, {
        method: 'PUT', body: JSON.stringify({ importo: f24cInput })
      });
      setReport(data); setF24cInput(String(data.f24c).replace('.', ','));
      setMessage('F24C salvato nel Report per il mese selezionato.');
    } catch (cause) { setError(cause.message); }
    finally { setSavingF24c(false); }
  };

  const openAdjustment = field => {
    setAdjustmentField(field); setAdjustmentOperation('aggiungi');
    setAdjustmentValue(''); setAdjustmentNote(''); setAdjustmentError('');
  };
  const saveAdjustment = async event => {
    event.preventDefault();
    setAdjustmentSaving(true); setAdjustmentError('');
    try {
      const data = await workflowRequest(`contabilita/report/costo-dipendenti/${anno}/${mese}/rettifiche`, {
        method: 'POST', body: JSON.stringify({ voce: adjustmentField, operazione: adjustmentOperation,
          valore: adjustmentValue, nota: adjustmentNote })
      });
      setReport(data); setAdjustmentField(null);
      setMessage('Rettifica salvata nel Report.');
    } catch (cause) { setAdjustmentError(cause.message); }
    finally { setAdjustmentSaving(false); }
  };
  const deleteAdjustment = async item => {
    const key = item.clienteId ? `client:${item.clienteId}:${item.voce}` : item.dipendenteId ? `employee:${item.dipendenteId}:${item.voce}` : item.pairedId ? `paired:${item.pairedId}` : `global:${item.id}`;
    setDeletingAdjustmentId(key); setError(''); setMessage('');
    try {
      const path = item.clienteId
        ? `contabilita/report/costo-dipendenti/${anno}/${mese}/clienti/${encodeURIComponent(item.clienteId)}/${item.voce}`
        : item.dipendenteId
          ? `contabilita/report/costo-dipendenti/${anno}/${mese}/dipendenti/${encodeURIComponent(item.dipendenteId)}/${item.voce}`
        : item.pairedId
          ? `contabilita/report/costo-dipendenti/${anno}/${mese}/ore-abbinate/${encodeURIComponent(item.pairedId)}`
        : `contabilita/report/costo-dipendenti/${anno}/${mese}/rettifiche/${item.id}`;
      const data = await workflowRequest(path, { method: 'DELETE' });
      setReport(data); setMessage('Rettifica eliminata dal Report.');
      if (clientCell?.clienteId === item.clienteId && clientCell?.voce === item.voce) setClientCell(null);
      if (item.dipendenteId && employeeCell?.dipendenteId === item.dipendenteId && employeeCell?.voce === item.voce) setEmployeeCell(null);
      if (item.pairedId) setPairedCell(null);
    } catch (cause) {
      if (item.clienteId && clientCell) setClientError(cause.message);
      else if (item.dipendenteId && employeeCell) setEmployeeError(cause.message);
      else if (item.pairedId && pairedCell) setPairedError(cause.message);
      else setError(cause.message);
    }
    finally { setDeletingAdjustmentId(null); }
  };

  const openClientCell = (row, voce) => {
    if (voce === 'ore') return openPairedCell('cliente', row);
    const existing = report.rettificheClienti?.find(item => item.clienteId === row.id && item.voce === voce);
    setClientCell({ clienteId: row.id, cliente: row.cliente, voce });
    setClientValue(String(existing?.valore ?? (voce === 'ore' ? row.ore : row.imponibile)).replace('.', ','));
    setClientNote(existing?.nota || ''); setClientError('');
  };
  const saveClientCell = async event => {
    event.preventDefault(); setClientSaving(true); setClientError('');
    try {
      const data = await workflowRequest(`contabilita/report/costo-dipendenti/${anno}/${mese}/clienti/${encodeURIComponent(clientCell.clienteId)}/${clientCell.voce}`, {
        method: 'PUT', body: JSON.stringify({ valore: clientValue, nota: clientNote })
      });
      setReport(data); setClientCell(null); setMessage('Rettifica del cliente salvata nel Report.');
    } catch (cause) { setClientError(cause.message); }
    finally { setClientSaving(false); }
  };
  const openEmployeeCell = (row, voce) => {
    if (voce === 'ore') return openPairedCell('dipendente', row);
    const existing = report.rettificheDipendenti?.find(item => item.dipendenteId === row.id && item.voce === voce);
    setEmployeeCell({ dipendenteId: row.id, dipendente: row.dipendente, voce });
    setEmployeeValue(String(existing?.valore ?? (voce === 'ore' ? row.ore : row.nettoBusta)).replace('.', ','));
    setEmployeeNote(existing?.nota || ''); setEmployeeError('');
  };
  const saveEmployeeCell = async event => {
    event.preventDefault(); setEmployeeSaving(true); setEmployeeError('');
    try {
      const data = await workflowRequest(`contabilita/report/costo-dipendenti/${anno}/${mese}/dipendenti/${encodeURIComponent(employeeCell.dipendenteId)}/${employeeCell.voce}`, {
        method: 'PUT', body: JSON.stringify({ valore: employeeValue, nota: employeeNote })
      });
      setReport(data); setEmployeeCell(null); setMessage('Rettifica del dipendente salvata nel Report.');
    } catch (cause) { setEmployeeError(cause.message); }
    finally { setEmployeeSaving(false); }
  };
  const openPairedCell = (origine, row) => {
    setPairedCell({ origine, id: row.id, name: origine === 'cliente' ? row.cliente : row.dipendente });
    setPairedValue(String(row.ore).replace('.', ',')); setPairedNote('');
    setPairedAllocations({}); setPairedError(''); setPairedNoteEdit(null);
  };
  const savePairedHours = async event => {
    event.preventDefault(); setPairedSaving(true); setPairedError('');
    try {
      const abbinamenti = Object.entries(pairedAllocations).filter(([, value]) => String(value).trim())
        .map(([id, value]) => ({ id, ore: value }));
      const data = await workflowRequest(`contabilita/report/costo-dipendenti/${anno}/${mese}/ore-abbinate`, {
        method: 'POST', body: JSON.stringify({ origine: pairedCell.origine, soggettoId: pairedCell.id,
          valore: pairedValue, abbinamenti, nota: pairedNote })
      });
      setReport(data); setPairedCell(null); setMessage('Ore abbinate aggiornate in entrambe le tabelle del Report.');
    } catch (cause) { setPairedError(cause.message); }
    finally { setPairedSaving(false); }
  };
  const savePairedNote = async id => {
    setPairedSaving(true); setPairedError('');
    try {
      const data = await workflowRequest(`contabilita/report/costo-dipendenti/${anno}/${mese}/ore-abbinate/${encodeURIComponent(id)}/nota`, {
        method: 'PUT', body: JSON.stringify({ nota: pairedNoteDraft })
      });
      setReport(data); setPairedNoteEdit(null); setMessage('Nota aggiornata nel Report.');
    } catch (cause) { setPairedError(cause.message); }
    finally { setPairedSaving(false); }
  };

  const f24Modificato = report?.valoriBase?.f24 != null && f24Input.replace(',', '.') !== String(report.valoriBase.f24);
  const sortedClients = useMemo(() => (report?.clientiDettaglio || [])
    .map(row => ({ ...row, percentualeGuadagno: percentageGain(row) })).sort((a, b) => {
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
  const sortedEmployees = useMemo(() => [...(report?.dipendentiDettaglio || [])].sort((a, b) => {
    const first = a[employeeSort.key], second = b[employeeSort.key];
    if (first == null || second == null) return first == null && second == null ? 0 : first == null ? 1 : -1;
    const comparison = employeeSort.key === 'dipendente'
      ? String(first).localeCompare(String(second), 'it', { sensitivity: 'base' })
      : Number(first) - Number(second);
    return (employeeSort.direction === 'asc' ? 1 : -1) * comparison ||
      a.dipendente.localeCompare(b.dipendente, 'it', { sensitivity: 'base' });
  }), [report, employeeSort]);
  const changeEmployeeSort = key => setEmployeeSort(current => ({ key,
    direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const adjustmentIsHours = adjustmentField === 'oreTotali';
  const adjustmentDisplay = value => value == null ? 'Da inserire' : adjustmentIsHours ? `${ore(value)} h` : euro(value);
  const clientCellAdjustment = clientCell && report?.rettificheClienti?.find(item =>
    item.clienteId === clientCell.clienteId && item.voce === clientCell.voce);
  const employeeCellAdjustment = employeeCell && report?.rettificheDipendenti?.find(item =>
    item.dipendenteId === employeeCell.dipendenteId && item.voce === employeeCell.voce);
  const pairedRow = pairedCell && (pairedCell.origine === 'cliente' ? report?.clientiDettaglio : report?.dipendentiDettaglio)?.find(row => row.id === pairedCell.id);
  const pairedDeltaCent = pairedRow ? Math.round(Number(pairedValue.replace(',', '.')) * 100) - Math.round(Number(pairedRow.ore) * 100) : 0;
  const pairedPartners = pairedCell && (pairedCell.origine === 'cliente' ? report?.dipendentiDettaglio : report?.clientiDettaglio)?.filter(row => {
    if (pairedDeltaCent >= 0) return true;
    return report?.abbinamentiOre?.some(pair => pairedCell.origine === 'cliente'
      ? pair.clienteId === pairedCell.id && pair.dipendenteId === row.id && pair.ore > 0
      : pair.dipendenteId === pairedCell.id && pair.clienteId === row.id && pair.ore > 0);
  });
  const pairedHistory = pairedCell && report?.rettificheOreAbbinate?.filter(item => item.abbinamenti.some(pair =>
    pairedCell.origine === 'cliente' ? pair.clienteId === pairedCell.id : pair.dipendenteId === pairedCell.id));
  const pairedAllocatedCent = Object.values(pairedAllocations).reduce((sum, value) => {
    const amount = String(value || '').trim().replace(',', '.');
    return sum + (amount && Number.isFinite(Number(amount)) ? Math.round(Number(amount) * 100) : 0);
  }, 0);

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
            ['totaleNetti', euro(report.totaleNetti)],
            ['totaleCc', euro(report.totaleCc)],
            ['f24', report.f24 == null ? 'Da inserire' : euro(report.f24)],
            ['oreTotali', `${ore(report.oreTotali)} h`]
          ].map(([field, value]) => <AdjustableCard key={field} field={field} label={adjustmentLabels[field]}
            value={value} hours={field === 'oreTotali'} adjustments={report.rettifiche || []}
            clientAdjustments={report.rettificheClienti || []}
            employeeAdjustments={report.rettificheDipendenti || []}
            pairedAdjustments={report.rettificheOreAbbinate || []}
            onEdit={openAdjustment} onDelete={deleteAdjustment} deletingId={deletingAdjustmentId} />)}
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
          <p className="mt-1 text-sm text-slate-600">Somma degli imponibili dei clienti con ore, divisa per le ore totali mostrate sopra, comprese le rettifiche del Report.</p>
        </div>
        <AdjustableCard field="imponibileClienti" label={adjustmentLabels.imponibileClienti}
          value={euro(report.imponibileClienti)} adjustments={report.rettifiche || []}
          clientAdjustments={report.rettificheClienti || []}
          employeeAdjustments={report.rettificheDipendenti || []}
          pairedAdjustments={report.rettificheOreAbbinate || []}
          onEdit={openAdjustment} onDelete={deleteAdjustment} deletingId={deletingAdjustmentId} />
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-sm font-semibold text-emerald-900">Tariffa media clienti</p>
          <p className="mt-2 text-4xl font-bold text-emerald-950">{report.tariffaMediaClienti == null ? '—' : `${euro(report.tariffaMediaClienti)} / h`}</p>
          <p className="mt-2 text-sm text-emerald-900">{euro(report.imponibileClienti)} ÷ {ore(report.oreTotali)} ore · {report.clientiConOre} clienti inclusi · {report.clientiEsclusiZeroOre} clienti con zero ore esclusi</p>
        </div>
        {report.oreTotali <= 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Non ci sono ore totali nel mese: non è possibile calcolare la tariffa media.</p>}
      </section>

      <section aria-label="Redditività per cliente" className="space-y-4 border-t border-slate-200 pt-6">
        <div>
          <h2 className="text-xl font-bold">Clienti con almeno un’ora lavorata o rettificati</h2>
          <p className="mt-1 text-sm text-slate-600">La rimanenza è l’imponibile meno il costo orario dipendente moltiplicato per le ore del cliente. Il guadagno percentuale è la rimanenza divisa per l’imponibile. Le righe passano dal rosso all’arancione e poi al verde quando questa percentuale cresce.</p>
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
          <table className="w-full min-w-[1350px] table-fixed border-collapse text-left text-sm">
            <colgroup>{[13, 8, 11, 11, 10, 12, 13, 11, 11].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
            <thead className="bg-slate-100 text-slate-900"><tr>{columns.map(column =>
              <th key={column.key} scope="col" aria-sort={sort.key === column.key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'} className="border-b border-slate-300 px-2 py-3 align-top">
                <button type="button" onClick={() => changeSort(column.key)} className="flex w-full items-start justify-between gap-1 text-left font-semibold hover:text-indigo-700" aria-label={`Ordina per ${column.label}`}>
                  <span className="min-w-0 whitespace-normal break-words leading-tight">{column.label}</span><span aria-hidden="true" className="shrink-0 text-slate-500">{sort.key === column.key ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span>
                </button>
              </th>)}</tr></thead>
            <tbody>
              {!sortedClients.length && <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-slate-600">Nessun cliente con almeno un’ora lavorata nel mese.</td></tr>}
              {sortedClients.map(row => <tr key={row.id} style={{ backgroundColor: remainderColor(row) }} className="border-b border-slate-300 last:border-b-0">
                {columns.map(column => <td key={column.key} className={`px-2 py-3 ${column.key === 'cliente' ? 'break-words font-semibold' : 'whitespace-nowrap tabular-nums'} ${['rimanenza', 'percentualeGuadagno'].includes(column.key) ? 'font-bold' : ''}`}>
                  {column.key === 'cliente' ? <span title={row.cliente}>{shortClientName(row.cliente)}</span>
                    : ['ore', 'imponibile'].includes(column.key) ? <span className="inline-flex items-center gap-1">
                      {formatCell(row[column.key], column.type)}
                      <button type="button" onClick={() => openClientCell(row, column.key)} title={`Rettifica ${column.label} · ${row.cliente}`} aria-label={`Rettifica ${column.label} per ${row.cliente}`} className={`rounded-full p-0.5 hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700 ${(report.rettificheClienti?.some(item => item.clienteId === row.id && item.voce === column.key) || column.key === 'ore' && report.rettificheOreAbbinate?.some(item => item.abbinamenti.some(pair => pair.clienteId === row.id))) ? 'text-indigo-800' : 'text-slate-600'}`}><Info size={17} aria-hidden="true" /></button>
                    </span> : formatCell(row[column.key], column.type)}
                </td>)}
              </tr>)}
            </tbody>
          </table>
        </div>
        {report.costoOrario == null && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Inserisci l’F24 e verifica le ore totali per vedere costo, differenze e rimanenza dei clienti.</p>}
      </section>

      <section aria-label="Resa dei dipendenti" className="space-y-4 border-t border-slate-200 pt-6">
        <div>
          <h2 className="text-xl font-bold">Dipendenti</h2>
          <p className="mt-1 text-sm text-slate-600">Le ore della tabella comprendono lavoro, ferie e permessi; la malattia viene esclusa. La quota di netto attribuita alla malattia passa nel F24C usato per il calcolo. La resa è il valore delle ore presso i clienti meno il costo del dipendente.</p>
        </div>
        <form onSubmit={saveF24c} className="flex flex-wrap items-end gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <label className="text-sm font-semibold text-indigo-900">F24C del mese (€)
            <input type="text" inputMode="decimal" value={f24cInput} onChange={event => setF24cInput(event.target.value)} placeholder="Es. 1500,00" className="mt-1 block w-48 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-base text-slate-900" />
          </label>
          <button type="submit" disabled={savingF24c || !f24cInput.trim()} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{savingF24c ? 'Salvataggio...' : 'Salva F24C'}</button>
          <p className="text-sm text-indigo-900">Salvato solo nel Report · {report.f24c == null ? 'Da inserire' : euro(report.f24c)}</p>
        </form>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold">Costo malattia trasferito</p><p className="mt-1 text-xl font-bold">{euro(report.costoMalattia)}</p><p className="mt-1 text-xs text-slate-600">Somma di netto senza CC ÷ ore totali del dipendente × ore di malattia.</p></div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4"><p className="text-sm font-semibold">F24C usato nel calcolo</p><p className="mt-1 text-xl font-bold">{report.f24cConMalattia == null ? '—' : euro(report.f24cConMalattia)}</p><p className="mt-1 text-xs text-slate-600">{report.f24c == null ? 'Inserisci F24C' : `${euro(report.f24c)} + ${euro(report.costoMalattia)}`}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold">Ore per ripartizione</p><p className="mt-1 text-xl font-bold">{ore(report.oreRipartizioneDipendenti)} h</p><p className="mt-1 text-xs text-slate-600">{ore(report.oreTotali)} h totali − {ore(report.oreMalattia)} h malattia</p></div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-sm">
          <table className="w-full min-w-[1100px] table-fixed border-collapse text-left text-sm">
            <colgroup><col className="w-[22%]" /><col className="w-[13%]" /><col className="w-[18%]" /><col className="w-[26%]" /><col className="w-[21%]" /></colgroup>
            <thead className="bg-slate-100 text-slate-900"><tr>
              {employeeColumns.map(column => <th key={column.key} scope="col" aria-sort={employeeSort.key === column.key ? employeeSort.direction === 'asc' ? 'ascending' : 'descending' : 'none'} className="border-b border-slate-300 px-3 py-3">
                <button type="button" onClick={() => changeEmployeeSort(column.key)} aria-label={`Ordina per ${column.label}`} className="flex w-full items-start justify-between gap-1 text-left font-semibold hover:text-indigo-700">
                  <span className="min-w-0 whitespace-normal leading-tight">{column.label}</span><span aria-hidden="true" className="shrink-0 text-slate-500">{employeeSort.key === column.key ? employeeSort.direction === 'asc' ? '↑' : '↓' : '↕'}</span>
                </button>
              </th>)}
            </tr></thead>
            <tbody>
              {!sortedEmployees.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-600">Nessun dipendente nell’elaborato del mese.</td></tr>}
              {sortedEmployees.map((row, index) => <tr key={row.id} className={`border-b border-slate-200 last:border-b-0 ${index % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                <td className="px-3 py-3 font-semibold">{row.dipendente}</td>
                <td className="px-3 py-3 tabular-nums"><span className="inline-flex items-center gap-1">{ore(row.ore)} h
                  <button type="button" onClick={() => openEmployeeCell(row, 'ore')} title={`Rettifica ore totali · ${row.dipendente}`} aria-label={`Rettifica ore totali per ${row.dipendente}`} className={`rounded-full p-0.5 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700 ${(report.rettificheDipendenti?.some(item => item.dipendenteId === row.id && item.voce === 'ore') || report.rettificheOreAbbinate?.some(item => item.abbinamenti.some(pair => pair.dipendenteId === row.id))) ? 'text-indigo-800' : 'text-slate-600'}`}><Info size={17} aria-hidden="true" /></button>
                </span>{row.oreMalattia > 0 && <span className="mt-0.5 block text-xs text-slate-600">{ore(row.oreTotaliConMalattia)} h totali − {ore(row.oreMalattia)} h malattia</span>}</td>
                <td className="px-3 py-3 tabular-nums">
                  <span className="font-semibold">{euro(row.stipendio)}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-600">{euro(row.nettoBusta)} netto busta
                    <button type="button" onClick={() => openEmployeeCell(row, 'netto')} title={`Rettifica netto busta · ${row.dipendente}`} aria-label={`Rettifica netto busta per ${row.dipendente}`} className={`rounded-full p-0.5 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700 ${report.rettificheDipendenti?.some(item => item.dipendenteId === row.id && item.voce === 'netto') ? 'text-indigo-800' : 'text-slate-600'}`}><Info size={17} aria-hidden="true" /></button>
                  </span>
                  <span className="block text-xs text-slate-600">+ {euro(row.cc)} CC</span>
                  {row.quotaMalattia > 0 && <span className="block text-xs text-slate-600">− {euro(row.quotaMalattia)} malattia trasferita</span>}
                </td>
                <td className="px-3 py-3 font-semibold tabular-nums">
                  {row.costoOrario == null ? '—' : `${euro(row.costoOrario)} / h`}
                  <HourlyCostBreakdown row={row} report={report} />
                </td>
                <td className={`px-3 py-3 font-bold tabular-nums ${row.resa == null ? 'text-slate-500' : row.resa >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                  {row.resa == null ? '—' : `${row.resa > 0 ? '+' : ''}${euro(row.resa)}`}
                  {row.resa != null && <span className="mt-0.5 block text-xs font-normal text-slate-600">{ore(row.oreClienti)} h clienti: {euro(row.valoreClienti)} − {euro(row.costoDipendente)} costo</span>}
                  {row.clientiSenzaTariffa?.length > 0 && <span className="mt-0.5 block whitespace-normal text-xs font-normal text-amber-800">Tariffa mancante: {row.clientiSenzaTariffa.join(', ')}</span>}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {report.f24c == null && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Inserisci l’F24C per calcolare costo orario e resa dei dipendenti.</p>}
      </section>
    </>}
    {report && pairedCell && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="report-ore-abbinate-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="report-ore-abbinate-title" className="text-xl font-bold">Ore abbinate · {pairedCell.name}</h2>
          <button type="button" onClick={() => setPairedCell(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-200">Chiudi</button>
        </div>
        <p className="mt-3 text-sm text-slate-600">Ore attuali: {ore(pairedRow?.ore)} h. Indica le nuove ore e ripartisci la differenza tra {pairedCell.origine === 'cliente' ? 'i dipendenti' : 'i clienti'} coinvolti. Questa rettifica riguarda le ore presso i clienti; ferie, permessi e malattia restano fissi.</p>
        {report.rettificheClienti?.some(item => item.voce === 'ore') || report.rettificheDipendenti?.some(item => item.voce === 'ore')
          ? <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Sono presenti vecchie rettifiche ore senza abbinamento. Eliminale dal riquadro Ore totali prima di creare una rettifica collegata.</p> : null}
        <form onSubmit={savePairedHours} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">Nuove ore nel Report
            <input type="text" inputMode="decimal" value={pairedValue} onChange={event => setPairedValue(event.target.value)} autoFocus className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
          </label>
          <div>
            <p className="text-sm font-semibold">{pairedDeltaCent < 0 ? 'Ore da togliere' : 'Ore da aggiungere'}: {Number.isFinite(pairedDeltaCent) ? ore(Math.abs(pairedDeltaCent / 100)) : '—'} h</p>
            <p className="mt-1 text-xs text-slate-600">Inserisci nelle caselle solo le ore da attribuire a ciascuna riga. La somma deve coincidere con la differenza.</p>
            <p className={`mt-1 text-xs font-semibold ${pairedAllocatedCent === Math.abs(pairedDeltaCent) ? 'text-emerald-700' : 'text-amber-800'}`}>Ore distribuite: {ore(pairedAllocatedCent / 100)} h su {Number.isFinite(pairedDeltaCent) ? ore(Math.abs(pairedDeltaCent / 100)) : '—'} h</p>
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {!pairedPartners?.length && <p className="text-sm text-amber-800">Nessuna riga con ore abbinate disponibile per questa sottrazione.</p>}
              {pairedPartners?.map(row => {
                const pair = report.abbinamentiOre?.find(item => pairedCell.origine === 'cliente'
                  ? item.clienteId === pairedCell.id && item.dipendenteId === row.id
                  : item.dipendenteId === pairedCell.id && item.clienteId === row.id);
                return <label key={row.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">{pairedCell.origine === 'cliente' ? row.dipendente : row.cliente} <span className="text-slate-500">({ore(pair?.ore || 0)} h abbinate)</span></span>
                  <input type="text" inputMode="decimal" value={pairedAllocations[row.id] || ''} onChange={event => setPairedAllocations(current => ({ ...current, [row.id]: event.target.value }))} placeholder="0" aria-label={`Ore da ${pairedDeltaCent < 0 ? 'togliere a' : 'aggiungere a'} ${pairedCell.origine === 'cliente' ? row.dipendente : row.cliente}`} className="w-24 shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-right" />
                </label>;
              })}
            </div>
          </div>
          <label className="block text-sm font-semibold">Nota
            <textarea value={pairedNote} onChange={event => setPairedNote(event.target.value)} maxLength={500} rows={2} placeholder="Motivo della rettifica" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
          </label>
          {pairedError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{pairedError}</p>}
          <button type="submit" disabled={pairedSaving || !pairedNote.trim() || !pairedValue.trim() || !pairedDeltaCent || pairedAllocatedCent !== Math.abs(pairedDeltaCent)} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{pairedSaving ? 'Salvataggio...' : 'Salva ore abbinate'}</button>
        </form>
        {!!pairedHistory?.length && <div className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="font-semibold">Rettifiche collegate</h3>
          <ul className="mt-2 space-y-3">{pairedHistory.map(item => <li key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <p>{item.abbinamenti.filter(pair => pairedCell.origine === 'cliente' ? pair.clienteId === pairedCell.id : pair.dipendenteId === pairedCell.id)
              .map(pair => `${pair.differenza > 0 ? '+' : ''}${ore(pair.differenza)} h · ${pairedCell.origine === 'cliente' ? report.dipendentiDettaglio?.find(row => row.id === pair.dipendenteId)?.dipendente || pair.dipendenteId : report.clientiDettaglio?.find(row => row.id === pair.clienteId)?.cliente || pair.clienteId}`).join(' · ')}</p>
            {pairedNoteEdit === item.id ? <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="min-w-48 flex-1">Nota <input type="text" value={pairedNoteDraft} onChange={event => setPairedNoteDraft(event.target.value)} maxLength={500} className="mt-1 w-full rounded border border-slate-300 px-2 py-1" /></label>
              <button type="button" disabled={pairedSaving || !pairedNoteDraft.trim()} onClick={() => savePairedNote(item.id)} className="rounded bg-indigo-700 px-3 py-1 text-white disabled:opacity-50">Salva nota</button>
            </div> : <p className="mt-1 text-slate-600">{item.nota}</p>}
            <div className="mt-2 flex gap-3">
              <button type="button" onClick={() => { setPairedNoteEdit(item.id); setPairedNoteDraft(item.nota); }} className="font-semibold text-indigo-700">Modifica nota</button>
              <button type="button" disabled={deletingAdjustmentId === `paired:${item.id}`} onClick={() => deleteAdjustment({ pairedId: item.id })} className="font-semibold text-red-700 disabled:opacity-50">Elimina rettifica</button>
            </div>
          </li>)}</ul>
        </div>}
      </div>
    </div>}
    {report && employeeCell && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="report-dipendente-rettifica-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="report-dipendente-rettifica-title" className="text-xl font-bold">{employeeCell.voce === 'ore' ? 'Ore totali' : 'Netto busta paga'} · {employeeCell.dipendente}</h2>
          <button type="button" onClick={() => setEmployeeCell(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-200">Chiudi</button>
        </div>
        <p className="mt-3 text-sm text-slate-600">Valore originale: {employeeCell.voce === 'ore' ? `${ore(employeeCellAdjustment?.valoreBase ?? report.dipendentiDettaglio.find(row => row.id === employeeCell.dipendenteId)?.ore)} h` : euro(employeeCellAdjustment?.valoreBase ?? report.dipendentiDettaglio.find(row => row.id === employeeCell.dipendenteId)?.nettoBusta)}</p>
        <p className="mt-1 text-sm text-slate-600">La modifica vale solo per questo dipendente nel Report di {mesi[mese - 1]} {anno}. La nota può essere modificata o eliminata.</p>
        <form onSubmit={saveEmployeeCell} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">{employeeCell.voce === 'ore' ? 'Ore totali nel Report' : 'Netto busta nel Report (€)'}
            <input type="text" inputMode="decimal" value={employeeValue} onChange={event => setEmployeeValue(event.target.value)} autoFocus className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
          </label>
          <label className="block text-sm font-semibold">Nota
            <textarea value={employeeNote} onChange={event => setEmployeeNote(event.target.value)} maxLength={500} rows={3} placeholder="Motivo della modifica" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
          </label>
          {employeeError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{employeeError}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={employeeSaving || !employeeValue.trim() || !employeeNote.trim()} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{employeeSaving ? 'Salvataggio...' : 'Salva modifica'}</button>
            {employeeCellAdjustment && <button type="button" disabled={deletingAdjustmentId === `employee:${employeeCell.dipendenteId}:${employeeCell.voce}`} onClick={() => deleteAdjustment(employeeCellAdjustment)} className="rounded-lg bg-red-50 px-4 py-2 font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50">Elimina rettifica</button>}
          </div>
        </form>
      </div>
    </div>}
    {report && clientCell && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="report-cliente-rettifica-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="report-cliente-rettifica-title" className="text-xl font-bold">{clientCell.voce === 'ore' ? 'Ore cliente' : 'Imponibile fattura'} · {clientCell.cliente}</h2>
          <button type="button" onClick={() => setClientCell(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-200">Chiudi</button>
        </div>
        <p className="mt-3 text-sm text-slate-600">Valore originale: {clientCell.voce === 'ore' ? `${ore(clientCellAdjustment?.valoreBase ?? report.clientiDettaglio.find(row => row.id === clientCell.clienteId)?.ore)} h` : euro(clientCellAdjustment?.valoreBase ?? report.clientiDettaglio.find(row => row.id === clientCell.clienteId)?.imponibile)}</p>
        <p className="mt-1 text-sm text-slate-600">La modifica vale solo per questo cliente nel Report di {mesi[mese - 1]} {anno}. Puoi mantenere una nota, modificarla o eliminare la rettifica.</p>
        <form onSubmit={saveClientCell} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">{clientCell.voce === 'ore' ? 'Ore nel Report' : 'Imponibile nel Report (€)'}
            <input type="text" inputMode="decimal" value={clientValue} onChange={event => setClientValue(event.target.value)} autoFocus className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
          </label>
          <label className="block text-sm font-semibold">Nota
            <textarea value={clientNote} onChange={event => setClientNote(event.target.value)} maxLength={500} rows={3} placeholder="Motivo della modifica" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
          </label>
          {clientError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{clientError}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={clientSaving || !clientValue.trim() || !clientNote.trim()} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{clientSaving ? 'Salvataggio...' : 'Salva modifica'}</button>
            {clientCellAdjustment && <button type="button" disabled={deletingAdjustmentId === `client:${clientCell.clienteId}:${clientCell.voce}`} onClick={() => deleteAdjustment(clientCellAdjustment)} className="rounded-lg bg-red-50 px-4 py-2 font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50">Elimina rettifica</button>}
          </div>
        </form>
      </div>
    </div>}
    {report && adjustmentField && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="report-rettifica-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="report-rettifica-title" className="text-xl font-bold">Rettifica · {adjustmentLabels[adjustmentField]}</h2>
          <button type="button" onClick={() => setAdjustmentField(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-200">Chiudi</button>
        </div>
        <p className="mt-3 text-sm text-slate-600">Valore originale: {adjustmentDisplay(report.valoriBase[adjustmentField])} · Nel Report: {adjustmentDisplay(report[adjustmentField])}</p>
        <p className="mt-1 text-sm text-slate-600">La rettifica modifica solo questo Report per {mesi[mese - 1]} {anno}.</p>
        {adjustmentField === 'imponibileClienti' && <p className="mt-1 text-sm text-slate-600">Questa rettifica complessiva non viene attribuita ai singoli clienti. Per modificarne uno usa la “i” nella tabella.</p>}
        <form onSubmit={saveAdjustment} className="mt-5 space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Operazione</legend>
            <div className="flex gap-5">
              <label className="flex items-center gap-2"><input type="radio" name="report-operazione" checked={adjustmentOperation === 'aggiungi'} onChange={() => setAdjustmentOperation('aggiungi')} /> Aggiungi</label>
              <label className="flex items-center gap-2"><input type="radio" name="report-operazione" checked={adjustmentOperation === 'togli'} onChange={() => setAdjustmentOperation('togli')} /> Togli</label>
            </div>
          </fieldset>
          <label className="block text-sm font-semibold">{adjustmentIsHours ? 'Ore' : 'Importo (€)'}
            <input type="text" inputMode="decimal" value={adjustmentValue} onChange={event => setAdjustmentValue(event.target.value)} placeholder={adjustmentIsHours ? 'Es. 2,5' : 'Es. 100,00'} autoFocus className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
          </label>
          <label className="block text-sm font-semibold">Nota
            <textarea value={adjustmentNote} onChange={event => setAdjustmentNote(event.target.value)} maxLength={500} rows={3} placeholder="Motivo della rettifica" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
          </label>
          {adjustmentError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{adjustmentError}</p>}
          <button type="submit" disabled={adjustmentSaving || !adjustmentValue.trim() || !adjustmentNote.trim()} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{adjustmentSaving ? 'Salvataggio...' : 'Salva rettifica'}</button>
        </form>
      </div>
    </div>}
  </main>;
}
