import { useEffect, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { workflowRequest } from '../../api/workflowElaborati';

const nomeDipendente = dipendente => dipendente.nomeCompleto || `${dipendente.cognome} ${dipendente.nome}`;

export default function CaricaBusteElaborato({ mese, anno, buste, onChanged }) {
  const [aperto, setAperto] = useState(false);
  const [files, setFiles] = useState([]);
  const [anteprima, setAnteprima] = useState(null);
  const [dipendenti, setDipendenti] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    workflowRequest('contabilita/dipendenti/anagrafica').then(data => {
      if (active) setDipendenti(data || []);
    }).catch(err => {
      if (active) setError(err.message || 'Impossibile caricare i dipendenti.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setAperto(false);
    setFiles([]);
    setAnteprima(null);
    setError('');
    setMessage('');
  }, [mese, anno]);

  const dipendentiDisponibili = dipendenti.filter(d => String(d.stato || '').trim().toLowerCase() !== 'in prova');
  const dipendentePerId = new Map(dipendentiDisponibili.map(d => [String(d.id), d]));
  const bustePerDipendente = new Set(buste.map(b => String(b.dipendente_id)));
  const duplicati = anteprima?.filter(row => row.dipendenteId && bustePerDipendente.has(String(row.dipendenteId))) || [];
  const validi = anteprima?.length > 0 && !duplicati.length && new Set(anteprima.map(row => row.dipendenteId)).size === anteprima.length && anteprima.every(row =>
    dipendentePerId.has(String(row.dipendenteId)) && row.extractedNetto !== '' && row.extractedNetto != null && Number.isFinite(Number(String(row.extractedNetto).replace(',', '.')))
  );

  const analizza = async () => {
    if (!files.length) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const form = new FormData();
      files.forEach(file => form.append('files', file));
      const result = await workflowRequest('buste-paga/upload', { method: 'POST', body: form });
      setAnteprima(result.files.map(row => ({ ...row, updateCF: false })));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const conferma = async () => {
    if (!validi) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await workflowRequest('buste-paga/conferma', { method: 'POST', body: JSON.stringify({ bustePaga: anteprima, mese, anno }) });
      await onChanged();
      setAperto(false); setFiles([]); setAnteprima(null);
      setMessage(`${result.saved} ${result.saved === 1 ? 'busta paga caricata' : 'buste paga caricate'}. Sono disponibili anche nella sezione Buste Paga.`);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const updateRow = (index, field, value) => setAnteprima(rows => rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  const removeRow = index => setAnteprima(rows => rows.filter((_, i) => i !== index));
  const close = () => { if (!busy) { setAperto(false); setAnteprima(null); setFiles([]); setError(''); } };

  return <section aria-label="Caricamento buste paga" className="space-y-3">
    <div className="flex justify-end"><button type="button" onClick={() => { setAperto(true); setError(''); setMessage(''); }} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800">
      <UploadCloud className="h-5 w-5" />Carica buste paga
    </button></div>
    {message && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-800">{message}</p>}
    {aperto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" aria-label="Carica buste paga" className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-6 text-slate-900 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold">Carica buste paga · {mese}/{anno}</h2><p className="mt-1 text-sm text-slate-600">Carica uno o più PDF. Controlla l’associazione e il netto prima del salvataggio.</p></div>
          <button type="button" onClick={close} disabled={busy} aria-label="Chiudi" className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>
        {!anteprima ? <div className="space-y-4">
          <input type="file" accept=".pdf,application/pdf" multiple onChange={event => setFiles(Array.from(event.target.files || []))} className="block w-full rounded-lg border border-slate-300 p-3 text-sm" />
          {files.length > 0 && <p className="text-sm">{files.length} {files.length === 1 ? 'file selezionato' : 'file selezionati'}</p>}
          <button type="button" disabled={busy || !files.length} onClick={analizza} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{busy ? 'Analisi in corso...' : 'Analizza e associa'}</button>
        </div> : <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-300"><table className="w-full min-w-[750px] text-left text-sm">
            <thead className="bg-slate-100"><tr><th className="px-3 py-2">PDF</th><th className="px-3 py-2">C.F. estratto</th><th className="px-3 py-2">Dipendente</th><th className="px-3 py-2">Netto (€)</th><th className="px-3 py-2">C.F.</th><th className="px-3 py-2">Azioni</th></tr></thead>
            <tbody>{anteprima.map((row, index) => {
              const dipendente = dipendentePerId.get(String(row.dipendenteId));
              const cfOk = dipendente?.codiceFiscale?.toUpperCase() === row.extractedCF?.toUpperCase();
              return <tr key={row.tempFilename} className="border-t border-slate-200 align-top">
                <td className="max-w-48 break-words px-3 py-2">{row.originalName}{row.warnings?.map((warning, i) => <p key={i} className="mt-1 text-xs text-amber-800">{warning}</p>)}{bustePerDipendente.has(String(row.dipendenteId)) && <p className="mt-1 text-xs font-semibold text-red-700">Busta già caricata: eliminala prima.</p>}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.extractedCF || '—'}</td>
                <td className="px-3 py-2"><select aria-label={`Dipendente per ${row.originalName}`} value={row.dipendenteId || ''} onChange={event => updateRow(index, 'dipendenteId', event.target.value)} className="w-full rounded border border-slate-300 bg-white p-2"><option value="">Seleziona dipendente</option>{dipendentiDisponibili.map(d => <option key={d.id} value={d.id}>{nomeDipendente(d)} ({d.codiceFiscale || 'CF assente'})</option>)}</select></td>
                <td className="px-3 py-2"><input aria-label={`Netto per ${row.originalName}`} type="number" step="0.01" value={row.extractedNetto ?? ''} onChange={event => updateRow(index, 'extractedNetto', event.target.value)} className="w-28 rounded border border-slate-300 p-2" /></td>
                <td className="px-3 py-2">{cfOk ? <span className="text-emerald-700">CF OK</span> : row.extractedCF && dipendente ? <label className="flex items-center gap-1"><input type="checkbox" checked={row.updateCF} onChange={event => updateRow(index, 'updateCF', event.target.checked)} />Aggiorna DB</label> : '—'}</td>
                <td className="px-3 py-2"><button type="button" onClick={() => removeRow(index)} className="font-semibold text-red-700 hover:underline">Rimuovi</button></td>
              </tr>;
            })}</tbody>
          </table></div>
          {!validi && <p className="text-sm text-amber-800">Assegna un dipendente diverso e un netto valido a ogni PDF. Le buste già presenti vanno eliminate prima del nuovo caricamento.</p>}
          <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => { setAnteprima(null); setFiles([]); setError(''); }} className="rounded-lg bg-slate-100 px-4 py-2 hover:bg-slate-200">Annulla anteprima</button><button type="button" disabled={busy || !validi} onClick={conferma} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{busy ? 'Salvataggio...' : 'Conferma e salva tutto'}</button></div>
        </div>}
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
      </div>
    </div>}
  </section>;
}
