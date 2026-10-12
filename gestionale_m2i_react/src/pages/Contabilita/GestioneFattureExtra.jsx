import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { workflowRequest } from '../../api/workflowElaborati';

const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';

export default function GestioneFattureExtra({ mese, anno, gruppi, onChanged }) {
  const [open, setOpen] = useState(false);
  const [registrazioni, setRegistrazioni] = useState([]);
  const [noteCredito, setNoteCredito] = useState([]);
  const [fatturaScelta, setFatturaScelta] = useState({});
  const [creditoScelto, setCreditoScelto] = useState({});
  const [imponibileCredito, setImponibileCredito] = useState({});
  const [destinazione, setDestinazione] = useState({});
  const [gruppoDestinazione, setGruppoDestinazione] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const [invoices, credits] = await Promise.all([
      workflowRequest(`servizi-extra/${anno}/${mese}/fatture-aruba`),
      workflowRequest('servizi-extra-note-credito-aruba')
    ]);
    setRegistrazioni(invoices); setNoteCredito(credits);
  }, [mese, anno]);
  useEffect(() => { if (open) load().catch(err => setError(err.message)); }, [open, load]);
  useEffect(() => { setOpen(false); setError(''); setMessage(''); }, [mese, anno]);

  const act = async (path, body, success) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await workflowRequest(path, { method: 'POST', body: JSON.stringify(body) });
      await Promise.all([load(), onChanged()]);
      setMessage(success);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (!gruppi.some(group => group.servizi?.length || group.fatturaRegistrazioneId)) return null;
  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100">Collegamenti e rettifiche extra</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" onMouseDown={() => !busy && setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Collegamenti e rettifiche delle fatture extra" className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-xl bg-white p-5 text-left text-slate-900 shadow-xl" onMouseDown={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Fatture extra · collegamenti e rettifiche</h2><p className="text-sm text-slate-600">Le fatture vengono emesse su Aruba. Qui puoi collegare documenti già importati, registrare note di credito e preparare una fattura sostitutiva.</p></div><button type="button" disabled={busy} onClick={() => setOpen(false)} aria-label="Chiudi" className="rounded p-1 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
        {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        {gruppi.filter(group => group.servizi?.length || group.fatturaRegistrazioneId).map(group => {
          const original = registrazioni.find(invoice => Number(invoice.id) === Number(group.fatturaRegistrazioneId));
          const totalCredit = (group.crediti || []).reduce((sum, credit) => sum + Number(credit.totale || 0), 0);
          const fullyCredited = original && totalCredit * 100 + 1 >= Number(original.importo_totale) * 100;
          const hasReplacement = (group.crediti || []).some(credit => credit.gruppoSostitutivoId);
          return <section key={group.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="font-semibold">{group.clienteNome} · {group.descrizioneFattura || group.nome} · {euro(group.imponibileExtra)} imponibile</div>
            {group.fatturaRegistrazioneId ? <p className="text-sm text-emerald-700">Fattura Aruba {original?.numero_fattura || `#${group.fatturaRegistrazioneId}`}</p> : <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[260px] flex-1 text-sm">Fattura Aruba importata<select className={inputClass} value={fatturaScelta[group.id] || ''} onChange={event => setFatturaScelta(value => ({ ...value, [group.id]: event.target.value }))}><option value="">Seleziona fattura</option>{registrazioni.filter(invoice => invoice.cliente_id === group.clienteId && invoice.tipo_documento !== 'TD04' && Number(invoice.importo_totale) > 0 && !gruppi.some(other => Number(other.fatturaRegistrazioneId) === Number(invoice.id))).map(invoice => <option key={invoice.id} value={invoice.id}>{invoice.numero_fattura} · {invoice.data_fattura} · {euro(invoice.importo_totale)}</option>)}</select></label>
              <button type="button" disabled={busy || !fatturaScelta[group.id]} onClick={() => act(`servizi-extra/gruppi/${group.id}/collega-fattura`, { registrazioneId: fatturaScelta[group.id] }, 'Fattura Aruba collegata.')} className="rounded bg-indigo-700 px-3 py-2 text-sm text-white disabled:opacity-50">Collega fattura</button>
            </div>}
            {(group.crediti || []).map(credit => <p key={credit.id} className="text-sm text-amber-800">Nota di credito {credit.numero} del {credit.data}: {euro(credit.totale)}</p>)}
            {group.fatturaRegistrazioneId && !fullyCredited && <div className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
              <label className="min-w-[220px] flex-1 text-sm">Nota di credito Aruba<select className={inputClass} value={creditoScelto[group.id] || ''} onChange={event => setCreditoScelto(value => ({ ...value, [group.id]: event.target.value }))}><option value="">Seleziona nota</option>{noteCredito.filter(note => note.cliente_id === group.clienteId && !gruppi.some(other => (other.crediti || []).some(credit => String(credit.registrazioneId) === String(note.id)))).map(note => <option key={note.id} value={note.id}>{note.numero_fattura} · {note.data_fattura} · {euro(Math.abs(note.importo_totale))}</option>)}</select></label>
              <label className="w-36 text-sm">Imponibile stornato (€)<input className={inputClass} inputMode="decimal" value={imponibileCredito[group.id] || ''} onChange={event => setImponibileCredito(value => ({ ...value, [group.id]: event.target.value }))} /></label>
              <button type="button" disabled={busy || !creditoScelto[group.id] || !imponibileCredito[group.id]} onClick={() => act(`servizi-extra/gruppi/${group.id}/nota-credito`, { registrazioneId: creditoScelto[group.id], imponibile: imponibileCredito[group.id] }, 'Nota di credito collegata.')} className="rounded bg-amber-700 px-3 py-2 text-sm text-white disabled:opacity-50">Collega nota</button>
            </div>}
            {fullyCredited && group.servizi?.length > 0 && !hasReplacement && <div className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
              <label className="min-w-[220px] flex-1 text-sm">Nuova fattura<select className={inputClass} value={destinazione[group.id] || 'stesso'} onChange={event => setDestinazione(value => ({ ...value, [group.id]: event.target.value }))}><option value="stesso">Stessa composizione</option><option value="extra">Fattura extra nuova</option><option value="mensile">Unisci al mensile</option><option value="existing">Unisci ad altri extra</option></select></label>
              {destinazione[group.id] === 'existing' && <label className="min-w-[220px] flex-1 text-sm">Gruppo extra<select className={inputClass} value={gruppoDestinazione[group.id] || ''} onChange={event => setGruppoDestinazione(value => ({ ...value, [group.id]: event.target.value }))}><option value="">Seleziona gruppo</option>{gruppi.filter(other => other.id !== group.id && other.clienteId === group.clienteId && other.tipo === 'extra' && !other.inviataAt && !other.fatturaRegistrazioneId).map(other => <option key={other.id} value={other.id}>{other.descrizioneFattura || other.nome}</option>)}</select></label>}
              <button type="button" disabled={busy || destinazione[group.id] === 'existing' && !gruppoDestinazione[group.id]} onClick={() => act(`servizi-extra/gruppi/${group.id}/rifattura`, { destinazione: destinazione[group.id] || 'stesso', gruppoId: gruppoDestinazione[group.id] || null }, 'Nuova fattura preparata.')} className="rounded bg-indigo-700 px-3 py-2 text-sm text-white disabled:opacity-50">Prepara nuova fattura</button>
            </div>}
            {hasReplacement && <p className="text-sm text-indigo-700">Servizi spostati alla fattura sostitutiva.</p>}
          </section>;
        })}
      </div>
    </div>}
  </>;
}
