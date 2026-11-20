import { useState } from 'react';
import { workflowRequest } from '../../api/workflowElaborati';

const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const canSelect = row => ['pronta', 'scadenza'].includes(row.stato);

export default function ImportaFattureStoriche({ onClose, onImported }) {
  const [zip, setZip] = useState(null);
  const [xml, setXml] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [dueDates, setDueDates] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const payload = () => {
    const data = new FormData();
    if (zip) data.append('zip', zip);
    else { if (xml) data.append('xml', xml); if (pdf) data.append('pdf', pdf); }
    return data;
  };
  const reset = () => { setPreview(null); setSelected(new Set()); setDueDates({}); setResult(null); setError(''); };
  const clearFiles = () => { setZip(null); setXml(null); setPdf(null); setFileKey(current => current + 1); reset(); };
  const analyze = async () => {
    if (!zip && (!xml || !pdf)) { setError('Seleziona uno ZIP con XML e PDF, oppure un XML e il relativo PDF.'); return; }
    setBusy(true); setError(''); setResult(null);
    try {
      const data = await workflowRequest('contabilita/incassi-insoluti/storiche/anteprima', { method: 'POST', body: payload() });
      setPreview(data); setSelected(new Set()); setDueDates({});
    } catch (cause) { setError(cause.message || 'Impossibile leggere i documenti.'); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    const chosen = preview?.fatture.filter(row => selected.has(row.id)).map(row => ({ id: row.id, scadenza: dueDates[row.id] || row.scadenza }));
    if (!chosen?.length) { setError('Seleziona le fatture che risultano ancora da incassare.'); return; }
    if (chosen.some(row => !/^\d{4}-\d{2}-\d{2}$/.test(row.scadenza || ''))) {
      setError('Inserisci una data di scadenza per ogni fattura selezionata.'); return;
    }
    setBusy(true); setError('');
    try {
      const data = payload(); data.append('selected', JSON.stringify(chosen));
      const outcome = await workflowRequest('contabilita/incassi-insoluti/storiche/conferma', { method: 'POST', body: data });
      setResult(outcome); setSelected(new Set()); await onImported();
    } catch (cause) { setError(cause.message || 'Importazione non riuscita.'); }
    finally { setBusy(false); }
  };
  const toggle = id => setSelected(current => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const creditCount = preview?.fatture.filter(row => row.stato === 'nota_credito').length || 0;
  const duplicateCount = preview?.fatture.filter(row => row.stato === 'presente').length || 0;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="importa-storiche-title" className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><h2 id="importa-storiche-title" className="text-xl font-bold">Importa fatture storiche da incassare</h2>
        <p className="mt-1 text-sm text-slate-600">Carica l’export XML + PDF. I clienti mancanti verranno creati come non attivi.</p></div>
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg bg-slate-100 px-4 py-2 font-semibold">Chiudi</button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">ZIP con XML e PDF<input key={`zip-${fileKey}`} type="file" accept=".zip" className="mt-1 block w-full text-sm" onChange={event => { setZip(event.target.files?.[0] || null); setXml(null); setPdf(null); reset(); }} /></label>
        <label className="text-sm font-semibold">Oppure file XML<input key={`xml-${fileKey}`} type="file" accept=".xml" className="mt-1 block w-full text-sm" disabled={Boolean(zip)} onChange={event => { setXml(event.target.files?.[0] || null); reset(); }} /></label>
        <label className="text-sm font-semibold">E relativo PDF<input key={`pdf-${fileKey}`} type="file" accept=".pdf" className="mt-1 block w-full text-sm" disabled={Boolean(zip)} onChange={event => { setPdf(event.target.files?.[0] || null); reset(); }} /></label>
      </div>
      <div className="mt-4 flex gap-3"><button type="button" disabled={busy} onClick={analyze} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Lettura...' : 'Leggi e mostra anteprima'}</button>
        <button type="button" disabled={busy} onClick={clearFiles} className="rounded-lg bg-slate-100 px-4 py-2 font-semibold disabled:opacity-50">Svuota selezione</button></div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {preview && <div className="mt-6 space-y-4">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Seleziona solo le fatture realmente insolute.</strong> XML e PDF non attestano se un pagamento è già avvenuto. Le fatture importate partiranno con incassato pari a zero; potrai poi registrare eventuali acconti.
          {creditCount > 0 && <p className="mt-2">{creditCount} note di credito rilevate e ignorate. Non saranno salvate.</p>}
        </div>
        <p className="text-sm font-semibold">{preview.fatture.length} documenti · {duplicateCount} già presenti · {creditCount} note di credito · {preview.pdfSenzaXml} PDF senza XML</p>
        <div className="max-h-[45vh] overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[900px] text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr>
          <th className="p-3">Importa</th><th className="p-3">Fattura</th><th className="p-3">Cliente</th><th className="p-3">Data</th><th className="p-3">Scadenza</th><th className="p-3">Totale</th><th className="p-3">Esito</th></tr></thead>
          <tbody>{preview.fatture.map(row => <tr key={row.id} className="border-t border-slate-200">
            <td className="p-3"><input type="checkbox" aria-label={`Importa fattura ${row.numero}`} disabled={!canSelect(row) || busy} checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td>
            <td className="p-3 font-semibold">{row.numero || row.xml}<div className="text-xs text-slate-500">{row.tipoDocumento}</div></td>
            <td className="p-3">{row.cliente || '—'}{row.nuovoCliente && <div className="text-xs font-semibold text-indigo-700">Nuova anagrafica non attiva</div>}</td>
            <td className="p-3">{row.data || '—'}</td>
            <td className="p-3">{canSelect(row) ? <input type="date" value={dueDates[row.id] ?? row.scadenza ?? ''} onChange={event => setDueDates(current => ({ ...current, [row.id]: event.target.value }))} className="rounded border border-slate-300 p-1" /> : row.scadenza || '—'}</td>
            <td className="p-3 whitespace-nowrap">{row.totale == null ? '—' : euro(row.totale)}</td>
            <td className="p-3"><span className={row.stato === 'pronta' ? 'font-semibold text-emerald-800' : row.stato === 'presente' ? 'font-semibold text-slate-600' : 'font-semibold text-amber-800'}>{row.stato === 'pronta' ? 'Pronta' : row.stato === 'presente' ? 'Già registrata' : row.stato === 'nota_credito' ? 'Nota di credito' : 'Da verificare'}</span>{row.motivo && <div className="text-xs text-slate-600">{row.motivo}</div>}</td>
          </tr>)}</tbody></table></div>
        <button type="button" disabled={busy || !selected.size} onClick={confirm} className="rounded-lg bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">Importa {selected.size} fatture selezionate</button>
      </div>}
      {result && <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        Importate: {result.importate}. Già presenti ignorate: {result.ignorate}. Nuovi clienti non attivi: {result.clientiCreati}.
        {result.risultati.some(row => row.esito === 'errore') && <ul className="mt-2 list-disc pl-5">{result.risultati.filter(row => row.esito === 'errore').map(row => <li key={row.id}>{row.numero}: {row.errore}</li>)}</ul>}
      </div>}
    </div>
  </div>;
}
