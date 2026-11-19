import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { workflowRequest } from '../../api/workflowElaborati';
import ContrattoUnilav from './ContrattoUnilav';
import LetteraTrasformazioneForm from '../../components/moduli/LetteraTrasformazioneForm';
import LetteraProrogaForm from '../../components/moduli/LetteraProrogaForm';
import { domicilioUnilav } from './domicilioUnilav';

const labels = {
  assunzione: 'Assunzione', proroga: 'Proroga',
  trasformazione: 'Trasformazione a tempo indeterminato', cessazione: 'Cessazione'
};
const dateIt = value => value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : '—';
const employeeName = employee => `${employee.cognome} ${employee.nome}`;
const textField = (label, value, onChange, type = 'text') => <label className="block text-sm font-semibold text-slate-200">{label}
  <input type={type} step={type === 'number' ? '0.01' : undefined} value={value} onChange={event => onChange(event.target.value)}
    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" /></label>;
const detail = (label, value) => value ? <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
  <dd className="mt-1 break-words text-sm text-slate-100">{value}</dd>
</div> : null;

const UnilavReview = forwardRef(function UnilavReview({ file, preview, initialDraft, onSaved }, ref) {
  const navigate = useNavigate();
  const { unilav, candidati, dipendenti, giaImportato, aziendaDiversa } = preview;
  const exact = candidati.find(employee => employee.match === 'Codice fiscale esatto');
  const [mode, setMode] = useState(initialDraft?.values?.mode || (unilav.tipo === 'assunzione' && !candidati.length ? 'nuovo' : 'esistente'));
  const [selectedId, setSelectedId] = useState(initialDraft?.values?.selectedId || exact?.id || candidati[0]?.id || '');
  const [search, setSearch] = useState('');
  const [confirmMismatch, setConfirmMismatch] = useState(initialDraft?.values?.confirmMismatch || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showContract, setShowContract] = useState(false);
  const [contractDraft, setContractDraft] = useState(initialDraft?.values?.contractDraft || null);
  const [draftId, setDraftId] = useState(initialDraft?.id || null);
  const [showTransformationLetter, setShowTransformationLetter] = useState(false);
  const [transformationDraft, setTransformationDraft] = useState(null);
  const [showExtensionLetter, setShowExtensionLetter] = useState(false);
  const [extensionDraft, setExtensionDraft] = useState(null);
  const [confirmedEmployee, setConfirmedEmployee] = useState(null);
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState({
    cognome: unilav.dipendente.cognome, nome: unilav.dipendente.nome,
    codiceFiscale: unilav.dipendente.codiceFiscale,
    ...domicilioUnilav(unilav.dipendente), telefono: '', email: '', iban: '',
    mansione: '', divisione: 'Esterno', tipoPaga: '', retribuzione: '',
    ...initialDraft?.values?.nuovo
  });
  useImperativeHandle(ref, () => ({ saveDraftOnClose: async () => {
    if (saved || unilav.tipo !== 'assunzione' || (!draftId && mode !== 'nuovo')) return null;
    const values = { mode, selectedId, confirmMismatch, nuovo: draft, contractDraft };
    setBusy(true); setError('');
    try {
      let result;
      if (draftId) result = await workflowRequest(`azioni-veloci/unilav/bozze/${encodeURIComponent(draftId)}`, {
        method: 'PUT', body: JSON.stringify(values)
      });
      else {
        const body = new FormData();
        body.append('file', file);
        body.append('values', JSON.stringify(values));
        result = await workflowRequest('azioni-veloci/unilav/bozze', { method: 'POST', body });
      }
      setDraftId(result.id);
      return result;
    } catch (err) {
      setError(err.message || 'Impossibile salvare la bozza.');
      throw err;
    } finally { setBusy(false); }
  } }));
  const change = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const selected = dipendenti.find(employee => employee.id === selectedId);
  const mismatch = selected && selected.codiceFiscale?.toUpperCase() !== unilav.dipendente.codiceFiscale;
  const filtered = useMemo(() => dipendenti.filter(employee =>
    `${employee.cognome} ${employee.nome} ${employee.codiceFiscale}`.toLocaleLowerCase('it-IT')
      .includes(search.trim().toLocaleLowerCase('it-IT'))).slice(0, 30), [dipendenti, search]);
  const canConfirm = !giaImportato && !aziendaDiversa && !busy && !saved &&
    (mode === 'nuovo' ? Boolean(draft.cognome.trim() && draft.nome.trim() &&
      draft.codiceFiscale.toUpperCase() === unilav.dipendente.codiceFiscale &&
      draft.tipoPaga && Number(draft.retribuzione) > 0) :
      Boolean(selectedId && (!mismatch || confirmMismatch)));
  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true); setError('');
    try {
      const options = mode === 'nuovo'
        ? { mode, nuovo: draft }
        : { mode, dipendenteId: selectedId, confermaCodiceFiscaleDifferente: confirmMismatch };
      let result;
      if (draftId) result = await workflowRequest(`azioni-veloci/unilav/bozze/${encodeURIComponent(draftId)}/conferma`, {
        method: 'POST', body: JSON.stringify(options)
      });
      else {
        const body = new FormData();
        body.append('file', file);
        body.append('options', JSON.stringify(options));
        result = await workflowRequest('azioni-veloci/unilav/conferma', { method: 'POST', body });
      }
      if (unilav.tipo === 'assunzione' || unilav.tipo === 'trasformazione' || unilav.tipo === 'proroga') {
        if (unilav.tipo === 'trasformazione') setConfirmedEmployee(selected);
        setSaved(result);
      }
      else {
        onSaved(result);
        navigate(`/admin/dipendenti/scheda/${encodeURIComponent(result.dipendenteId)}`);
      }
    } catch (err) { setError(err.message || 'Impossibile salvare l’UNILAV.'); }
    finally { setBusy(false); }
  };
  const operation = unilav.rapporto;
  if (showContract) return <ContrattoUnilav unilav={unilav} draft={draft} selected={mode === 'esistente' ? selected : null}
    savedValues={contractDraft} onDraftChange={setContractDraft} onClose={values => {
      setContractDraft(values);
      if (mode === 'nuovo' && !saved) setDraft(current => ({ ...current,
        cognome: values.cognome, nome: values.nome, indirizzo: values.indirizzo,
        cap: values.cap, citta: values.citta, mansione: values.mansioni }));
      setShowContract(false);
    }} />;
  if (showTransformationLetter) return <LetteraTrasformazioneForm unilav={unilav} employee={confirmedEmployee || selected}
    savedValues={transformationDraft} onClose={values => {
      setTransformationDraft(values);
      setShowTransformationLetter(false);
    }} />;
  if (showExtensionLetter) return <LetteraProrogaForm unilav={unilav} employee={selected}
    nuovaScadenza={operation.dataOperazione} savedValues={extensionDraft} onClose={values => {
      setExtensionDraft(values);
      setShowExtensionLetter(false);
    }} />;
  return <div className="space-y-6 text-slate-100">
    {saved && <div role="status" className="rounded-lg border border-emerald-700 bg-emerald-950/50 p-4 text-emerald-100">
      UNILAV salvato nella scheda {saved.dipendenteId}.
      <button type="button" onClick={() => navigate(`/admin/dipendenti/scheda/${encodeURIComponent(saved.dipendenteId)}`)}
        className="ml-3 font-bold underline">Apri la scheda dipendente</button>
    </div>}
    {giaImportato && <p role="status" className="rounded-lg border border-amber-700 bg-amber-950/50 p-4 text-amber-200">Questa comunicazione è già presente nella scheda {giaImportato.dipendenteId}.</p>}
    {aziendaDiversa && <p role="alert" className="rounded-lg border border-red-700 bg-red-950/50 p-4 text-red-200">Il codice fiscale del datore di lavoro non coincide con quello dell’azienda nel gestionale. Verifica il documento.</p>}
    <section className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-5">
      <h3 className="text-xl font-bold">{labels[unilav.tipo]}</h3>
      <p className="mt-2 text-sm text-slate-200">Lavoratore: <strong>{unilav.dipendente.cognome} {unilav.dipendente.nome}</strong> · CF <strong>{unilav.dipendente.codiceFiscale}</strong></p>
      <p className="mt-1 text-sm text-slate-300">Datore: {unilav.azienda.denominazione} · Comunicazione {unilav.codiceComunicazione} · Protocollo {unilav.protocollo || '—'}</p>
      <p className="mt-1 text-sm text-slate-300">Data indicata nell’UNILAV: <strong>{dateIt(operation.dataOperazione)}</strong></p>
    </section>

    <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
      <h3 className="text-lg font-bold">Scheda dipendente</h3>
      {unilav.tipo === 'assunzione' && <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => { setMode('nuovo'); setContractDraft(null); }} aria-pressed={mode === 'nuovo'}
          className={`rounded-lg px-4 py-2 font-semibold ${mode === 'nuovo' ? 'bg-indigo-600' : 'bg-slate-700'}`}>Nuova scheda</button>
        <button type="button" onClick={() => { setMode('esistente'); setContractDraft(null); }} aria-pressed={mode === 'esistente'}
          className={`rounded-lg px-4 py-2 font-semibold ${mode === 'esistente' ? 'bg-indigo-600' : 'bg-slate-700'}`}>Dipendente già presente</button>
      </div>}
      {mode === 'esistente' ? <div className="mt-4 space-y-4">
        {candidati.length > 0 && <div><p className="mb-2 text-sm font-semibold text-slate-300">Corrispondenze suggerite</p>
          <div className="grid gap-2 sm:grid-cols-2">{candidati.map(employee => <button key={employee.id} type="button"
            onClick={() => { setSelectedId(employee.id); setConfirmMismatch(false); setContractDraft(null); setTransformationDraft(null); setExtensionDraft(null); }}
            className={`rounded-lg border p-3 text-left text-sm ${selectedId === employee.id ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-600 bg-slate-900'}`}>
            <strong>{employeeName(employee)}</strong> · {employee.id}<br />
            <span className="text-slate-300">{employee.codiceFiscale} · {employee.stato} · {employee.match}</span>
          </button>)}</div></div>}
        <label className="block text-sm font-semibold">Cerca un altro dipendente
          <input type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Nome, cognome o codice fiscale" className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2" /></label>
        {search && <div className="max-h-44 space-y-1 overflow-y-auto">{filtered.map(employee => <button key={employee.id} type="button"
          onClick={() => { setSelectedId(employee.id); setSearch(''); setConfirmMismatch(false); setContractDraft(null); setTransformationDraft(null); setExtensionDraft(null); }}
          className="block w-full rounded-lg bg-slate-900 px-3 py-2 text-left text-sm hover:bg-slate-700">
          {employeeName(employee)} · {employee.codiceFiscale} · {employee.stato}</button>)}</div>}
        {selected && <div className="rounded-lg bg-slate-900 p-4 text-sm">
          <strong>Dipendente da confermare: {employeeName(selected)}</strong> · {selected.id}<br />
          Stato attuale: {selected.stato} · Assunzione: {dateIt(selected.dataAssunzione)} · Scadenza da contratto: {dateIt(selected.scadenza)}
          {mismatch && <label className="mt-3 flex items-start gap-2 text-amber-200"><input type="checkbox" checked={confirmMismatch} onChange={event => setConfirmMismatch(event.target.checked)} />
            Il codice fiscale della scheda è diverso da quello dell’UNILAV. Confermo manualmente che è la stessa persona.</label>}
        </div>}
      </div> : <div className="mt-4">
        <p className="mb-4 text-sm text-slate-300">Completa i dati che non compaiono nell’UNILAV. La data di assunzione e la scadenza provengono dal documento.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {textField('Cognome *', draft.cognome, value => change('cognome', value))}
          {textField('Nome *', draft.nome, value => change('nome', value))}
          {textField('Codice fiscale *', draft.codiceFiscale, value => change('codiceFiscale', value.toUpperCase()))}
          {detail('Data di nascita', dateIt(unilav.dipendente.dataNascita))}
          {detail('Data assunzione', dateIt(operation.dataOperazione))}
          {detail('Scadenza contratto', dateIt(operation.dataFine))}
          {textField('Indirizzo di residenza', draft.indirizzo, value => change('indirizzo', value))}
          {textField('Comune di residenza', draft.citta, value => change('citta', value))}
          {textField('CAP di residenza', draft.cap, value => change('cap', value))}
          {textField('Telefono', draft.telefono, value => change('telefono', value), 'tel')}
          {textField('Email', draft.email, value => change('email', value), 'email')}
          {textField('IBAN', draft.iban, value => change('iban', value))}
          {textField('Mansione', draft.mansione, value => change('mansione', value))}
          <label className="block text-sm font-semibold">Tipo paga *<select value={draft.tipoPaga}
            onChange={event => change('tipoPaga', event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2">
            <option value="">Seleziona</option><option value="Oraria">Oraria</option><option value="Mensile">Mensile</option></select></label>
          {textField('Importo retributivo gestionale (€) *', draft.retribuzione, value => change('retribuzione', value), 'number')}
          <label className="block text-sm font-semibold">Divisione<select value={draft.divisione}
            onChange={event => change('divisione', event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2">
            <option value="Esterno">Esterno</option><option value="Interno">Interno</option></select></label>
        </div>
      </div>}
    </section>

    <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
      <h3 className="text-lg font-bold">Modifiche proposte</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {detail('Operazione', labels[unilav.tipo])}
        {detail(unilav.tipo === 'cessazione' ? 'Ultimo giorno di rapporto' : 'Data effettiva', dateIt(operation.dataOperazione))}
        {unilav.tipo === 'proroga' && <>{detail('Scadenza attuale', dateIt(selected?.scadenza))}{detail('Nuova scadenza', dateIt(operation.dataOperazione))}</>}
        {unilav.tipo === 'trasformazione' && <>{detail('Stato attuale', selected?.stato)}{detail('Nuovo stato', 'Indeterminato, senza scadenza')}</>}
        {unilav.tipo === 'cessazione' && detail('Motivo', operation.motivoCessazione)}
        {unilav.tipo === 'assunzione' && detail('Fine contratto indicata', dateIt(operation.dataFine))}
      </div>
      {unilav.tipo === 'cessazione' && <p className="mt-3 text-sm text-slate-200">Il dipendente risulta cessato dal giorno successivo all’ultimo giorno di rapporto indicato nell’UNILAV.</p>}
      {unilav.tipo === 'proroga' && selected?.scadenza && selected.scadenza >= operation.dataOperazione &&
        <p className="mt-3 text-sm text-amber-200">La scadenza in scheda è già uguale o successiva: l’UNILAV sarà conservato nello storico senza arretrare la scadenza.</p>}
      {unilav.tipo === 'assunzione' && mode === 'esistente' && <p className="mt-3 text-sm text-amber-200">Se la data di assunzione coincide con la scheda, l’UNILAV sarà allegato senza cambiare il rapporto esistente.</p>}
      <p className="mt-4 text-sm text-slate-300">La conferma salva anche il PDF nella scheda dipendente e conserva la comunicazione nello storico.</p>
    </section>

    <details className="rounded-xl border border-slate-700 bg-slate-800 p-5">
      <summary className="cursor-pointer font-bold">Altri dati letti dall’UNILAV</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {detail('Sesso', unilav.dipendente.sesso)}
        {detail('Cittadinanza', unilav.dipendente.cittadinanza)}
        {detail('Comune di nascita', unilav.dipendente.comuneNascita)}
        {detail('Domicilio', unilav.dipendente.comuneDomicilio)}
        {detail('Indirizzo domicilio', unilav.dipendente.indirizzoDomicilio)}
        {detail('Titolo di soggiorno', unilav.dipendente.titoloSoggiorno)}
        {detail('Motivo soggiorno', unilav.dipendente.motivoSoggiorno)}
        {detail('Scadenza soggiorno', dateIt(unilav.dipendente.scadenzaSoggiorno))}
        {detail('Numero titolo soggiorno', unilav.dipendente.numeroSoggiorno)}
        {detail('Questura', unilav.dipendente.questura)}
        {detail('Sede di lavoro', operation.sedeLavoro)}
        {detail('CCNL', operation.ccnl)}
        {detail('Livello', operation.livelloInquadramento)}
        {detail('Tipo orario', operation.tipoOrario)}
        {detail('Ore settimanali', operation.oreSettimanaliMedie)}
        {detail('Ente previdenziale', operation.entePrevidenziale)}
        {detail('PAT INAIL', operation.patInail)}
        {detail('Retribuzione indicata', operation.retribuzioneUnilav)}
        {detail('Motivo cessazione', operation.motivoCessazione)}
        {detail('Codice trasformazione', operation.codiceTrasformazione)}
        {detail('Data e ora invio', `${dateIt(unilav.dataInvio)} ${unilav.oraInvio || ''}`)}
        {detail('Tipo comunicazione', unilav.tipoComunicazione)}
        {detail('Socio lavoratore', unilav.socioLavoratore)}
        {detail('Lavoratore in mobilità', unilav.lavoratoreMobilita)}
        {detail('Assunzione per forza maggiore', unilav.assunzioneForzaMaggiore)}
      </div>
    </details>
    {unilav.tipo === 'assunzione' && <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-5">
      <h3 className="text-lg font-bold">Contratto di assunzione</h3>
      <p className="mt-2 text-sm text-slate-300">Prepara la lettera con i dati dell’UNILAV e della scheda, completa quelli mancanti e stampala con timbro e firma aziendali.</p>
      <button type="button" onClick={() => setShowContract(true)}
        className="mt-4 rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500">Prepara il contratto</button>
    </div>}
    {unilav.tipo === 'trasformazione' && <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-5">
      <h3 className="text-lg font-bold">Lettera di trasformazione</h3>
      <p className="mt-2 text-sm text-slate-300">Controlla e completa i dati della lettera, poi stampala con il logo e il timbro aziendali.</p>
      <button type="button" disabled={!(confirmedEmployee || selected)} onClick={() => setShowTransformationLetter(true)}
        className="mt-4 rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50">Prepara la lettera di trasformazione</button>
    </div>}
    {unilav.tipo === 'proroga' && <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-5">
      <h3 className="text-lg font-bold">Lettera di proroga</h3>
      <p className="mt-2 text-sm text-slate-300">Controlla la scadenza letta dall’UNILAV, completa i dati mancanti e stampa la lettera con il logo e il timbro aziendali.</p>
      <button type="button" disabled={!selected} onClick={() => setShowExtensionLetter(true)}
        className="mt-4 rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50">Prepara la lettera di proroga</button>
    </div>}
    {error && <p role="alert" className="rounded-lg bg-red-950 p-4 text-red-200">{error}</p>}
    {!saved && <button type="button" disabled={!canConfirm} onClick={confirm}
      className="rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
      {busy ? 'Salvataggio...' : mode === 'nuovo' ? 'Conferma e crea la scheda' : 'Conferma modifiche e salva UNILAV'}
    </button>}
  </div>;
});

export default UnilavReview;
