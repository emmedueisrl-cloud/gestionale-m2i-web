import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { recuperaDatiAzienda } from '../../api/azienda';
import { companyStampUrl } from '../../utils/companyStampUrl';
import { stampaContrattoAppalto } from '../../utils/printContrattoAppalto';
import { downloadWord } from '../../utils/downloadWord';
import PrintableContrattoAppalto from './PrintableContrattoAppalto';
import { importoInLettere } from './importoInLettere';
import { salvaDatiContrattoAppaltoCliente } from '../../api/clienti';
import { ivaOptions } from './clausoleIvaAppalto';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white';

function initialValues(cliente, visura) {
  const sedeCliente = cliente?.sede_legale || [cliente?.indirizzo_sede, cliente?.civico_sede,
    cliente?.cap, cliente?.citta, cliente?.provincia ? `(${cliente.provincia})` : ''].filter(Boolean).join(' ');
  const saved = cliente?.contrattoAppalto || {};
  const values = {
    ragioneSociale: visura?.ragioneSociale || cliente?.ragione_sociale || '',
    partitaIva: visura?.partitaIva || cliente?.partita_iva || '',
    sedeLegale: visura?.sedeLegale || sedeCliente || '',
    rappresentante: visura?.rappresentante || cliente?.titolare || '',
    luogoNascitaRappresentante: '', dataNascitaRappresentante: '',
    tipoDocumento: '', numeroDocumento: '', rilasciatoDa: '', dataRilascioDocumento: '',
    localiServizio: '', durata: '', dataInizio: '', dataFine: '',
    corrispettivo: '', corrispettivoLettere: '', oreMensili: '',
    regimeIva: '', clausolaIva: '',
    indirizzoComunicazioni: visura?.sedeLegale || sedeCliente || '',
    dataFirma: '',
    ...Object.fromEntries(Object.entries(saved).filter(([, value]) => value !== '' && value != null))
  };
  return { ...values, corrispettivoLettere: importoInLettere(values.corrispettivo) };
}

export default function ContrattoAppaltoForm({ cliente, clienteId, visura, onClose }) {
  const [values, setValues] = useState(() => initialValues(cliente, visura));
  const [azienda, setAzienda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    recuperaDatiAzienda().then(result => { if (active) setAzienda(Array.isArray(result) ? result[0] : result); })
      .catch(() => { if (active) setError('Impossibile caricare la scheda M2I.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const change = (key, value) => setValues(current => ({ ...current, [key]: value,
    ...(key === 'corrispettivo' ? { corrispettivoLettere: importoInLettere(value) } : {}) }));
  const field = (key, label, type = 'text') => <label key={key} className="block text-sm font-semibold text-slate-200">
    {label} *<input type={type} required min={key === 'oreMensili' ? 1 : undefined}
      inputMode={key === 'corrispettivo' ? 'decimal' : undefined} readOnly={key === 'corrispettivoLettere'}
      value={values[key]} onChange={event => change(key, event.target.value)} className={inputClass} />
  </label>;
  const submit = async event => {
    event.preventDefault();
    if (!importoInLettere(values.corrispettivo)) { setError('Inserisci un corrispettivo valido e maggiore di zero.'); return; }
    if (!azienda?.numero_polizza_rct) { setError('Inserisci il numero di polizza RCT nella Scheda M2I.'); return; }
    if (!companyStampUrl(azienda?.timbro_path)) { setError('Carica il timbro con firma nella Scheda M2I prima di stampare.'); return; }
    if (values.dataFine < values.dataInizio) { setError('La scadenza deve essere successiva all’inizio del servizio.'); return; }
    setError('');
    setSaving(true);
    try {
      const complete = { ...values, corrispettivoLettere: importoInLettere(values.corrispettivo) };
      if (clienteId) await salvaDatiContrattoAppaltoCliente(clienteId, complete);
      if (event.nativeEvent.submitter?.value === 'word') await downloadWord('appalto', complete, azienda);
      else stampaContrattoAppalto(complete);
    } catch (err) { setError(err.message || 'Impossibile salvare o creare il contratto.'); }
    finally { setSaving(false); }
  };
  return <section className="space-y-5 text-slate-100">
    <div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-xl font-bold">Contratto d’appalto</h3>
      <p className="mt-1 text-sm text-slate-300">Controlla i dati della visura e completa quelli mancanti. Il testo delle clausole resta quello del modello.</p></div>
      <button type="button" onClick={onClose} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold">Torna al cliente</button></div>
    {loading ? <p>Caricamento dati M2I...</p> : <>
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm">
        <strong>Appaltatore:</strong> {azienda?.ragione_sociale || 'M2I S.R.L.'} · <strong>Polizza RCT:</strong> {azienda?.numero_polizza_rct || 'mancante'} · <strong>Logo:</strong> {companyStampUrl(azienda?.logo_path) ? 'presente' : 'non caricato'} · <strong>Timbro:</strong> {companyStampUrl(azienda?.timbro_path) ? 'presente' : 'non caricato'}
      </div>
      <form onSubmit={submit} className="space-y-6">
        <div><h4 className="mb-3 font-bold text-indigo-300">Committente e rappresentante</h4><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field('ragioneSociale', 'Ragione sociale')}{field('partitaIva', 'Partita IVA')}{field('sedeLegale', 'Sede legale')}
          {field('rappresentante', 'Legale rappresentante')}{field('luogoNascitaRappresentante', 'Luogo di nascita')}{field('dataNascitaRappresentante', 'Data di nascita', 'date')}
          {field('tipoDocumento', 'Tipo documento')}{field('numeroDocumento', 'Numero documento')}{field('rilasciatoDa', 'Rilasciato da')}{field('dataRilascioDocumento', 'Data di rilascio', 'date')}
        </div></div>
        <div><h4 className="mb-3 font-bold text-indigo-300">Servizio, durata e corrispettivo</h4><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field('localiServizio', 'Locali da pulire')}{field('durata', 'Durata del contratto')}
          {field('dataInizio', 'Inizio servizio', 'date')}{field('dataFine', 'Fine contratto', 'date')}
          {field('corrispettivo', 'Corrispettivo mensile in euro')}{field('corrispettivoLettere', 'Corrispettivo in lettere')}
          {field('oreMensili', 'Ore mensili', 'number')}{field('indirizzoComunicazioni', 'Indirizzo comunicazioni')}{field('dataFirma', 'Data firma', 'date')}
        </div></div>
        <div><h4 className="mb-3 font-bold text-indigo-300">Trattamento fiscale del corrispettivo</h4>
          <label className="block text-sm font-semibold">Scelta *<select required value={values.regimeIva} onChange={event => {
            const next = event.target.value;
            setValues(current => ({ ...current, regimeIva: next, clausolaIva: ivaOptions[next] || '' }));
          }} className={inputClass}><option value="">Seleziona</option><option value="reverse">Reverse charge</option><option value="iva">IVA</option><option value="ritenuta">Ritenuta d’acconto</option><option value="altro">Altro testo</option></select></label>
          <label className="mt-3 block text-sm font-semibold">Clausola da stampare *<textarea required rows={3} value={values.clausolaIva} onChange={event => change('clausolaIva', event.target.value)} className={inputClass} /></label>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
        <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50">{saving ? 'Salvataggio...' : 'Salva e stampa il contratto'}</button>
        <button type="submit" value="word" disabled={saving} className="ml-3 rounded-lg bg-slate-700 px-5 py-3 font-bold text-white hover:bg-slate-600 disabled:opacity-50">Scarica Word</button>
      </form>
      <details className="rounded-xl border border-slate-700 bg-slate-800 p-4"><summary className="cursor-pointer font-bold">Anteprima completa</summary>
        <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow"><PrintableContrattoAppalto data={values} azienda={azienda} previewMode /></div>
      </details>
      {createPortal(<div className="hidden print:block"><PrintableContrattoAppalto data={values} azienda={azienda} /></div>, document.body)}
    </>}
  </section>;
}
