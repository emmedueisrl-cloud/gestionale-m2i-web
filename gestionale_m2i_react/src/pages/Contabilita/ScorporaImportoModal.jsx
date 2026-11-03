import { useEffect, useState } from 'react';

const centesimi = value => Math.round(Number(String(value || '').replace(',', '.')) * 100);
const euro = cent => (cent / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

export default function ScorporaImportoModal({ row, onClose, onSave }) {
  const [righe, setRighe] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setRighe((row?.scorporiFattura || []).map(line => ({ descrizione: line.descrizione, imponibile: String(line.imponibile) })));
    setError('');
  }, [row]);
  if (!row) return null;

  const totale = centesimi(row.imponibile);
  const scorporato = righe.reduce((sum, line) => sum + (centesimi(line.imponibile) || 0), 0);
  const residuo = totale - scorporato;
  const update = (index, field, value) => setRighe(current => current.map((line, i) => i === index ? { ...line, [field]: value } : line));

  const save = async event => {
    event.preventDefault();
    if (!righe.length && !row.scorporiFattura?.length) {
      setError('Aggiungi almeno una riga con descrizione e imponibile.');
      return;
    }
    if (righe.some(line => !line.descrizione.trim() || !/^\d{1,9}(?:[.,]\d{1,2})?$/.test(line.imponibile.trim()) || centesimi(line.imponibile) <= 0)) {
      setError('Inserisci descrizione e imponibile positivo per ogni riga.');
      return;
    }
    if (righe.length && residuo !== 0) {
      setError(`Distribuisci tutto l’imponibile: ${residuo > 0 ? `mancano ${euro(residuo)}` : `la somma supera il totale di ${euro(-residuo)}`}.`);
      return;
    }
    setBusy(true); setError('');
    try { await onSave(righe); onClose(); }
    catch (err) { setError(err.message || 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="presentation">
    <form onSubmit={save} role="dialog" aria-modal="true" aria-label={`Scorpora importo di ${row.ragioneSociale}`} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-2xl space-y-4">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Scorpora importo</h2><p className="text-sm text-slate-600">{row.ragioneSociale} · imponibile fattura {euro(totale)}</p></div><button type="button" onClick={onClose} disabled={busy} className="rounded border border-slate-300 px-3 py-1">Chiudi</button></div>
      <p className="rounded-lg bg-slate-100 p-3 text-sm">Imponibile ancora da distribuire: <strong className={residuo === 0 ? 'text-emerald-800' : 'text-red-800'}>{euro(residuo)}</strong>{residuo === 0 && <span className="block text-emerald-800">Tutto l’imponibile è distribuito nelle righe qui sotto.</span>}</p>
      <p className="text-sm text-slate-600">Le righe cambiano solo l’XML della fattura. Il totale dell’elaborato mensile resta invariato.</p>
      {righe.map((line, index) => <div key={index} className="grid gap-2 rounded-lg border border-slate-300 p-3 sm:grid-cols-[1fr_150px_auto]">
        <label className="text-sm">Descrizione riga<input required maxLength="1000" value={line.descrizione} onChange={e => update(index, 'descrizione', e.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white p-2" /></label>
        <label className="text-sm">Imponibile (€)<input required inputMode="decimal" value={line.imponibile} onChange={e => update(index, 'imponibile', e.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white p-2" /></label>
        <button type="button" onClick={() => setRighe(current => current.filter((_, i) => i !== index))} className="self-end rounded border border-red-300 px-3 py-2 text-red-800">Rimuovi</button>
      </div>)}
      <button type="button" disabled={righe.length >= 20} onClick={() => setRighe(current => [...current, { descrizione: '', imponibile: '' }])} className="rounded border border-indigo-400 px-3 py-2 text-indigo-800 disabled:opacity-50">+ Aggiungi riga</button>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="rounded border border-slate-300 px-4 py-2">Annulla</button><button type="submit" disabled={busy} className="rounded bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Salvataggio...' : !righe.length && row.scorporiFattura?.length ? 'Rimuovi scorporo' : 'Salva righe fattura'}</button></div>
    </form>
  </div>;
}
