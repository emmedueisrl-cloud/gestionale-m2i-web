import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { recuperaDatiAzienda } from '../../api/azienda';
import PrintableContrattoAssunzione from '../../components/moduli/PrintableContrattoAssunzione';
import { NUMERO_PAGINE_REGOLAMENTO } from '../../components/moduli/RegolamentoInterno';
import { companyStampUrl } from '../../utils/companyStampUrl';
import { stampaContrattoAssunzione } from '../../utils/printContrattoAssunzione';
import { downloadWord } from '../../utils/downloadWord';
import { domicilioUnilav } from './domicilioUnilav';
import { provinciaDaComune } from '../../utils/provinciaDaComune';

const withoutCode = value => String(value || '').replace(/^[\d.]+\s*-\s*/, '').trim();
const inputClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white';

export default function ContrattoUnilav({ unilav, draft, selected, savedValues, onDraftChange, onClose }) {
  const worker = unilav.dipendente;
  const work = unilav.rapporto;
  const qualifica = withoutCode(work.qualificaProfessionale);
  const domicileFields = domicilioUnilav(worker);
  const [azienda, setAzienda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [values, setValues] = useState(() => {
    const initial = ({
    cognome: draft.cognome || selected?.cognome || worker.cognome,
    nome: draft.nome || selected?.nome || worker.nome,
    codiceFiscale: worker.codiceFiscale || selected?.codice_fiscale || '',
    sesso: worker.sesso || '',
    indirizzo: draft.indirizzo || selected?.indirizzo || domicileFields.indirizzo,
    cap: draft.cap || selected?.cap || domicileFields.cap,
    citta: draft.citta || selected?.citta || domicileFields.citta,
    provincia: draft.provincia || selected?.provincia || '',
    telefono: selected?.telefono || draft.telefono || '',
    email: selected?.email || draft.email || '',
    iban: selected?.iban || draft.iban || '',
    dataFirma: unilav.dataInvio || work.dataOperazione,
    dataInizio: work.dataOperazione,
    tipoContratto: /A\.01\.00|TEMPO INDETERMINATO/i.test(work.tipologiaContrattuale) ? 'Indeterminato' : 'Determinato',
    tipoOrario: work.tipoOrario || '',
    codiceComunicazione: unilav.codiceComunicazione || '',
    dataFine: work.dataFine || '',
    qualifica,
    mansioni: draft.mansione || selected?.mansione || (/operai/i.test(qualifica) ? 'operaio' : ''),
    livelloCCNL: [withoutCode(work.livelloInquadramento), work.ccnl ? `C.C.N.L. ${withoutCode(work.ccnl)}` : ''].filter(Boolean).join(' '),
    oreSettimanali: work.oreSettimanaliMedie ? `${work.oreSettimanaliMedie} ore settimanali${/PARZIALE/i.test(work.tipoOrario) ? ' part time' : ''}` : '',
    periodoProva: '10',
    ccnlRetribuzione: work.ccnl ? `C.C.N.L. ${withoutCode(work.ccnl)}` : '',
    sedeLavoro: work.sedeLavoro || '',
    allegaRegolamento: true,
    ...(savedValues || {})
    });
    return { ...initial, provincia: initial.provincia || provinciaDaComune(initial.citta) };
  });
  useEffect(() => { onDraftChange?.(values); }, [values, onDraftChange]);

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
  const field = (key, label, type = 'text', hint = '', required = true) => <label key={key} className="block text-sm font-semibold text-slate-200">
    {label}{required && ' *'}
    <input type={type} required={required} value={values[key] || ''} onChange={event => change(key, event.target.value)} className={inputClass} />
    {hint && <span className="mt-1 block text-xs font-normal text-slate-400">{hint}</span>}
  </label>;
  const submit = async event => {
    event.preventDefault();
    if (!companyStampUrl(azienda?.timbro_path)) {
      setError('Il timbro con firma non è disponibile. Caricalo nella Scheda azienda prima di stampare.');
      return;
    }
    if (!azienda?.posizione_inps?.trim() || !azienda?.posizione_inail?.trim()) {
      setError('Compila la posizione INPS e INAIL nella Scheda M2I prima di stampare il contratto.');
      return;
    }
    setError('');
    if (event.nativeEvent.submitter?.value === 'word') {
      try { await downloadWord('assunzione', values, azienda); }
      catch (err) { setError(err.message || 'Impossibile creare il file Word.'); }
    } else stampaContrattoAssunzione(values);
  };
  const domicile = [domicileFields.indirizzo, domicileFields.citta, domicileFields.cap].filter(Boolean).join(', ');

  return <section className="space-y-5 text-slate-100">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-xl font-bold">Contratto di assunzione pronto per la stampa</h3>
        <p className="mt-1 text-sm text-slate-300">Controlla tutti i dati e completa quelli che non compaiono nell’UNILAV. Le modifiche qui riguardano il contratto da stampare.</p></div>
      <button type="button" onClick={() => onClose(values)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold">Torna all’UNILAV</button>
    </div>
    {loading ? <p>Caricamento dati aziendali...</p> : <>
      <form onSubmit={submit} className="space-y-5">
        <div><h4 className="mb-3 font-bold text-indigo-300">Riepilogo anagrafico</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field('cognome', 'Cognome')}{field('nome', 'Nome')}
            <label className="block text-sm font-semibold">Sesso *<select required value={values.sesso} onChange={event => change('sesso', event.target.value)} className={inputClass}>
              <option value="">Seleziona</option><option value="M">Maschio</option><option value="F">Femmina</option></select></label>
            {field('indirizzo', 'Indirizzo di residenza', 'text', domicile && `Domicilio nell’UNILAV: ${domicile}`)}
            {field('cap', 'CAP')}{field('citta', 'Comune di residenza')}{field('provincia', 'Provincia')}
          </div>
        </div>
        <div><h4 className="mb-3 font-bold text-indigo-300">Condizioni del contratto</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field('dataFirma', 'Data di firma', 'date', 'Precompilata con la data di invio dell’UNILAV.')}{field('dataInizio', 'Data di inizio', 'date')}
            <label className="block text-sm font-semibold">Tipo contratto *<select required value={values.tipoContratto} onChange={event => change('tipoContratto', event.target.value)} className={inputClass}>
              <option value="Determinato">Determinato</option><option value="Indeterminato">Indeterminato</option></select></label>
            {values.tipoContratto === 'Determinato' && field('dataFine', 'Data di fine', 'date')}
            {field('tipoOrario', 'Tipo orario UNILAV', 'text', 'Tempo parziale o tempo pieno; determina il titolo della lettera.', false)}
            {field('codiceComunicazione', 'Codice comunicazione UNILAV', 'text', '', false)}
            {field('qualifica', 'Qualifica')}{field('mansioni', 'Mansioni')}
            {field('livelloCCNL', 'Livello e CCNL')}{field('oreSettimanali', 'Orario settimanale')}
            {field('periodoProva', 'Giorni di prova', 'number')}
            {field('ccnlRetribuzione', 'CCNL della retribuzione')}{field('sedeLavoro', 'Sede di lavoro')}
          </div>
        </div>
        <div><h4 className="mb-3 font-bold text-indigo-300">Recapiti e coordinate</h4>
          <p className="mb-3 text-sm text-slate-400">Facoltativi. Se restano vuoti, il dipendente potrà compilarli a mano sulla lettera.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field('telefono', 'Recapito telefonico', 'tel', '', false)}
            {field('email', 'Indirizzo e-mail', 'email', '', false)}
            {field('iban', 'Coordinate bancarie (IBAN)', 'text', '', false)}
          </div>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm font-semibold">
          <input type="checkbox" checked={values.allegaRegolamento !== false} onChange={event => change('allegaRegolamento', event.target.checked)} />
          Allega il regolamento interno al contratto ({NUMERO_PAGINE_REGOLAMENTO} pagine)
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
        <button type="submit" className="rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500">Controlla e stampa il contratto</button>
        <button type="submit" value="word" className="ml-3 rounded-lg bg-slate-700 px-5 py-3 font-bold text-white hover:bg-slate-600">Scarica Word</button>
      </form>
      <details className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <summary className="cursor-pointer font-bold">Anteprima del contratto</summary>
        <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow">
          <PrintableContrattoAssunzione formData={values} aziendaData={azienda} includeRegolamento={false} previewMode />
        </div>
      </details>
      {createPortal(<div className="hidden print:block"><PrintableContrattoAssunzione formData={values} aziendaData={azienda} includeRegolamento={false} /></div>, document.body)}
    </>}
  </section>;
}
