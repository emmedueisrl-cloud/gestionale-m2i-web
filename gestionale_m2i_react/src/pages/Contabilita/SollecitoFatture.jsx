import { useEffect, useState } from 'react';
import { Mail, Paperclip, X } from 'lucide-react';
import { workflowRequest } from '../../api/workflowElaborati';

const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const dateIt = value => /^\d{4}-\d{2}-\d{2}/.test(value || '') ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '—';
const email = value => String(value || '').trim().toLowerCase();
const validEmail = value => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(value);
const splitEmails = value => [...new Set(String(value || '').split(/[;,\s]+/).map(email).filter(Boolean))];

export default function SollecitoFatture({ invoiceId, onClose, onSent }) {
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState([]);
  const [attached, setAttached] = useState([]);
  const [step, setStep] = useState(1);
  const [primary, setPrimary] = useState(true);
  const [secondary, setSecondary] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [updateEmail, setUpdateEmail] = useState('nessuno');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    workflowRequest(`contabilita/incassi-insoluti/${encodeURIComponent(invoiceId)}/sollecito`)
      .then(result => {
        if (!active) return;
        setDraft(result); setSelected([result.fatturaIniziale]);
        setPrimary(Boolean(result.cliente.email)); setSecondary(false);
      }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [invoiceId]);

  const toggle = (items, setItems, id) => setItems(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const chosen = draft?.fatture.filter(row => selected.includes(String(row.id))) || [];
  const recipients = [primary && draft?.cliente.email, secondary && draft?.cliente.emailSecondaria, customEmail]
    .map(email).filter(Boolean);
  const uniqueRecipients = [...new Set(recipients)];
  const newEmail = email(customEmail);
  const changedEmail = newEmail && ![email(draft?.cliente.email), email(draft?.cliente.emailSecondaria)].includes(newEmail);

  const continueToEmail = () => {
    if (!chosen.length) return setError('Seleziona almeno una fattura da sollecitare.');
    setError('');
    const plural = chosen.length > 1;
    setSubject(`Sollecito pagamento ${plural ? 'fatture' : 'fattura'} ${chosen.map(row => row.numero).join(', ')} – M2I S.R.L.`);
    setBody(`Buongiorno,\n\ncon la presente vi ricordiamo che ${plural ? 'le seguenti fatture risultano ancora da saldare' : 'la seguente fattura risulta ancora da saldare'}:\n\n${chosen.map(row => `• Fattura n. ${row.numero}, emessa il ${dateIt(row.dataFattura)}${row.scadenza ? `, scadenza ${dateIt(row.scadenza)}` : ''}, importo residuo ${euro(row.residuo)}.`).join('\n')}\n\nTotale da saldare: ${euro(chosen.reduce((sum, row) => sum + Number(row.residuo), 0))}.\n\nVi chiediamo cortesemente di provvedere al pagamento o di comunicarci gli estremi del versamento, qualora già effettuato, così da aggiornare la nostra contabilità.\n\nPer qualsiasi chiarimento restiamo a disposizione.\n\nCordiali saluti,\nM2I S.R.L.`);
    setStep(2);
  };

  const send = async event => {
    event.preventDefault();
    const ccAddresses = splitEmails(cc);
    if (!uniqueRecipients.length || [...uniqueRecipients, ...ccAddresses].some(address => !validEmail(address))) {
      return setError('Inserisci indirizzi email validi per destinatario e CC.');
    }
    if (changedEmail && updateEmail === 'secondaria' && draft.cliente.emailSecondaria) {
      return setError('La seconda email è già presente. Scegli “Solo per questo invio” o “Sostituisci la principale”.');
    }
    setBusy(true); setError('');
    try {
      const result = await workflowRequest('contabilita/incassi-insoluti/solleciti/invia', {
        method: 'POST', body: JSON.stringify({ fatture: selected, allegati: attached.filter(id => selected.includes(id)),
          destinatari: uniqueRecipients, cc: ccAddresses, oggetto: subject, corpo: body,
          aggiornamentoEmail: changedEmail ? updateEmail : 'nessuno', nuovaEmail: changedEmail ? newEmail : '' })
      });
      onSent(result.warning || 'Sollecito inviato.');
    } catch (err) { setError(err.message || 'Invio non riuscito.'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 sm:p-6" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="sollecito-title" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"><div><h2 id="sollecito-title" className="flex items-center gap-2 text-xl font-bold"><Mail className="h-5 w-5" />Invia sollecito</h2><p className="text-sm text-slate-600">{draft?.cliente.nome || 'Caricamento cliente…'} · {step === 1 ? 'Scegli le fatture e gli allegati' : 'Prepara il messaggio'}</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Chiudi sollecito" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
      <div className="overflow-y-auto px-5 py-5">
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
        {!draft && !error && <p role="status">Verifica delle fatture aperte…</p>}
        {draft && step === 1 && <div className="space-y-4">
          <p className="text-sm text-slate-700">Fatture ancora aperte per questo cliente: <strong>{draft.fatture.length}</strong>. Seleziona quelle da sollecitare; per ciascuna puoi decidere se allegare il PDF.</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-100"><tr><th className="p-3">Sollecita</th><th className="p-3">Fattura</th><th className="p-3">Emessa</th><th className="p-3">Scadenza</th><th className="p-3">Residuo</th><th className="p-3">Allega PDF</th></tr></thead><tbody>{draft.fatture.map(row => {
            const id = String(row.id); const isSelected = selected.includes(id);
            return <tr key={id} className="border-t border-slate-200"><td className="p-3"><input type="checkbox" aria-label={`Sollecita fattura ${row.numero}`} checked={isSelected} onChange={() => toggle(selected, setSelected, id)} /></td><td className="p-3 font-semibold">{row.numero}</td><td className="p-3">{dateIt(row.dataFattura)}</td><td className="p-3">{dateIt(row.scadenza)}</td><td className="p-3 font-bold">{euro(row.residuo)}</td><td className="p-3">{row.allegabile ? <label className="flex items-center gap-2"><input type="checkbox" checked={isSelected && attached.includes(id)} disabled={!isSelected} onChange={() => toggle(attached, setAttached, id)} /><Paperclip className="h-4 w-4" />Allega</label> : <span className="text-slate-500">PDF non disponibile</span>}</td></tr>;
          })}</tbody></table></div>
          <p className="text-right font-bold">Totale selezionato: {euro(chosen.reduce((sum, row) => sum + Number(row.residuo), 0))}</p>
        </div>}
        {draft && step === 2 && <form id="sollecito-form" onSubmit={send} className="space-y-4">
          <div className="rounded-lg bg-indigo-50 p-3 text-sm"><strong>{chosen.length} {chosen.length === 1 ? 'fattura' : 'fatture'}</strong> · {euro(chosen.reduce((sum, row) => sum + Number(row.residuo), 0))} · {attached.filter(id => selected.includes(id)).length} PDF in allegato</div>
          <fieldset className="space-y-2"><legend className="font-semibold">A</legend>
            {draft.cliente.email && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={primary} onChange={event => setPrimary(event.target.checked)} />{draft.cliente.email} <span className="text-slate-500">(principale)</span></label>}
            {draft.cliente.emailSecondaria && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={secondary} onChange={event => setSecondary(event.target.checked)} />{draft.cliente.emailSecondaria} <span className="text-slate-500">(secondaria)</span></label>}
            {draft.cliente.email && draft.cliente.emailSecondaria && <p className="text-xs text-indigo-800">In anagrafica sono presenti due indirizzi. Puoi usarne uno o entrambi.</p>}
            {!draft.cliente.email && !draft.cliente.emailSecondaria && <p className="text-sm text-amber-800">Nessuna email in anagrafica: inserisci un destinatario.</p>}
            <label className="block text-sm">{draft.cliente.email || draft.cliente.emailSecondaria ? 'Altro indirizzo o indirizzo modificato' : 'Email cliente'}<input type="email" value={customEmail} onChange={event => { setCustomEmail(event.target.value); setUpdateEmail('nessuno'); }} placeholder="nome@azienda.it" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            {changedEmail && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p className="mb-2 font-semibold">Vuoi salvare questo indirizzo nell’anagrafica?</p><div className="space-y-1"><label className="block"><input type="radio" name="update-email" checked={updateEmail === 'nessuno'} onChange={() => setUpdateEmail('nessuno')} /> Solo per questo invio</label><label className="block"><input type="radio" name="update-email" checked={updateEmail === 'sostituisci'} onChange={() => setUpdateEmail('sostituisci')} /> Sostituisci email principale</label><label className="block"><input type="radio" name="update-email" checked={updateEmail === 'secondaria'} disabled={Boolean(draft.cliente.emailSecondaria)} onChange={() => setUpdateEmail('secondaria')} /> Aggiungi come seconda email{draft.cliente.emailSecondaria ? ' (già occupata)' : ''}</label></div></div>}
          </fieldset>
          <label className="block text-sm font-semibold">CC <span className="font-normal text-slate-500">(separa più indirizzi con virgole o punto e virgola)</span><input type="text" value={cc} onChange={event => setCc(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="block text-sm font-semibold">Oggetto<input required maxLength={250} value={subject} onChange={event => setSubject(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="block text-sm font-semibold">Messaggio<textarea required maxLength={10000} rows={12} value={body} onChange={event => setBody(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal leading-relaxed" /></label>
        </form>}
      </div>
      {draft && <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" disabled={busy} onClick={step === 2 ? () => setStep(1) : onClose} className="rounded-lg bg-slate-100 px-4 py-2 font-semibold">{step === 2 ? 'Indietro' : 'Annulla'}</button>{step === 1 ? <button type="button" onClick={continueToEmail} className="rounded-lg bg-indigo-700 px-5 py-2 font-bold text-white">Continua alla mail</button> : <button type="submit" form="sollecito-form" disabled={busy} className="rounded-lg bg-indigo-700 px-5 py-2 font-bold text-white disabled:opacity-50">{busy ? 'Invio…' : 'Invia sollecito'}</button>}</footer>}
    </div>
  </div>;
}
