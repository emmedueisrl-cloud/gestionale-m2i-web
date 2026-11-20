import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { recuperaDatiAzienda } from '../../api/azienda';
import { stampaContrattoAppalto } from '../../utils/printContrattoAppalto';
import { downloadWord } from '../../utils/downloadWord';
import PrintableContrattoAppalto from './PrintableContrattoAppalto';
import { importoInLettere } from './importoInLettere';
import { salvaDatiContrattoAppaltoCliente } from '../../api/clienti';
import { clausolaFiscaleAppalto, clausoleIvaPerModello, opzioniRegimeIvaAppalto } from './clausoleIvaAppalto';
import { calcolaFineContratto } from './calcolaFineContratto';
import { MODELLO_STANDARD, MODELLO_BB_IN_URBE, opzioniModelloAppalto, nomeModelloAppalto } from './modelliAppalto';
import { TITOLO_CONTRATTO_APPALTO, titoloContrattoAppalto } from './titoloContrattoAppalto';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white';

function oggiInItalia() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

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
    modello: MODELLO_STANDARD, attivitaPulizia: '',
    titoloContratto: TITOLO_CONTRATTO_APPALTO,
    corrispettivo: '', corrispettivoLettere: '', oreMensili: '',
    regimeIva: '', clausolaIva: '',
    indirizzoComunicazioni: visura?.sedeLegale || sedeCliente || '',
    dataFirma: oggiInItalia(),
    ...Object.fromEntries(Object.entries(saved).filter(([, value]) => value !== '' && value != null))
  };
  const modello = saved.modello || (saved.oreMensili ? MODELLO_BB_IN_URBE : MODELLO_STANDARD);
  return { ...values, modello, titoloContratto: titoloContrattoAppalto(values.titoloContratto),
    clausolaIva: clausolaFiscaleAppalto(modello, values.regimeIva, values.clausolaIva),
    dataFine: calcolaFineContratto(values.dataInizio, values.durata),
    corrispettivoLettere: importoInLettere(values.corrispettivo) };
}

export default function ContrattoAppaltoForm({ cliente, clienteId, visura, onClose, backLabel = 'Torna al cliente' }) {
  const [values, setValues] = useState(() => initialValues(cliente, visura));
  const [azienda, setAzienda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(false);
  useEffect(() => {
    let active = true;
    recuperaDatiAzienda().then(result => { if (active) setAzienda(Array.isArray(result) ? result[0] : result); })
      .catch(() => { if (active) setError('Impossibile caricare la scheda M2I.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const change = (key, value) => { setReview(false); setValues(current => {
    const next = { ...current, [key]: value };
    if (key === 'durata' || key === 'dataInizio') next.dataFine = calcolaFineContratto(next.dataInizio, next.durata);
    if (key === 'corrispettivo') next.corrispettivoLettere = importoInLettere(value);
    if (key === 'modello' && next.regimeIva !== 'altro') {
      next.clausolaIva = clausoleIvaPerModello(value)[next.regimeIva] || '';
    }
    return next;
  }); };
  const field = (key, label, type = 'text', required = true) => <label key={key} className="block text-sm font-semibold text-slate-200">
    {label}{required ? ' *' : ''}<input type={type} required={required} min={key === 'oreMensili' ? 1 : undefined}
      inputMode={key === 'corrispettivo' ? 'decimal' : undefined} readOnly={key === 'corrispettivoLettere' || key === 'dataFine'}
      value={values[key]} onChange={event => change(key, event.target.value)} className={inputClass} />
  </label>;
  const complete = { ...values, dataFine: calcolaFineContratto(values.dataInizio, values.durata),
    corrispettivoLettere: importoInLettere(values.corrispettivo) };
  const summaryFields = [
    ['titoloContratto', 'Titolo del contratto'],
    ['ragioneSociale', 'Ragione sociale'], ['partitaIva', 'Partita IVA'], ['sedeLegale', 'Sede legale'],
    ['rappresentante', 'Legale rappresentante'], ['luogoNascitaRappresentante', 'Luogo di nascita'],
    ['dataNascitaRappresentante', 'Data di nascita'], ['tipoDocumento', 'Tipo documento'],
    ['numeroDocumento', 'Numero documento'], ['rilasciatoDa', 'Rilasciato da'],
    ...(values.modello === MODELLO_BB_IN_URBE ? [['dataRilascioDocumento', 'Data rilascio documento']] : []),
    ['localiServizio', 'Locali da pulire'],
    ...(values.modello === MODELLO_STANDARD ? [['attivitaPulizia', 'Attività di pulizia']] : []),
    ['durata', 'Durata'], ['dataInizio', 'Inizio servizio'], ['dataFine', 'Fine contratto'],
    ['corrispettivo', 'Corrispettivo mensile'], ['corrispettivoLettere', 'Corrispettivo in lettere'],
    ...(values.modello === MODELLO_BB_IN_URBE ? [['oreMensili', 'Ore mensili']] : []),
    ['indirizzoComunicazioni', 'Indirizzo comunicazioni'], ['regimeIva', 'Trattamento fiscale'],
    ['clausolaIva', 'Clausola fiscale'], ['dataFirma', 'Data firma']
  ];
  const submit = event => {
    event.preventDefault();
    const fineContratto = calcolaFineContratto(values.dataInizio, values.durata);
    if (!fineContratto) { setError('Inserisci una durata in giorni, settimane, mesi o anni (es. 4 MESI).'); return; }
    if (!importoInLettere(values.corrispettivo)) { setError('Inserisci un corrispettivo valido e maggiore di zero.'); return; }
    const mancantiM2i = [
      ['ragione_sociale', 'ragione sociale'], ['partita_iva', 'Partita IVA'],
      ['sede_legale', 'sede legale'], ['pec', 'PEC'],
      ['numero_polizza_rct', 'numero polizza RCT'], ['compagnia_polizza_rct', 'compagnia polizza RCT']
    ].filter(([key]) => !String(azienda?.[key] || '').trim()).map(([, label]) => label);
    if (mancantiM2i.length) { setError(`Completa nella sezione Dati e Documenti M2I: ${mancantiM2i.join(', ')}.`); return; }
    setError('');
    setReview(true);
  };
  const output = async type => {
    setSaving(true);
    try {
      if (clienteId) await salvaDatiContrattoAppaltoCliente(clienteId, complete);
      if (type === 'word') await downloadWord('appalto', complete, azienda);
      else stampaContrattoAppalto(complete);
    } catch (err) { setError(err.message || 'Impossibile salvare o creare il contratto.'); }
    finally { setSaving(false); }
  };
  return <section className="space-y-5 text-slate-100">
    <div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-xl font-bold">Contratto d’appalto</h3>
      <p className="mt-1 text-sm text-slate-300">Controlla i dati della visura e completa quelli mancanti. Il testo delle clausole resta quello del modello.</p></div>
      <button type="button" onClick={onClose} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold">{backLabel}</button></div>
    {loading ? <p>Caricamento dati M2I...</p> : <>
      <form onSubmit={submit} className="space-y-6">
        <label className="block text-sm font-semibold text-slate-200">Modello del contratto *
          <select value={values.modello} onChange={event => change('modello', event.target.value)} className={inputClass}>
            {opzioniModelloAppalto.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <div><h4 className="mb-3 font-bold text-indigo-300">Committente e rappresentante</h4><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field('ragioneSociale', 'Ragione sociale')}{field('partitaIva', 'Partita IVA')}{field('sedeLegale', 'Sede legale')}
          {field('rappresentante', 'Legale rappresentante')}{field('luogoNascitaRappresentante', 'Luogo di nascita')}{field('dataNascitaRappresentante', 'Data di nascita', 'date')}
          {field('tipoDocumento', 'Tipo documento')}{field('numeroDocumento', 'Numero documento')}{field('rilasciatoDa', 'Rilasciato da')}
          {values.modello === MODELLO_BB_IN_URBE && field('dataRilascioDocumento', 'Data di rilascio', 'date')}
        </div></div>
        <div><h4 className="mb-3 font-bold text-indigo-300">Servizio, durata e corrispettivo</h4><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field('localiServizio', 'Locali da pulire')}{field('durata', 'Durata del contratto (mesi)')}
          {values.modello === MODELLO_STANDARD && <label className="block text-sm font-semibold text-slate-200 sm:col-span-2 lg:col-span-3">Attività di pulizia *
            <textarea required rows={4} value={values.attivitaPulizia} onChange={event => change('attivitaPulizia', event.target.value)} className={inputClass} /></label>}
          {field('dataInizio', 'Inizio servizio', 'date')}{field('dataFine', 'Fine contratto', 'date')}
          <p className="text-xs text-slate-400 sm:col-span-2 lg:col-span-3">Inserisci il numero di mesi (es. 5). La fine è calcolata automaticamente come ultimo giorno incluso.</p>
          {field('corrispettivo', 'Corrispettivo mensile in euro')}{field('corrispettivoLettere', 'Corrispettivo in lettere')}
          {values.modello === MODELLO_BB_IN_URBE && field('oreMensili', 'Ore mensili', 'number')}{field('indirizzoComunicazioni', 'Indirizzo comunicazioni')}{field('dataFirma', 'Data firma', 'date')}
        </div></div>
        <div><h4 className="mb-3 font-bold text-indigo-300">Trattamento fiscale del corrispettivo</h4>
          <label className="block text-sm font-semibold">Scelta *<select required value={values.regimeIva} onChange={event => {
            const next = event.target.value;
            setReview(false); setValues(current => ({ ...current, regimeIva: next,
              clausolaIva: clausoleIvaPerModello(current.modello)[next] || '' }));
          }} className={inputClass}><option value="">Seleziona</option>
            {opzioniRegimeIvaAppalto.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            {values.regimeIva === 'altro' && <option value="altro">Testo personalizzato precedente</option>}
          </select></label>
          <label className="mt-3 block text-sm font-semibold">Clausola da stampare *<textarea required rows={3} value={values.clausolaIva} onChange={event => change('clausolaIva', event.target.value)} className={inputClass} /></label>
        </div>
        <div className="rounded-xl border border-indigo-500/60 bg-indigo-500/10 p-4">
          <label className="block text-sm font-semibold text-slate-100">Titolo del contratto *
            <input type="text" required maxLength={200} value={values.titoloContratto} onChange={event => change('titoloContratto', event.target.value)} className={inputClass} />
          </label>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
        <button type="submit" className="rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500">Controlla riepilogo</button>
      </form>
      {review && <section className="space-y-4 rounded-xl border border-indigo-500 bg-slate-800 p-5">
        <h4 className="text-lg font-bold">Riepilogo prima del download · {nomeModelloAppalto(values.modello)}</h4>
        <p className="text-sm text-slate-300">Controlla tutti i dati del contratto, inclusi quelli recuperati dalla visura. Per correggerli torna ai campi sopra.</p>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{summaryFields.map(([key, label]) =>
          <div key={key} className="rounded-lg border border-slate-600 p-3"><dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm font-semibold">{key === 'regimeIva'
              ? opzioniRegimeIvaAppalto.find(option => option.value === complete[key])?.label ||
                (complete[key] === 'altro' ? 'Testo personalizzato precedente' : 'Da compilare')
              : complete[key] || 'Da compilare'}</dd></div>)}
        </dl>
        <div className="flex flex-wrap gap-3"><button type="button" onClick={() => output('print')} disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-3 font-bold disabled:opacity-50">{clienteId ? 'Salva e stampa PDF' : 'Stampa PDF'}</button>
          <button type="button" onClick={() => output('word')} disabled={saving} className="rounded-lg bg-slate-700 px-5 py-3 font-bold disabled:opacity-50">{clienteId ? 'Salva e scarica Word' : 'Scarica Word'}</button></div>
        <details className="rounded-xl border border-slate-700 p-4"><summary className="cursor-pointer font-bold">Anteprima completa</summary>
          <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow"><PrintableContrattoAppalto data={complete} azienda={azienda} previewMode /></div>
        </details>
      </section>}
      {createPortal(<div className="hidden print:block"><PrintableContrattoAppalto data={complete} azienda={azienda} /></div>, document.body)}
    </>}
  </section>;
}
