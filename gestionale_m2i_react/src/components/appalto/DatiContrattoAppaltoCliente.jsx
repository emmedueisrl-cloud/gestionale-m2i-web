import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { salvaDatiContrattoAppaltoCliente } from '../../api/clienti';
import { importoInLettere } from './importoInLettere';
import { ivaOptions } from './clausoleIvaAppalto';

const fields = [
  ['ragioneSociale', 'Ragione sociale'], ['partitaIva', 'Partita IVA'], ['sedeLegale', 'Sede legale'],
  ['rappresentante', 'Legale rappresentante'], ['luogoNascitaRappresentante', 'Luogo di nascita del rappresentante'],
  ['dataNascitaRappresentante', 'Data di nascita del rappresentante', 'date'],
  ['tipoDocumento', 'Tipo documento'], ['numeroDocumento', 'Numero documento'],
  ['rilasciatoDa', 'Documento rilasciato da'], ['dataRilascioDocumento', 'Data rilascio documento', 'date'],
  ['localiServizio', 'Locali del servizio'], ['durata', 'Durata'],
  ['dataInizio', 'Inizio servizio', 'date'], ['dataFine', 'Fine contratto', 'date'],
  ['corrispettivo', 'Corrispettivo mensile'], ['corrispettivoLettere', 'Corrispettivo in lettere'],
  ['oreMensili', 'Ore mensili', 'number'], ['indirizzoComunicazioni', 'Indirizzo comunicazioni'],
  ['dataFirma', 'Data firma', 'date']
];
const empty = () => Object.fromEntries([...fields.map(([key]) => [key, '']), ['regimeIva', ''], ['clausolaIva', '']]);

export default function DatiContrattoAppaltoCliente({ clienteId, dati, onSaved }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(() => ({ ...empty(), ...(dati || {}),
    corrispettivoLettere: importoInLettere(dati?.corrispettivo) }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const change = (key, value) => setValues(current => ({ ...current, [key]: value,
    ...(key === 'corrispettivo' ? { corrispettivoLettere: importoInLettere(value) } : {}) }));
  const persist = async () => {
    setSaving(true); setMessage('');
    try {
      const saved = await salvaDatiContrattoAppaltoCliente(clienteId, {
        ...values, corrispettivoLettere: importoInLettere(values.corrispettivo)
      });
      onSaved?.(saved);
      setMessage('Dati del contratto salvati.');
      return true;
    } catch (err) { setMessage(err.message || 'Salvataggio non riuscito.'); return false; }
    finally { setSaving(false); }
  };
  const openContract = async () => {
    if (await persist()) navigate(`/admin/clienti/contratto/${encodeURIComponent(clienteId)}`);
  };
  return <section className="mb-8 rounded-2xl border border-slate-700 bg-slate-800 p-5 text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold">Dati contratto d’appalto</h2>
        <p className="mt-1 text-sm text-slate-400">Compila qui i dati da riutilizzare nel contratto. I campi non ancora inseriti restano vuoti.</p></div>
      <button type="button" onClick={openContract} disabled={saving}
        className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 disabled:opacity-50">Crea contratto</button>
    </div>
    <form onSubmit={event => { event.preventDefault(); persist(); }} className="mt-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([key, label, type]) =>
        <label key={key} className="block text-sm font-semibold text-slate-200">{label}
          <input type={type || 'text'} value={values[key] || ''} readOnly={key === 'corrispettivoLettere'}
            inputMode={key === 'corrispettivo' ? 'decimal' : undefined}
            onChange={event => change(key, event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" /></label>)}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Trattamento fiscale<select value={values.regimeIva || ''}
          onChange={event => setValues(current => ({ ...current, regimeIva: event.target.value,
            clausolaIva: ivaOptions[event.target.value] || '' }))}
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white">
          <option value="">Seleziona</option><option value="reverse">Reverse charge</option>
          <option value="iva">IVA</option><option value="ritenuta">Ritenuta d’acconto</option><option value="altro">Altro</option>
        </select></label>
        <label className="block text-sm font-semibold">Clausola fiscale<textarea rows={3} value={values.clausolaIva || ''}
          onChange={event => change('clausolaIva', event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" /></label>
      </div>
      {message && <p role="status" className="text-sm text-slate-200">{message}</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-5 py-2 font-bold disabled:opacity-50">
        {saving ? 'Salvataggio...' : 'Salva dati contratto'}</button>
    </form>
  </section>;
}
