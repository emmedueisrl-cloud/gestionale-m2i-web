import { Fragment, useState } from 'react';
import { Pencil } from 'lucide-react';
import { workflowRequest } from '../../api/workflowElaborati';

export default function PerUfficioPaghe({ buste, mese, anno, euro, onChanged, searchActive = false }) {
  const [editingId, setEditingId] = useState(null);
  const [testo, setTesto] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyPaidId, setBusyPaidId] = useState(null);
  const [error, setError] = useState('');
  const [paidError, setPaidError] = useState('');
  const [paidMessage, setPaidMessage] = useState('');
  const righe = [...buste].sort((a, b) => Number(Boolean(a.pagato_ufficio_at)) - Number(Boolean(b.pagato_ufficio_at)) ||
    `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'));

  const startEditing = busta => {
    setEditingId(busta.dipendente_id);
    setTesto(busta.nota_ufficio_paghe || '');
    setError('');
  };

  const save = async event => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await workflowRequest(`contabilita/dipendenti/${anno}/${mese}/${encodeURIComponent(editingId)}/nota-ufficio-paghe`, {
        method: 'PUT', body: JSON.stringify({ testo })
      });
      await onChanged();
      setEditingId(null);
      setTesto('');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const markPaid = async busta => {
    setBusyPaidId(busta.id); setPaidError(''); setPaidMessage('');
    try {
      await workflowRequest(`contabilita/ufficio-paghe/${encodeURIComponent(busta.id)}/pagato`, { method: 'POST' });
      await onChanged();
      setPaidMessage(`${busta.cognome} ${busta.nome} inserito come pagato!`);
    } catch (err) { setPaidError(err.message); }
    finally { setBusyPaidId(null); }
  };

  return <section aria-label="Per ufficio paghe" className="space-y-3 pt-16">
    {paidMessage && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 font-semibold text-emerald-900">{paidMessage}</p>}
    {paidError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{paidError}</p>}
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
      <table className="w-full min-w-[800px] border-collapse text-left text-slate-900">
        <colgroup><col className="w-[35%]" /><col className="w-[20%]" /><col className="w-[45%]" /></colgroup>
        <thead className="bg-slate-100 text-sm uppercase"><tr>
          <th scope="col" className="border-b border-r border-slate-300 px-5 py-3">Dipendente</th>
          <th scope="col" className="border-b border-r border-slate-300 px-5 py-3">Netto busta paga</th>
          <th scope="col" className="border-b border-slate-300 px-5 py-3">Azioni</th>
        </tr></thead>
        <tbody>{righe.length ? righe.map((busta, index) => <Fragment key={busta.id}>
          <tr className={busta.pagato_ufficio_at ? 'bg-emerald-100' : index % 2 ? 'bg-sky-50' : 'bg-white'}>
            <td className="border-r border-slate-200 px-5 py-4 text-lg font-bold">{busta.cognome} {busta.nome}</td>
            <td className="border-r border-slate-200 px-5 py-4 text-lg font-semibold">{euro(busta.importo_netto)}</td>
            <td className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
              {editingId === busta.dipendente_id ? <form onSubmit={save} className="min-w-52 flex-1 space-y-2">
                <label htmlFor={`nota-ufficio-${busta.id}`} className="text-sm font-semibold">Nota per ufficio paghe</label>
                <textarea id={`nota-ufficio-${busta.id}`} value={testo} onChange={event => setTesto(event.target.value)} maxLength={5000} rows={3} autoFocus className="w-full rounded-lg border border-slate-300 bg-white p-2 text-base text-slate-900 focus:border-indigo-600 focus:outline-none" />
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                <div className="flex gap-2"><button type="submit" disabled={busy} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{busy ? 'Salvataggio...' : 'Salva nota'}</button><button type="button" disabled={busy} onClick={() => setEditingId(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm hover:bg-slate-200">Annulla</button></div>
              </form> : busta.nota_ufficio_paghe ? <div className="flex min-w-0 flex-1 items-start gap-2">
                <p className="whitespace-pre-wrap break-words text-base">{busta.nota_ufficio_paghe}</p>
                <button type="button" onClick={() => startEditing(busta)} aria-label={`Modifica nota di ${busta.cognome} ${busta.nome}`} title="Modifica nota" className="shrink-0 rounded p-1 text-indigo-700 hover:bg-indigo-100"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
              </div> : <button type="button" onClick={() => startEditing(busta)} className="rounded-lg bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-900 hover:bg-indigo-200">Inserisci nota</button>}
              {busta.pagato_ufficio_at ? <div className="shrink-0 text-right font-semibold text-emerald-900"><div>Pagato</div><time dateTime={busta.pagato_ufficio_at} className="text-sm font-normal">{new Date(busta.pagato_ufficio_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</time></div> : <button type="button" disabled={busyPaidId === busta.id} onClick={() => markPaid(busta)} aria-label={`Segna come pagato ${busta.cognome} ${busta.nome}`} className="shrink-0 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-50">{busyPaidId === busta.id ? 'Salvataggio...' : 'Segna come pagato'}</button>}
              </div>
            </td>
          </tr>
          <tr className={`${busta.pagato_ufficio_at ? 'bg-emerald-100' : index % 2 ? 'bg-sky-50' : 'bg-white'} border-b-2 border-slate-300`}>
            <td colSpan={3} className="px-5 pb-5 pt-1"><span className="mr-3 text-sm font-semibold uppercase tracking-wide text-slate-600">IBAN</span><span className="break-all font-mono text-xl font-bold tracking-wide text-slate-900">{busta.iban || 'Non presente'}</span></td>
          </tr>
        </Fragment>) : <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-500">{searchActive ? 'Nessun dipendente con busta paga corrisponde alla ricerca.' : 'Nessuna busta paga caricata per questo mese.'}</td></tr>}</tbody>
      </table>
    </div>
  </section>;
}
