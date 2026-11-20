import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Upload, X } from 'lucide-react';
import { recuperaDatiAzienda } from '../../api/azienda';
import { workflowRequest } from '../../api/workflowElaborati';
import { companyStampUrl } from '../../utils/companyStampUrl';
import { downloadWord } from '../../utils/downloadWord';
import { provinciaDaComune } from '../../utils/provinciaDaComune';
import { domicilioUnilav } from '../../pages/AzioniVeloci/domicilioUnilav';
import { stampaLetteraProroga } from '../../utils/printLetteraProroga';
import { stampaLetteraTrasformazione } from '../../utils/printLetteraTrasformazione';
import PrintableLetteraProroga from './PrintableLetteraProroga';
import PrintableLetteraTrasformazione from './PrintableLetteraTrasformazione';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white';
const todayItaly = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateValue = value => String(value || '').slice(0, 10);
const dateIt = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? `${value.slice(8)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : value || '—';

function fromEmployee(employee, tipo) {
  const personal = employee?.unilavDati?.anagrafica || {};
  const domicilio = domicilioUnilav(personal);
  const citta = employee?.citta || domicilio.citta || '';
  return {
    cognome: employee?.cognome || '', nome: employee?.nome || '',
    indirizzo: employee?.indirizzo || domicilio.indirizzo || '',
    cap: employee?.cap || domicilio.cap || '', citta,
    provincia: employee?.provincia || provinciaDaComune(citta),
    dataFirma: todayItaly(),
    dataAssunzione: dateValue(employee?.data_assunzione || employee?.dataAssunzione),
    ...(tipo === 'proroga' ? { nuovaScadenza: '' } : {
      dataTrasformazione: dateValue(employee?.data_trasformazione_indeterminato) })
  };
}

function fromUnilav(current, unilav, tipo) {
  const worker = unilav.dipendente || {};
  const rapporto = unilav.rapporto || {};
  const domicilio = domicilioUnilav(worker);
  const citta = domicilio.citta || current.citta;
  return {
    ...current, cognome: worker.cognome || current.cognome, nome: worker.nome || current.nome,
    indirizzo: domicilio.indirizzo || current.indirizzo, cap: domicilio.cap || current.cap,
    citta, provincia: provinciaDaComune(citta) || current.provincia,
    dataAssunzione: dateValue(current.dataAssunzione || rapporto.dataInizio),
    [tipo === 'proroga' ? 'nuovaScadenza' : 'dataTrasformazione']: dateValue(rapporto.dataOperazione)
  };
}

function Detail({ label, value }) {
  if (!value) return null;
  return <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="mt-1 break-words text-sm text-slate-100">{value}</dd>
  </div>;
}

export default function ModuloLetteraRapportoForm({ tipo, dipendenteData, onClose }) {
  const proroga = tipo === 'proroga';
  const title = proroga ? 'Lettera di proroga' : 'Lettera di trasformazione';
  const [source, setSource] = useState('');
  const [azienda, setAzienda] = useState(null);
  const [unilav, setUnilav] = useState(null);
  const [fileName, setFileName] = useState('');
  const [values, setValues] = useState(() => fromEmployee(dipendenteData, tipo));
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
  const field = (key, label, type = 'text') => <label key={key} className="block text-sm font-semibold text-slate-200">
    {label} *<input type={type} required value={values[key] || ''} onChange={event => change(key, event.target.value)} className={inputClass} />
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
      if (preview.unilav?.tipo !== tipo) throw new Error(`Carica un UNILAV di ${proroga ? 'proroga' : 'trasformazione a tempo indeterminato'}.`);
      setUnilav(preview.unilav);
      setValues(current => fromUnilav(current, preview.unilav, tipo));
    } catch (err) { setError(err.message || 'Impossibile leggere l’UNILAV.'); }
    finally { setLoading(false); }
  };

  const submit = async event => {
    event.preventDefault(); setError('');
    const operationDate = proroga ? values.nuovaScadenza : values.dataTrasformazione;
    if (operationDate < values.dataAssunzione || proroga && operationDate === values.dataAssunzione) {
      setError(proroga ? 'La nuova scadenza deve essere successiva alla data di assunzione.' : 'La trasformazione non può precedere l’assunzione.'); return;
    }
    if (!companyStampUrl(azienda?.timbro_path)) {
      setError('Carica il timbro con firma nella Scheda M2I prima di stampare.'); return;
    }
    if (event.nativeEvent.submitter?.value === 'word') {
      setSaving(true);
      try { await downloadWord(tipo, values, azienda); }
      catch (err) { setError(err.message || 'Impossibile creare il file Word.'); }
      finally { setSaving(false); }
    } else if (proroga) stampaLetteraProroga(values);
    else stampaLetteraTrasformazione(values);
  };

  const Printable = proroga ? PrintableLetteraProroga : PrintableLetteraTrasformazione;
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-2 sm:p-4 lg:p-8" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="modulo-rapporto-title" className="flex h-full max-h-[960px] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 text-slate-100 shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-700 px-5 py-4 sm:px-7">
        <div><h2 id="modulo-rapporto-title" className="text-2xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-slate-300">{dipendenteData?.cognome} {dipendenteData?.nome} · I dati inseriti qui servono solo a creare il modulo.</p></div>
        <button type="button" onClick={onClose} aria-label="Chiudi" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"><X className="h-5 w-5" /></button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-7">
        {!source ? <section className="space-y-4">
          <p className="text-sm text-slate-300">Come vuoi compilare la lettera?</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={() => { setSource('manuale'); setError(''); }} className="rounded-xl border border-slate-600 bg-slate-800 p-5 text-left hover:border-indigo-400">
              <FileText className="mb-3 h-6 w-6 text-indigo-300" /><strong className="block text-lg">Inserire dati manualmente</strong><span className="mt-1 block text-sm text-slate-300">Completa i dati della lettera partendo dalla scheda dipendente.</span>
            </button>
            <button type="button" onClick={() => { setSource('unilav'); setError(''); }} className="rounded-xl border border-slate-600 bg-slate-800 p-5 text-left hover:border-indigo-400">
              <Upload className="mb-3 h-6 w-6 text-indigo-300" /><strong className="block text-lg">Allega UNILAV</strong><span className="mt-1 block text-sm text-slate-300">Leggi il PDF e correggi liberamente i dati prima della stampa.</span>
            </button>
          </div>
        </section> : <>
          <button type="button" onClick={() => { setSource(''); setUnilav(null); setFileName(''); setValues(fromEmployee(dipendenteData, tipo)); setError(''); }} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold">Cambia metodo</button>
          {source === 'unilav' && <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <label className="block text-sm font-semibold">Allega UNILAV di {proroga ? 'proroga' : 'trasformazione'} (PDF)
              <input type="file" accept=".pdf,application/pdf" onChange={importFile} className={`${inputClass} block p-3 text-sm`} /></label>
            {loading && <p role="status" className="mt-3 text-sm text-slate-300">Lettura dell’UNILAV in corso...</p>}
            {fileName && !loading && <p className="mt-2 text-sm text-slate-300">File: {fileName}</p>}
            <p className="mt-2 text-xs text-slate-400">Il PDF viene letto in anteprima. Non viene allegato né salvato nella scheda dipendente.</p>
          </section>}
          {unilav && <section className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-5">
            <h3 className="text-xl font-bold">Dati letti dall’UNILAV</h3>
            <p className="mt-1 text-sm text-slate-300">Controlla il documento; i campi della lettera qui sotto restano modificabili.</p>
            {dipendenteData?.codice_fiscale && unilav.dipendente?.codiceFiscale &&
              dipendenteData.codice_fiscale.toUpperCase() !== unilav.dipendente.codiceFiscale.toUpperCase() &&
              <p className="mt-3 rounded-lg bg-amber-950/60 p-3 text-sm text-amber-200">Il codice fiscale nell’UNILAV è diverso da quello della scheda selezionata. Controlla il nominativo prima di stampare.</p>}
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Lavoratore" value={`${unilav.dipendente?.cognome || ''} ${unilav.dipendente?.nome || ''}`} />
              <Detail label="Codice fiscale" value={unilav.dipendente?.codiceFiscale} />
              <Detail label="Codice comunicazione" value={unilav.codiceComunicazione} />
              <Detail label="Protocollo" value={unilav.protocollo} />
              <Detail label="Data invio" value={dateIt(unilav.dataInvio)} />
              <Detail label={proroga ? 'Data proroga' : 'Data trasformazione'} value={dateIt(unilav.rapporto?.dataOperazione)} />
              <Detail label="Data inizio originaria" value={dateIt(unilav.rapporto?.dataInizio)} />
              <Detail label="Domicilio" value={unilav.dipendente?.comuneDomicilio} />
              <Detail label="Indirizzo domicilio" value={unilav.dipendente?.indirizzoDomicilio} />
            </dl>
            <details className="mt-4 rounded-lg border border-slate-700 bg-slate-900/40 p-4">
              <summary className="cursor-pointer font-semibold">Altri dati letti dall’UNILAV</summary>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Sesso" value={unilav.dipendente?.sesso} />
                <Detail label="Data di nascita" value={dateIt(unilav.dipendente?.dataNascita)} />
                <Detail label="Comune di nascita" value={unilav.dipendente?.comuneNascita} />
                <Detail label="Cittadinanza" value={unilav.dipendente?.cittadinanza} />
                <Detail label="Tipo orario" value={unilav.rapporto?.tipoOrario} />
                <Detail label="Ore settimanali" value={unilav.rapporto?.oreSettimanaliMedie} />
                <Detail label="Qualifica" value={unilav.rapporto?.qualificaProfessionale} />
                <Detail label="Livello" value={unilav.rapporto?.livelloInquadramento} />
                <Detail label="CCNL" value={unilav.rapporto?.ccnl} />
                <Detail label="Sede lavoro" value={unilav.rapporto?.sedeLavoro} />
              </dl>
            </details>
          </section>}
          {(source === 'manuale' || unilav) && <form onSubmit={submit} className="space-y-5">
            <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <h3 className="mb-4 text-lg font-bold">Destinatario e recapito</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {field('cognome', 'Cognome')}{field('nome', 'Nome')}{field('indirizzo', 'Indirizzo')}
                {field('cap', 'CAP')}{field('citta', 'Comune')}{field('provincia', 'Provincia')}
              </div>
            </section>
            <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
              <h3 className="mb-4 text-lg font-bold">Dati della {proroga ? 'proroga' : 'trasformazione'}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {field('dataFirma', 'Data della lettera', 'date')}
                {field('dataAssunzione', 'Assunzione originaria', 'date')}
                {proroga ? field('nuovaScadenza', 'Nuova scadenza', 'date') : field('dataTrasformazione', 'Decorrenza indeterminato', 'date')}
              </div>
            </section>
            <details className="rounded-xl border border-slate-700 bg-slate-800 p-4"><summary className="cursor-pointer font-bold">Anteprima della lettera</summary>
              <div className="mt-4 overflow-x-auto rounded-lg bg-white"><Printable data={values} azienda={azienda} previewMode /></div>
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
      {createPortal(<div className="hidden print:block"><Printable data={values} azienda={azienda} /></div>, document.body)}
    </div>
  </div>;
}
