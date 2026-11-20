import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { salvaDatiContrattoAppaltoCliente } from '../../api/clienti';
import { importoInLettere } from './importoInLettere';
import { clausolaFiscaleAppalto, clausoleIvaPerModello, opzioniRegimeIvaAppalto } from './clausoleIvaAppalto';
import { calcolaFineContratto } from './calcolaFineContratto';
import { MODELLO_STANDARD, MODELLO_BB_IN_URBE, opzioniModelloAppalto } from './modelliAppalto';
import { TITOLO_CONTRATTO_APPALTO, titoloContrattoAppalto } from './titoloContrattoAppalto';

const fields = [
  ['titoloContratto', 'Titolo del contratto'],
  ['ragioneSociale', 'Ragione sociale'], ['partitaIva', 'Partita IVA'], ['sedeLegale', 'Sede legale'],
  ['rappresentante', 'Legale rappresentante'], ['luogoNascitaRappresentante', 'Luogo di nascita del rappresentante'],
  ['dataNascitaRappresentante', 'Data di nascita del rappresentante', 'date'],
  ['tipoDocumento', 'Tipo documento'], ['numeroDocumento', 'Numero documento'],
  ['rilasciatoDa', 'Documento rilasciato da'], ['dataRilascioDocumento', 'Data rilascio documento', 'date'],
  ['localiServizio', 'Locali del servizio'], ['attivitaPulizia', 'Attività di pulizia (modello standard)'], ['durata', 'Durata'],
  ['dataInizio', 'Inizio servizio', 'date'], ['dataFine', 'Fine contratto', 'date'],
  ['corrispettivo', 'Corrispettivo mensile'], ['corrispettivoLettere', 'Corrispettivo in lettere'],
  ['oreMensili', 'Ore mensili', 'number'], ['indirizzoComunicazioni', 'Indirizzo comunicazioni'],
  ['dataFirma', 'Data firma', 'date']
];
const empty = () => Object.fromEntries([...fields.map(([key]) => [key, key === 'titoloContratto' ? TITOLO_CONTRATTO_APPALTO : '']), ['modello', MODELLO_STANDARD], ['regimeIva', ''], ['clausolaIva', '']]);

export default function DatiContrattoAppaltoCliente({ clienteId, dati, onSaved }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(() => ({ ...empty(), ...(dati || {}),
    titoloContratto: titoloContrattoAppalto(dati?.titoloContratto),
    modello: dati?.modello || (dati?.oreMensili ? MODELLO_BB_IN_URBE : MODELLO_STANDARD),
    clausolaIva: clausolaFiscaleAppalto(dati?.modello || (dati?.oreMensili ? MODELLO_BB_IN_URBE : MODELLO_STANDARD),
      dati?.regimeIva, dati?.clausolaIva),
    dataFine: calcolaFineContratto(dati?.dataInizio, dati?.durata),
    corrispettivoLettere: importoInLettere(dati?.corrispettivo) }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const change = (key, value) => setValues(current => {
    const next = { ...current, [key]: value };
    if (key === 'durata' || key === 'dataInizio') next.dataFine = calcolaFineContratto(next.dataInizio, next.durata);
    if (key === 'corrispettivo') next.corrispettivoLettere = importoInLettere(value);
    if (key === 'modello' && next.regimeIva !== 'altro') next.clausolaIva = clausoleIvaPerModello(value)[next.regimeIva] || '';
    return next;
  });
  const persist = async () => {
    setSaving(true); setMessage('');
    try {
      const saved = await salvaDatiContrattoAppaltoCliente(clienteId, {
        ...values, dataFine: calcolaFineContratto(values.dataInizio, values.durata),
        corrispettivoLettere: importoInLettere(values.corrispettivo)
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
      <label className="block text-sm font-semibold">Modello del contratto
        <select value={values.modello || MODELLO_STANDARD} onChange={event => change('modello', event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white">
          {opzioniModelloAppalto.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <p className="text-xs text-slate-400">Inserisci la durata, ad esempio 4 MESI o 1 ANNO: la fine del contratto si calcola dall’inizio del servizio.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([key, label, type]) =>
        <label key={key} className="block text-sm font-semibold text-slate-200">{label}
          <input type={type || 'text'} value={values[key] || ''} readOnly={key === 'corrispettivoLettere' || key === 'dataFine'}
            inputMode={key === 'corrispettivo' ? 'decimal' : undefined}
            onChange={event => change(key, event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" /></label>)}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Trattamento fiscale<select value={values.regimeIva || ''}
          onChange={event => setValues(current => ({ ...current, regimeIva: event.target.value,
            clausolaIva: clausoleIvaPerModello(current.modello)[event.target.value] || '' }))}
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white">
          <option value="">Seleziona</option>
          {opzioniRegimeIvaAppalto.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          {values.regimeIva === 'altro' && <option value="altro">Testo personalizzato precedente</option>}
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
