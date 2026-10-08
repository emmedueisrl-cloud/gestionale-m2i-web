import { useEffect, useState } from 'react';
import { workflowRequest } from '../../api/workflowElaborati';

const euro = amount => Number(amount || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const selectable = (row, overrides) => row.stato !== 'presente' && !row.incongruenze.some(issue => issue.code === 'xml') &&
  (!row.incongruenze.length || overrides[row.id]?.reviewed);

export default function ImportaFattureArubaZip({ mese, anno, onChanged }) {
  const [open, setOpen] = useState(false);
  const [xmlZip, setXmlZip] = useState(null);
  const [pdfZip, setPdfZip] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [overrides, setOverrides] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => { setPreview(null); setSelected(new Set()); setOverrides({}); setActiveId(null); setResult(null); }, [mese, anno, xmlZip, pdfZip]);

  const payload = () => {
    const form = new FormData();
    form.append('xml', xmlZip); form.append('pdf', pdfZip);
    form.append('mese', String(mese)); form.append('anno', String(anno));
    return form;
  };

  const analyze = async () => {
    if (!xmlZip || !pdfZip) { setError('Seleziona entrambi gli ZIP di Aruba.'); return; }
    setBusy(true); setError(''); setResult(null);
    try {
      const data = await workflowRequest('contabilita/fatture/importazione-zip/anteprima', { method: 'POST', body: payload() });
      setPreview(data);
      setSelected(new Set(data.fatture.filter(row => row.selezionata).map(row => row.id)));
      setOverrides({});
    } catch (cause) { setError(cause.message || 'Impossibile analizzare gli archivi.'); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!selected.size) return;
    const choices = [...selected].map(id => {
      const row = preview.fatture.find(item => item.id === id);
      return { id, clienteId: overrides[id]?.clienteId || row?.clienteId,
        pdfId: overrides[id]?.pdfId || row?.pdfId,
        extra: overrides[id]?.extra === true, creditMode: overrides[id]?.creditMode || null,
        reviewed: overrides[id]?.reviewed === true };
    });
    if (choices.some(choice => !choice.clienteId || !choice.pdfId)) {
      setError('Per ogni fattura selezionata scegli un cliente e un PDF.');
      return;
    }
    if (choices.some(choice => {
      const row = preview.fatture.find(item => item.id === choice.id);
      const client = preview.clientiDisponibili.find(item => String(item.id) === String(choice.clienteId));
      return row?.tipoDocumento === 'TD04' && !choice.creditMode || !client?.nelMese && !choice.extra;
    })) {
      setError('Per ogni nota di credito o cliente fuori mese completa la scelta nella sezione “Risolvi”.');
      return;
    }
    setBusy(true); setError(''); setResult(null);
    try {
      const form = payload();
      form.append('selected', JSON.stringify(choices));
      const outcome = await workflowRequest('contabilita/fatture/importazione-zip/conferma', { method: 'POST', body: form });
      setResult(outcome);
      await onChanged();
      const refreshed = await workflowRequest('contabilita/fatture/importazione-zip/anteprima', { method: 'POST', body: payload() });
      setPreview(refreshed);
      setSelected(new Set());
      setActiveId(null);
    } catch (cause) { setError(cause.message || 'Importazione non riuscita.'); }
    finally { setBusy(false); }
  };

  const toggle = id => setSelected(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const activeRow = preview?.fatture.find(row => row.id === activeId);
  const clientIdFor = row => overrides[row.id]?.clienteId || row.clienteId || '';
  const pdfIdFor = row => overrides[row.id]?.pdfId || row.pdfId || '';
  const activeClientInMonth = preview?.clientiDisponibili.find(client => String(client.id) === String(activeRow && clientIdFor(activeRow)))?.nelMese;
  const setOverride = (id, field, value) => setOverrides(current => ({ ...current,
    [id]: { ...current[id], [field]: value } }));

  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white hover:bg-indigo-800">Importa ZIP Aruba (XML + PDF)</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="aruba-zip-title" className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><h2 id="aruba-zip-title" className="text-xl font-bold">Importa fatture Aruba · {mese}/{anno}</h2><p className="mt-1 text-sm text-slate-600">Carica gli ZIP XML e PDF scaricati dalla stessa selezione di fatture. Il mese indicato è quello di riferimento dell’elaborato, anche se la data fattura è successiva.</p></div><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded bg-slate-100 px-3 py-2 font-semibold hover:bg-slate-200">Chiudi</button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">ZIP XML<input type="file" accept=".zip,application/zip" onChange={event => setXmlZip(event.target.files?.[0] || null)} className="mt-2 block w-full rounded border border-slate-300 p-2" /></label>
          <label className="block text-sm font-semibold">ZIP PDF<input type="file" accept=".zip,application/zip" onChange={event => setPdfZip(event.target.files?.[0] || null)} className="mt-2 block w-full rounded border border-slate-300 p-2" /></label>
        </div>
        <button type="button" disabled={busy || !xmlZip || !pdfZip} onClick={analyze} className="mt-4 rounded bg-slate-800 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Analisi...' : 'Controlla abbinamenti'}</button>
        {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-800">{error}</p>}
        {result && <div role="status" className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-900"><p>Importate o aggiornate: {result.importate}. Da verificare: {result.daVerificare}. Errori: {result.errori}.</p>{result.risultati.filter(row => row.errore || row.esito === 'da_verificare').map(row => <p key={row.id} className="mt-1 text-sm">{row.numero || row.id}: {row.errore || 'riconciliazione contabile da verificare.'}</p>)}</div>}
        {preview && <>{preview.archiviInvertiti && <p role="status" className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Gli ZIP sono stati selezionati nei campi invertiti. Ho riconosciuto XML e PDF dal contenuto e corretto l’abbinamento automaticamente.</p>}<p className="mt-5 text-sm font-semibold">{preview.fatture.length} XML analizzati · {preview.pdfSenzaXml} PDF senza XML · {preview.fatture.filter(row => row.incongruenze.length).length} documenti con incongruenze. Le righe senza incongruenze sono già selezionate; apri “Risolvi” per le altre.</p>
          {preview.pdfSenzaXmlDettaglio.length > 0 && <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm"><p className="font-bold">PDF senza XML abbinato</p><ul className="mt-1 list-inside list-disc">{preview.pdfSenzaXmlDettaglio.map(pdf => <li key={pdf.id}>{pdf.nome}</li>)}</ul></div>}
          <div className="mt-3 max-h-[45vh] overflow-auto rounded-lg border border-slate-300"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-3">Importa</th><th className="p-3">XML</th><th className="p-3">Cliente nel gestionale</th><th className="p-3">Totale</th><th className="p-3">PDF associato</th><th className="p-3">Incongruenze</th><th className="p-3">Scelta</th></tr></thead><tbody>{preview.fatture.map(row => <tr key={row.id} className="border-t border-slate-200"><td className="p-3"><input type="checkbox" aria-label={`Importa documento ${row.numero || row.id}`} disabled={!selectable(row, overrides) || busy} checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td><td className="p-3"><div className="font-semibold">{row.tipoDocumento === 'TD04' ? 'Nota di credito' : 'Fattura'} {row.numero || '—'}</div><div>{row.data || '—'} · {row.clienteXml || 'Cliente non indicato'}</div><div className="max-w-48 truncate text-xs text-slate-500" title={row.xml || ''}>{row.xml}</div></td><td className="p-3"><div>{preview.clientiDisponibili.find(client => String(client.id) === String(clientIdFor(row)))?.nome || 'Da scegliere'}</div>{row.abbinamentoFiscale && <div className="mt-1 text-xs font-semibold text-emerald-800">Associato tramite {row.abbinamentoFiscale}</div>}</td><td className="p-3">{row.importo == null ? '—' : euro(row.importo)}</td><td className="max-w-56 truncate p-3" title={preview.pdfDisponibili.find(pdf => pdf.id === pdfIdFor(row))?.nome || ''}>{preview.pdfDisponibili.find(pdf => pdf.id === pdfIdFor(row))?.nome || 'Da scegliere'}</td><td className="p-3">{row.incongruenze.length ? <ul className="list-inside list-disc text-amber-900">{row.incongruenze.map(issue => <li key={issue.code}>{issue.message}</li>)}</ul> : row.stato === 'presente' ? 'Già presente' : 'Nessuna'}</td><td className="p-3"><button type="button" onClick={() => setActiveId(row.id)} className="rounded bg-slate-100 px-3 py-2 font-semibold hover:bg-slate-200">Risolvi</button></td></tr>)}</tbody></table></div>
          {activeRow && <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4"><h3 className="font-bold">Scelte per {activeRow.tipoDocumento === 'TD04' ? 'nota di credito' : 'fattura'} {activeRow.numero}</h3><p className="mt-1 text-sm">Cliente XML: {activeRow.clienteXml || '—'} · Partita IVA: {activeRow.partitaIvaXml || '—'} · Codice fiscale: {activeRow.codiceFiscaleXml || '—'}</p>{activeRow.abbinamentoFiscale && <p className="mt-1 text-sm font-semibold text-emerald-800">Cliente associato tramite {activeRow.abbinamentoFiscale}.</p>}<div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-sm font-semibold">Cliente del gestionale<select value={clientIdFor(activeRow)} onChange={event => setOverride(activeRow.id, 'clienteId', event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white p-2"><option value="">Scegli cliente</option>{preview.clientiDisponibili.map(client => <option key={client.id} value={client.id}>{client.nome} · P.IVA {client.partitaIva || '—'} · CF {client.codiceFiscale || '—'}{client.nelMese ? ' · nel mese' : ' · fuori mese'}</option>)}</select></label><label className="text-sm font-semibold">PDF da allegare<select value={pdfIdFor(activeRow)} onChange={event => setOverride(activeRow.id, 'pdfId', event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white p-2"><option value="">Scegli PDF</option>{preview.pdfDisponibili.map(pdf => <option key={pdf.id} value={pdf.id}>{pdf.nome}</option>)}</select></label></div>{activeRow.tipoDocumento === 'TD04' && <label className="mt-3 block text-sm font-semibold">Trattamento della nota di credito<select value={overrides[activeRow.id]?.creditMode || ''} onChange={event => setOverride(activeRow.id, 'creditMode', event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white p-2"><option value="">Scegli trattamento</option><option value="deduci">Riduce il fatturato del mese</option><option value="solo_allegato">Solo allegato separato, senza effetto sui totali</option></select></label>}{activeClientInMonth === false && <label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={overrides[activeRow.id]?.extra === true} onChange={event => setOverride(activeRow.id, 'extra', event.target.checked)} />Aggiungi come documento extra del mese, fuori dall’elaborato</label>}<div className="mt-3 flex gap-2"><button type="button" onClick={() => { setOverride(activeRow.id, 'reviewed', true); setSelected(current => new Set(current).add(activeRow.id)); setActiveId(null); }} disabled={!clientIdFor(activeRow) || !pdfIdFor(activeRow) || activeRow.tipoDocumento === 'TD04' && !overrides[activeRow.id]?.creditMode || activeClientInMonth === false && !overrides[activeRow.id]?.extra} className="rounded bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Seleziona questo documento</button><button type="button" onClick={() => setActiveId(null)} className="rounded bg-white px-4 py-2 font-semibold">Chiudi</button></div></div>}
          <div className="mt-4 flex justify-end"><button type="button" disabled={busy || !selected.size} onClick={confirm} className="rounded bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Importazione...' : `Importa ${selected.size} fatture selezionate`}</button></div>
        </>}
      </div>
    </div>}
  </>;
}
