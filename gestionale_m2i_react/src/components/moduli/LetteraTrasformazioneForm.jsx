import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { recuperaDatiAzienda } from '../../api/azienda';
import { companyStampUrl } from '../../utils/companyStampUrl';
import { stampaLetteraTrasformazione } from '../../utils/printLetteraTrasformazione';
import { downloadWord } from '../../utils/downloadWord';
import { domicilioUnilav } from '../../pages/AzioniVeloci/domicilioUnilav';
import { provinciaDaComune } from '../../utils/provinciaDaComune';
import PrintableLetteraTrasformazione from './PrintableLetteraTrasformazione';

const dateValue = value => String(value || '').slice(0, 10);
const inputClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white';

function transformationLetterDraft(unilav, employee, transformationDate) {
  const worker = unilav?.dipendente || employee?.unilavDati?.anagrafica || {};
  const rapporto = unilav?.rapporto || employee?.unilavDati?.rapporto || {};
  const domicilio = domicilioUnilav(worker);
  return {
    cognome: employee?.cognome || worker.cognome || '',
    nome: employee?.nome || worker.nome || '',
    indirizzo: employee?.indirizzo || domicilio.indirizzo,
    cap: employee?.cap || domicilio.cap,
    citta: employee?.citta || domicilio.citta,
    provincia: employee?.provincia || provinciaDaComune(employee?.citta || domicilio.citta),
    dataFirma: dateValue(unilav?.dataInvio || transformationDate || employee?.data_trasformazione_indeterminato),
    dataAssunzione: dateValue(employee?.dataAssunzione || employee?.data_assunzione || rapporto.dataInizio),
    dataTrasformazione: dateValue(transformationDate || rapporto.dataOperazione || employee?.data_trasformazione_indeterminato)
  };
}

export default function LetteraTrasformazioneForm({ unilav, employee, transformationDate, savedValues, onClose }) {
  const [values, setValues] = useState(() => {
    const initial = savedValues || transformationLetterDraft(unilav, employee, transformationDate);
    return { ...initial, provincia: initial.provincia || provinciaDaComune(initial.citta) };
  });
  const [azienda, setAzienda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    recuperaDatiAzienda().then(result => {
      if (active) setAzienda(Array.isArray(result) ? result[0] : result);
    }).catch(() => { if (active) setError('Impossibile caricare i dati aziendali.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const change = (key, value) => setValues(current => key === 'citta'
    ? { ...current, citta: value, provincia: provinciaDaComune(value) }
    : { ...current, [key]: value });
  const field = (key, label, type = 'text') => <label key={key} className="block text-sm font-semibold text-slate-200">
    {label} *<input type={type} required value={values[key] || ''} onChange={event => change(key, event.target.value)} className={inputClass} />
  </label>;
  const submit = async event => {
    event.preventDefault();
    if (!companyStampUrl(azienda?.timbro_path)) {
      setError('Carica il timbro con firma nella Scheda M2I prima di stampare.');
      return;
    }
    if (values.dataTrasformazione < values.dataAssunzione) {
      setError('La trasformazione non può precedere l’assunzione.');
      return;
    }
    setError('');
    if (event.nativeEvent.submitter?.value === 'word') {
      try { await downloadWord('trasformazione', values, azienda); }
      catch (err) { setError(err.message || 'Impossibile creare il file Word.'); }
    } else stampaLetteraTrasformazione(values);
  };

  return <section className="space-y-5 text-slate-100">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-xl font-bold">Lettera di trasformazione</h3>
        <p className="mt-1 text-sm text-slate-300">Controlla i dati e completa quelli mancanti prima di stampare la lettera.</p></div>
      <button type="button" onClick={() => onClose(values)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold">Torna alla trasformazione</button>
    </div>
    {loading ? <p>Caricamento dati aziendali...</p> : <>
      <form onSubmit={submit} className="space-y-5">
        <div><h4 className="mb-3 font-bold text-indigo-300">Destinatario e recapito</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field('cognome', 'Cognome')}{field('nome', 'Nome')}
            {field('indirizzo', 'Indirizzo')}{field('cap', 'CAP')}{field('citta', 'Comune')}{field('provincia', 'Provincia')}
          </div>
        </div>
        <div><h4 className="mb-3 font-bold text-indigo-300">Dati della trasformazione</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field('dataFirma', 'Data della lettera', 'date')}
            {field('dataAssunzione', 'Assunzione originaria', 'date')}
            {field('dataTrasformazione', 'Decorrenza indeterminato', 'date')}
          </div>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
        <button type="submit" className="rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500">Stampa la lettera</button>
        <button type="submit" value="word" className="ml-3 rounded-lg bg-slate-700 px-5 py-3 font-bold text-white hover:bg-slate-600">Scarica Word</button>
      </form>
      <details className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <summary className="cursor-pointer font-bold">Anteprima della lettera</summary>
        <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow"><PrintableLetteraTrasformazione data={values} azienda={azienda} previewMode /></div>
      </details>
      {createPortal(<div className="hidden print:block"><PrintableLetteraTrasformazione data={values} azienda={azienda} /></div>, document.body)}
    </>}
  </section>;
}
