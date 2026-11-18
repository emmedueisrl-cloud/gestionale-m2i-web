import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { recuperaDatiAzienda } from '../../api/azienda';
import { companyStampUrl } from '../../utils/companyStampUrl';
import { stampaLetteraProroga } from '../../utils/printLetteraProroga';
import { downloadWord } from '../../utils/downloadWord';
import { domicilioUnilav } from '../../pages/AzioniVeloci/domicilioUnilav';
import PrintableLetteraProroga from './PrintableLetteraProroga';

const dateValue = value => String(value || '').slice(0, 10);
const inputClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white';

function draftFromEmployee(employee, unilav, nuovaScadenza) {
  const worker = unilav?.dipendente || employee?.unilavDati?.anagrafica || {};
  const rapporto = unilav?.rapporto || employee?.unilavDati?.rapporto || {};
  const domicilio = domicilioUnilav(worker);
  const ore = rapporto.oreSettimanaliMedie || employee?.ore_settimanali || '';
  return {
    cognome: employee?.cognome || worker.cognome || '',
    nome: employee?.nome || worker.nome || '',
    indirizzo: employee?.indirizzo || domicilio.indirizzo,
    cap: employee?.cap || domicilio.cap,
    citta: employee?.citta || domicilio.citta,
    provincia: employee?.provincia || '',
    amministratore: '',
    dataFirma: dateValue(unilav?.dataInvio || ''),
    dataAssunzione: dateValue(employee?.data_assunzione || employee?.dataAssunzione || rapporto.dataInizio),
    nuovaScadenza: dateValue(nuovaScadenza || rapporto.dataOperazione),
    oreSettimanali: ore ? String(ore) : ''
  };
}

export default function LetteraProrogaForm({ unilav, employee, nuovaScadenza, savedValues, onClose }) {
  const [values, setValues] = useState(() => savedValues || draftFromEmployee(employee, unilav, nuovaScadenza));
  const [azienda, setAzienda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    recuperaDatiAzienda().then(result => {
      if (active) {
        const company = Array.isArray(result) ? result[0] : result;
        setAzienda(company);
        setValues(current => ({ ...current, amministratore: current.amministratore || company?.amministratore_unico || '' }));
      }
    }).catch(() => { if (active) setError('Impossibile caricare i dati aziendali.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const change = (key, value) => setValues(current => ({ ...current, [key]: value }));
  const field = (key, label, type = 'text') => <label key={key} className="block text-sm font-semibold text-slate-200">
    {label} *<input type={type} required value={values[key]} onChange={event => change(key, event.target.value)} className={inputClass} />
  </label>;
  const submit = async event => {
    event.preventDefault();
    if (!companyStampUrl(azienda?.timbro_path)) {
      setError('Carica il timbro con firma nella Scheda M2I prima di stampare.'); return;
    }
    if (values.nuovaScadenza <= values.dataAssunzione) {
      setError('La nuova scadenza deve essere successiva alla data di assunzione.'); return;
    }
    setError('');
    if (event.nativeEvent.submitter?.value === 'word') {
      try { await downloadWord('proroga', values, azienda); }
      catch (err) { setError(err.message || 'Impossibile creare il file Word.'); }
    } else stampaLetteraProroga(values);
  };
  return <section className="space-y-5 text-slate-100">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-xl font-bold">Lettera di proroga</h3>
        <p className="mt-1 text-sm text-slate-300">Controlla i dati, completa quelli mancanti e stampa la lettera.</p></div>
      <button type="button" onClick={() => onClose(values)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold">Torna alla proroga</button>
    </div>
    {loading ? <p>Caricamento dati aziendali...</p> : <>
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm">
        <strong>Datore:</strong> {azienda?.ragione_sociale || 'M2I S.R.L.'} · <strong>Logo:</strong> {companyStampUrl(azienda?.logo_path) ? 'presente' : 'non caricato'} · <strong>Timbro e firma:</strong> {companyStampUrl(azienda?.timbro_path) ? 'presenti' : 'non caricati'}
      </div>
      <form onSubmit={submit} className="space-y-5">
        <div><h4 className="mb-3 font-bold text-indigo-300">Destinatario e recapito</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field('cognome', 'Cognome')}{field('nome', 'Nome')}{field('indirizzo', 'Indirizzo')}
            {field('cap', 'CAP')}{field('citta', 'Comune')}{field('provincia', 'Provincia')}
          </div>
        </div>
        <div><h4 className="mb-3 font-bold text-indigo-300">Dati della proroga</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field('amministratore', 'Amministratore unico')}
            {field('dataFirma', 'Data della lettera', 'date')}
            {field('dataAssunzione', 'Assunzione originaria', 'date')}
            {field('nuovaScadenza', 'Nuova scadenza', 'date')}
            {field('oreSettimanali', 'Ore settimanali', 'number')}
          </div>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
        <button type="submit" className="rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500">Stampa la lettera</button>
        <button type="submit" value="word" className="ml-3 rounded-lg bg-slate-700 px-5 py-3 font-bold text-white hover:bg-slate-600">Scarica Word</button>
      </form>
      <details className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <summary className="cursor-pointer font-bold">Anteprima della lettera</summary>
        <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow"><PrintableLetteraProroga data={values} azienda={azienda} previewMode /></div>
      </details>
      {createPortal(<div className="hidden print:block"><PrintableLetteraProroga data={values} azienda={azienda} /></div>, document.body)}
    </>}
  </section>;
}
