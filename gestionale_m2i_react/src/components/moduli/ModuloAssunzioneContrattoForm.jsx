import { useEffect, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { recuperaDatiAzienda } from '../../api/azienda';
import { workflowRequest } from '../../api/workflowElaborati';
import { companyStampUrl } from '../../utils/companyStampUrl';
import { downloadWord } from '../../utils/downloadWord';
import { provinciaDaComune } from '../../utils/provinciaDaComune';
import { domicilioUnilav } from '../../pages/AzioniVeloci/domicilioUnilav';
import PrintableContrattoAssunzione from './PrintableContrattoAssunzione';
import { NUMERO_PAGINE_REGOLAMENTO } from './RegolamentoInterno';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white';
const withoutCode = value => String(value || '').replace(/^[\d.]+\s*-\s*/, '').trim();
const todayItaly = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const formatDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? `${value.slice(8)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : value || '—';

function fromEmployee(employee) {
  const personal = employee?.unilavDati?.anagrafica || {};
  const work = employee?.unilavDati?.rapporto || {};
  const domicile = domicilioUnilav(personal);
  const citta = employee?.citta || domicile.citta || '';
  const scadenza = employee?.scadenza || employee?.dataFine || '';
  const tipo = /indeterminato/i.test(employee?.stato || '') ? 'Indeterminato'
    : /determinato/i.test(employee?.stato || '') || scadenza ? 'Determinato' : '';
  const ore = work.oreSettimanaliMedie || '';
  return {
    cognome: employee?.cognome || '', nome: employee?.nome || '', codiceFiscale: employee?.codice_fiscale || personal.codiceFiscale || '', sesso: employee?.sesso || personal.sesso || '',
    indirizzo: employee?.indirizzo || domicile.indirizzo || '', cap: employee?.cap || domicile.cap || '',
    citta, provincia: employee?.provincia || provinciaDaComune(citta),
    telefono: employee?.telefono || '', email: employee?.email || '', iban: employee?.iban || '',
    dataFirma: todayItaly(), dataInizio: employee?.dataAssunzione || employee?.data_assunzione || '',
    tipoContratto: tipo, tipoOrario: work.tipoOrario || '', codiceComunicazione: '', dataFine: scadenza,
    qualifica: withoutCode(work.qualificaProfessionale) || employee?.mansione || '',
    mansioni: employee?.mansione || '',
    livelloCCNL: withoutCode(work.livelloInquadramento || employee?.livello_inquadramento) || '',
    oreSettimanali: ore ? `${ore} ore settimanali${/parziale/i.test(work.tipoOrario || '') ? ' part time' : ''}` : '',
    periodoProva: '10', ccnlRetribuzione: work.ccnl ? `C.C.N.L. ${withoutCode(work.ccnl)}` : 'CCNL PULIZIA',
    sedeLavoro: work.sedeLavoro || '', allegaRegolamento: true
  };
}

function fromUnilav(unilav, current) {
  const worker = unilav.dipendente || {};
  const work = unilav.rapporto || {};
  const domicile = domicilioUnilav(worker);
  const citta = domicile.citta || current.citta;
  const qualifica = withoutCode(work.qualificaProfessionale);
  const ore = String(work.oreSettimanaliMedie || '').trim();
  return {
    ...current, cognome: worker.cognome || current.cognome, nome: worker.nome || current.nome,
    sesso: worker.sesso || current.sesso, indirizzo: domicile.indirizzo || current.indirizzo,
    cap: domicile.cap || current.cap, citta, provincia: provinciaDaComune(citta) || current.provincia,
    dataInizio: work.dataOperazione || work.dataInizio || current.dataInizio,
    tipoContratto: /A\.01\.00|TEMPO INDETERMINATO/i.test(work.tipologiaContrattuale || '') ? 'Indeterminato' : 'Determinato',
    tipoOrario: work.tipoOrario || current.tipoOrario,
    codiceComunicazione: unilav.codiceComunicazione || current.codiceComunicazione,
    dataFine: work.dataFine || current.dataFine,
    qualifica: qualifica || current.qualifica,
    mansioni: current.mansioni || (/operai/i.test(qualifica) ? 'operaio' : ''),
    livelloCCNL: [withoutCode(work.livelloInquadramento), work.ccnl ? `C.C.N.L. ${withoutCode(work.ccnl)}` : ''].filter(Boolean).join(' ') || current.livelloCCNL,
    oreSettimanali: ore ? `${ore} ore settimanali${/parziale/i.test(work.tipoOrario || '') ? ' part time' : ''}` : current.oreSettimanali,
    ccnlRetribuzione: work.ccnl ? `C.C.N.L. ${withoutCode(work.ccnl)}` : current.ccnlRetribuzione,
    sedeLavoro: work.sedeLavoro || current.sedeLavoro
  };
}

function Detail({ label, value }) {
  if (!value) return null;
  return <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="mt-1 break-words text-sm text-slate-100">{value}</dd>
  </div>;
}

export default function ModuloAssunzioneContrattoForm({ dipendenteData, onClose, onGenerate }) {
  const [source, setSource] = useState('');
  const [azienda, setAzienda] = useState(null);
  const [unilav, setUnilav] = useState(null);
  const [fileName, setFileName] = useState('');
  const [values, setValues] = useState(() => fromEmployee(dipendenteData));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    recuperaDatiAzienda().then(result => { if (active) setAzienda(Array.isArray(result) ? result[0] : result); })
      .catch(() => { if (active) setError('Impossibile caricare i dati della Scheda M2I.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, [onClose]);

  const change = (key, value) => setValues(current => key === 'citta'
    ? { ...current, citta: value, provincia: provinciaDaComune(value) }
    : { ...current, [key]: value });
  const field = (key, label, type = 'text', required = true, hint = '') => <label key={key} className="block text-sm font-semibold text-slate-200">
    {label}{required && ' *'}
    <input type={type} required={required} value={values[key] || ''} onChange={event => change(key, event.target.value)} className={inputClass} />
    {hint && <span className="mt-1 block text-xs font-normal text-slate-400">{hint}</span>}
  </label>;

  const importFile = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setFileName(file.name); setUnilav(null);
    if (!/\.pdf$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
      setError('Carica un PDF UNILAV fino a 10 MB.'); return;
    }
    setLoading(true);
    try {
      const body = new FormData(); body.append('file', file);
      const preview = await workflowRequest('azioni-veloci/unilav/anteprima', { method: 'POST', body });
      if (preview.unilav?.tipo !== 'assunzione') throw new Error('Per il contratto di assunzione carica un UNILAV di assunzione.');
      setUnilav(preview.unilav);
      setValues(current => fromUnilav(preview.unilav, current));
    } catch (err) { setError(err.message || 'Impossibile leggere l’UNILAV.'); }
    finally { setLoading(false); }
  };

  const submit = async event => {
    event.preventDefault(); setError('');
    if (values.tipoContratto === 'Determinato' && values.dataFine <= values.dataInizio) {
      setError('La fine del contratto deve essere successiva alla data di inizio.'); return;
    }
    if (!values.qualifica.trim() && !values.mansioni.trim()) {
      setError('Compila la qualifica o le mansioni da riportare nel contratto.'); return;
    }
    if (!companyStampUrl(azienda?.timbro_path)) {
      setError('Carica il timbro con firma nella Scheda M2I prima di creare il contratto.'); return;
    }
    if (event.nativeEvent.submitter?.value === 'word') {
      setSaving(true);
      try { await downloadWord('assunzione', values, azienda); }
      catch (err) { setError(err.message || 'Impossibile creare il file Word.'); }
      finally { setSaving(false); }
    } else onGenerate(values, azienda);
  };

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-2 sm:p-4 lg:p-8" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="modulo-assunzione-title" className="flex h-full max-h-[960px] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 text-slate-100 shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-700 px-5 py-4 sm:px-7">
        <div><h2 id="modulo-assunzione-title" className="text-2xl font-bold">Lettera di assunzione (contratto)</h2>
          <p className="mt-1 text-sm text-slate-300">{dipendenteData?.cognome} {dipendenteData?.nome} · I dati inseriti qui servono solo a creare il modulo.</p></div>
        <button type="button" onClick={onClose} aria-label="Chiudi" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"><X className="h-5 w-5" /></button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-7">
        {!source ? <section className="space-y-4">
          <p className="text-sm text-slate-300">Come vuoi compilare il contratto?</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={() => { setSource('manuale'); setError(''); }} className="rounded-xl border border-slate-600 bg-slate-800 p-5 text-left hover:border-indigo-400">
              <FileText className="mb-3 h-6 w-6 text-indigo-300" /><strong className="block text-lg">Inserire dati manualmente</strong><span className="mt-1 block text-sm text-slate-300">Completa e correggi i dati già presenti nella scheda.</span>
            </button>
            <button type="button" onClick={() => { setSource('unilav'); setError(''); }} className="rounded-xl border border-slate-600 bg-slate-800 p-5 text-left hover:border-indigo-400">
              <Upload className="mb-3 h-6 w-6 text-indigo-300" /><strong className="block text-lg">Allega UNILAV</strong><span className="mt-1 block text-sm text-slate-300">Leggi il PDF e correggi liberamente i dati prima della stampa.</span>
            </button>
          </div>
        </section> : <>
          <button type="button" onClick={() => { setSource(''); setUnilav(null); setFileName(''); setValues(fromEmployee(dipendenteData)); setError(''); }} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold">Cambia metodo</button>
          {source === 'unilav' && <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <label className="block text-sm font-semibold">Allega UNILAV di assunzione (PDF)
              <input type="file" accept=".pdf,application/pdf" onChange={importFile} className={`${inputClass} block p-3 text-sm`} /></label>
            {loading && <p role="status" className="mt-3 text-sm text-slate-300">Lettura dell’UNILAV in corso...</p>}
            {fileName && !loading && <p className="mt-2 text-sm text-slate-300">File: {fileName}</p>}
            <p className="mt-2 text-xs text-slate-400">Il PDF viene letto in anteprima. Non viene allegato né salvato nella scheda dipendente.</p>
          </section>}
          {unilav && <section className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-5">
            <h3 className="text-xl font-bold">Dati letti dall’UNILAV</h3>
            <p className="mt-1 text-sm text-slate-300">Verifica i dati del documento. Puoi modificare tutti i campi del contratto qui sotto.</p>
            {dipendenteData?.codice_fiscale && unilav.dipendente?.codiceFiscale &&
              dipendenteData.codice_fiscale.toUpperCase() !== unilav.dipendente.codiceFiscale.toUpperCase() &&
              <p className="mt-3 rounded-lg bg-amber-950/60 p-3 text-sm text-amber-200">Il codice fiscale nell’UNILAV è diverso da quello della scheda selezionata. Controlla il nominativo prima di stampare.</p>}
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Lavoratore" value={`${unilav.dipendente?.cognome || ''} ${unilav.dipendente?.nome || ''}`} />
              <Detail label="Codice fiscale" value={unilav.dipendente?.codiceFiscale} />
              <Detail label="Codice comunicazione" value={unilav.codiceComunicazione} />
              <Detail label="Protocollo" value={unilav.protocollo} />
              <Detail label="Data invio" value={formatDate(unilav.dataInvio)} />
              <Detail label="Data inizio" value={formatDate(unilav.rapporto?.dataOperazione)} />
              <Detail label="Data fine" value={formatDate(unilav.rapporto?.dataFine)} />
              <Detail label="Domicilio" value={unilav.dipendente?.comuneDomicilio} />
              <Detail label="Indirizzo domicilio" value={unilav.dipendente?.indirizzoDomicilio} />
              <Detail label="Tipo orario" value={unilav.rapporto?.tipoOrario} />
              <Detail label="Ore settimanali" value={unilav.rapporto?.oreSettimanaliMedie} />
              <Detail label="Qualifica" value={unilav.rapporto?.qualificaProfessionale} />
              <Detail label="Livello" value={unilav.rapporto?.livelloInquadramento} />
              <Detail label="CCNL" value={unilav.rapporto?.ccnl} />
              <Detail label="Sede lavoro" value={unilav.rapporto?.sedeLavoro} />
            </dl>
            <details className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-4">
              <summary className="cursor-pointer font-semibold">Altri dati letti dall’UNILAV</summary>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Sesso" value={unilav.dipendente?.sesso} />
                <Detail label="Data di nascita" value={formatDate(unilav.dipendente?.dataNascita)} />
                <Detail label="Comune di nascita" value={unilav.dipendente?.comuneNascita} />
                <Detail label="Cittadinanza" value={unilav.dipendente?.cittadinanza} />
                <Detail label="Livello istruzione" value={unilav.dipendente?.livelloIstruzione} />
                <Detail label="Tipologia contrattuale" value={unilav.rapporto?.tipologiaContrattuale} />
                <Detail label="Ente previdenziale" value={unilav.rapporto?.entePrevidenziale} />
                <Detail label="PAT INAIL" value={unilav.rapporto?.patInail} />
                <Detail label="Retribuzione UNILAV" value={unilav.rapporto?.retribuzioneUnilav} />
                <Detail label="Titolo di soggiorno" value={unilav.dipendente?.titoloSoggiorno} />
                <Detail label="Motivo soggiorno" value={unilav.dipendente?.motivoSoggiorno} />
                <Detail label="Scadenza soggiorno" value={formatDate(unilav.dipendente?.scadenzaSoggiorno)} />
                <Detail label="Numero titolo soggiorno" value={unilav.dipendente?.numeroSoggiorno} />
                <Detail label="Questura" value={unilav.dipendente?.questura} />
              </dl>
            </details>
          </section>}
          {(source === 'manuale' || unilav) && <form id="modulo-assunzione-form" onSubmit={submit} className="space-y-5">
            <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <h3 className="mb-4 text-lg font-bold">Riepilogo anagrafico</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {field('cognome', 'Cognome')}{field('nome', 'Nome')}
                <label className="block text-sm font-semibold">Sesso *<select required value={values.sesso} onChange={event => change('sesso', event.target.value)} className={inputClass}>
                  <option value="">Seleziona</option><option value="M">Maschio</option><option value="F">Femmina</option></select></label>
                {field('indirizzo', 'Indirizzo di residenza')}{field('cap', 'CAP')}{field('citta', 'Comune di residenza')}{field('provincia', 'Provincia')}
              </div>
            </section>
            <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <h3 className="mb-4 text-lg font-bold">Condizioni del contratto</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {field('dataFirma', 'Data di firma', 'date')}{field('dataInizio', 'Data di inizio', 'date')}
                <label className="block text-sm font-semibold">Tipo contratto *<select required value={values.tipoContratto} onChange={event => change('tipoContratto', event.target.value)} className={inputClass}>
                  <option value="">Seleziona</option><option value="Determinato">Determinato</option><option value="Indeterminato">Indeterminato</option></select></label>
                {values.tipoContratto === 'Determinato' && field('dataFine', 'Data di fine', 'date')}
                {field('tipoOrario', 'Tipo orario', 'text', true, 'Tempo parziale o tempo pieno; determina il titolo della lettera.')}
                {field('codiceComunicazione', 'Codice comunicazione UNILAV', 'text', false)}
                {field('qualifica', 'Qualifica', 'text', false)}{field('mansioni', 'Mansioni', 'text', false)}
                {field('livelloCCNL', 'Livello')}{field('oreSettimanali', 'Orario settimanale')}
                {field('periodoProva', 'Giorni di prova', 'number')}
                {field('ccnlRetribuzione', 'CCNL della retribuzione')}{field('sedeLavoro', 'Sede di lavoro', 'text', false, 'Se vuota, usa la sede M2I.')}
              </div>
            </section>
            <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <h3 className="text-lg font-bold">Recapiti e coordinate</h3>
              <p className="mb-4 mt-1 text-sm text-slate-400">Facoltativi: se restano vuoti, il dipendente potrà compilarli a mano sul contratto.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {field('telefono', 'Recapito telefonico', 'tel', false)}
                {field('email', 'Indirizzo e-mail', 'email', false)}
                {field('iban', 'Coordinate bancarie (IBAN)', 'text', false)}
              </div>
            </section>
            <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm font-semibold"><input type="checkbox" checked={values.allegaRegolamento} onChange={event => change('allegaRegolamento', event.target.checked)} />Allega il regolamento interno al contratto ({NUMERO_PAGINE_REGOLAMENTO} pagine)</label>
            <details className="rounded-xl border border-slate-700 bg-slate-800 p-4"><summary className="cursor-pointer font-bold">Anteprima del contratto</summary>
              <div className="mt-4 overflow-x-auto rounded-lg bg-white"><PrintableContrattoAssunzione formData={values} aziendaData={azienda} includeRegolamento={false} previewMode /></div>
            </details>
            {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>}
            <div className="flex flex-wrap gap-3 border-t border-slate-700 pt-4">
              <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white disabled:opacity-50">Stampa PDF</button>
              <button type="submit" value="word" disabled={saving} className="rounded-lg bg-slate-700 px-5 py-3 font-bold text-white disabled:opacity-50">Scarica Word</button>
            </div>
          </form>}
        </>}
        {error && !(source === 'manuale' || unilav) && <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>}
      </div>
    </div>
  </div>;
}
