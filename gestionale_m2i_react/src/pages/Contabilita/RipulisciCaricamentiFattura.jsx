import { useEffect, useState } from 'react';
import { workflowRequest } from '../../api/workflowElaborati';

const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

export default function RipulisciCaricamentiFattura({ mese, anno, onClose, onChanged }) {
  const [fatture, setFatture] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setBusy(true);
    workflowRequest(`contabilita/fatture/caricamenti/${anno}/${mese}`)
      .then(rows => { if (active) setFatture(rows); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [mese, anno]);

  const visible = fatture.filter(row => `${row.cliente} ${row.numero}`.toLocaleLowerCase('it-IT')
    .includes(search.trim().toLocaleLowerCase('it-IT')));
  const eligible = visible.filter(row => !row.bloccata).map(row => row.id);
  const toggle = id => { setConfirming(false); setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); };
  const clean = async () => {
    setBusy(true); setError('');
    try {
      const result = await workflowRequest('contabilita/fatture/caricamenti/ripulisci', {
        method: 'POST', body: JSON.stringify({ mese, anno, ids: selected })
      });
      await onChanged(result.rimosse);
      onClose();
    } catch (err) { setError(err.message); setConfirming(false); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
    <div role="dialog" aria-modal="true" aria-label="Ripulisci caricamenti fattura" className="max-h-[90vh] w-full max-w-4xl space-y-4 overflow-y-auto rounded-xl bg-white p-5 text-slate-900 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-xl font-bold">Ripulisci caricamenti fattura</h2><p className="text-sm text-slate-600">{mese}/{anno} · scegli una o più fatture caricate per errore.</p></div>
        <button type="button" disabled={busy} onClick={onClose} className="rounded border border-slate-300 px-3 py-2 disabled:opacity-50">Chiudi</button>
      </div>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">La pulizia rimuove il caricamento e i relativi allegati dal gestionale. Non modifica l’esito della fattura su Aruba o SdI. Le fatture con un pagamento registrato non possono essere selezionate.</p>
      <input type="search" aria-label="Cerca fattura caricata" placeholder="Cerca cliente o numero" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded border border-slate-300 p-2" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !eligible.length} onClick={() => { setSelected(current => [...new Set([...current, ...eligible])]); setConfirming(false); }} className="rounded bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-900 disabled:opacity-50">Seleziona tutte le disponibili</button>
        <button type="button" disabled={busy || !selected.length} onClick={() => { setSelected([]); setConfirming(false); }} className="rounded bg-slate-100 px-3 py-2 text-sm font-semibold disabled:opacity-50">Deseleziona tutte</button>
        <span className="text-sm font-semibold">{selected.length} selezionate</span>
      </div>
      <div className="max-h-[45vh] overflow-auto rounded border border-slate-200">
        <table className="w-full min-w-[650px] text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Seleziona</th><th className="p-2">Numero</th><th className="p-2">Cliente</th><th className="p-2">Data</th><th className="p-2">Totale</th><th className="p-2">Stato</th></tr></thead>
          <tbody>{visible.map(row => <tr key={row.id} className="border-t border-slate-200">
            <td className="p-2"><input type="checkbox" aria-label={`Seleziona caricamento ${row.numero} di ${row.cliente}`} checked={selected.includes(row.id)} disabled={busy || row.bloccata} onChange={() => toggle(row.id)} /></td>
            <td className="p-2 font-semibold">{row.numero}</td><td className="p-2">{row.cliente}</td><td className="p-2">{row.data}</td><td className="p-2">{euro(row.importo)}</td>
            <td className={`p-2 ${row.bloccata ? 'text-red-800' : 'text-emerald-800'}`}>{row.motivo || 'Ripulibile'}</td>
          </tr>)}{!visible.length && <tr><td colSpan={6} className="p-4 text-center text-slate-600">{busy ? 'Caricamento...' : 'Nessuna fattura caricata per questa ricerca.'}</td></tr>}</tbody>
        </table>
      </div>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {confirming && <p className="rounded bg-red-50 p-3 text-sm font-semibold text-red-900">Confermi la rimozione di {selected.length} {selected.length === 1 ? 'caricamento' : 'caricamenti'} dal gestionale?</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded border border-slate-300 px-4 py-2">Annulla</button><button type="button" disabled={busy || !selected.length} onClick={confirming ? clean : () => setConfirming(true)} className="rounded bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Attendi...' : confirming ? 'Conferma pulizia' : 'Ripulisci caricamenti fattura'}</button></div>
    </div>
  </div>;
}
