import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recuperaTuttiIClienti, salvaNuovoCliente, uploadFileCliente } from '../../api/clienti';
import ContrattoAppaltoForm from '../../components/appalto/ContrattoAppaltoForm';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white';
const norm = value => String(value || '').toLocaleUpperCase('it-IT').replace(/[^A-Z0-9]/g, '');
const fields = [
  ['ragioneSociale', 'Ragione sociale'], ['partitaIva', 'Partita IVA'], ['codiceFiscale', 'Codice fiscale'],
  ['sedeLegale', 'Sede legale completa'], ['indirizzoSede', 'Via e civico'], ['cap', 'CAP'],
  ['citta', 'Comune'], ['provincia', 'Provincia'], ['pec', 'PEC'], ['rappresentante', 'Legale rappresentante']
];

export default function VisuraReview({ file, preview }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(preview.dati);
  const [clienti, setClienti] = useState(preview.candidati || []);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(preview.candidati?.[0]?.id || '');
  const [mode, setMode] = useState(preview.candidati?.length ? 'esistente' : 'nuovo');
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState('');
  const [attached, setAttached] = useState(false);
  const [showContract, setShowContract] = useState(false);
  useEffect(() => {
    let active = true;
    recuperaTuttiIClienti().then(rows => { if (active) setClienti(rows || []); })
      .catch(() => { if (active) setError('Impossibile caricare l’elenco clienti.'); });
    return () => { active = false; };
  }, []);
  const candidates = useMemo(() => clienti.filter(row =>
    (values.partitaIva && norm(row.partita_iva) === norm(values.partitaIva)) ||
    (values.codiceFiscale && norm(row.codice_fiscale) === norm(values.codiceFiscale)) ||
    norm(row.ragione_sociale) === norm(values.ragioneSociale)), [clienti, values]);
  const exactTax = candidates.some(row =>
    (values.partitaIva && norm(row.partita_iva) === norm(values.partitaIva)) ||
    (values.codiceFiscale && norm(row.codice_fiscale) === norm(values.codiceFiscale)));
  const filtered = clienti.filter(row => norm(`${row.ragione_sociale} ${row.partita_iva} ${row.codice_fiscale}`).includes(norm(search))).slice(0, 25);
  const selected = clienti.find(row => row.id === selectedId) || preview.candidati?.find(row => row.id === selectedId);
  const fiscalMismatch = selected && ((values.partitaIva && selected.partita_iva && norm(values.partitaIva) !== norm(selected.partita_iva)) ||
    (values.codiceFiscale && selected.codice_fiscale && norm(values.codiceFiscale) !== norm(selected.codice_fiscale)));
  const change = (key, value) => setValues(current => ({ ...current, [key]: value }));
  const save = async () => {
    if (busy || attached) return;
    if (!values.ragioneSociale.trim() || (!values.partitaIva && !values.codiceFiscale)) {
      setError('Completa ragione sociale e Partita IVA o codice fiscale prima di salvare.'); return;
    }
    if (mode === 'esistente' && !selected) { setError('Seleziona il cliente a cui allegare la visura.'); return; }
    if (mode === 'esistente' && fiscalMismatch && !confirmMismatch) { setError('Gli identificativi fiscali sono diversi: conferma manualmente che la visura appartiene a questo cliente.'); return; }
    if (mode === 'nuovo' && exactTax) { setError('Esiste già un cliente con lo stesso identificativo fiscale: allega la visura alla sua scheda.'); return; }
    if (mode === 'nuovo' && candidates.length && !confirmNew) { setError('Verifica i clienti suggeriti e conferma che questa è una nuova anagrafica.'); return; }
    setBusy(true); setError('');
    try {
      let id = savedId;
      if (!id && mode === 'nuovo') {
        id = await salvaNuovoCliente({ isBozza: true, tipoCliente: 'PARTITA_IVA',
          ragioneSociale: values.ragioneSociale.trim(), partitaIva: values.partitaIva.trim(), codiceFiscale: values.codiceFiscale.trim(),
          sedeLegale: values.sedeLegale.trim(), indirizzoSede: values.indirizzoSede.trim(), cap: values.cap.trim(),
          citta: values.citta.trim(), provincia: values.provincia.trim(), pec: values.pec.trim(), titolare: values.rappresentante.trim() });
        setSavedId(id);
      }
      if (!id) id = selected.id;
      await uploadFileCliente(id, file, 'Visura_Camerale', values.ragioneSociale, '');
      setSavedId(id);
      setAttached(true);
    } catch (err) { setError(err.message || 'Salvataggio non riuscito.'); }
    finally { setBusy(false); }
  };
  if (showContract) return <ContrattoAppaltoForm cliente={mode === 'esistente' ? selected : null} clienteId={savedId} visura={values} onClose={() => setShowContract(false)} />;
  return <div className="space-y-5 text-slate-100">
    <section className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-5">
      <h3 className="text-xl font-bold">Visura camerale · {values.ragioneSociale || 'cliente da verificare'}</h3>
      <p className="mt-1 text-sm text-slate-300">{preview.pagine} {preview.pagine === 1 ? 'pagina letta' : 'pagine lette'}. {preview.letturaOcr ? 'Scansione letta con OCR: controlla con attenzione i dati.' : 'Controlla i campi estratti prima di salvare.'}</p>
    </section>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(([key, label]) => <label key={key} className="block text-sm font-semibold">{label}
        <input value={values[key] || ''} onChange={event => change(key, event.target.value)} className={inputClass} /></label>)}
    </div>
    <section className="rounded-xl border border-slate-700 bg-slate-800 p-5">
      <h3 className="font-bold">Corrispondenza anagrafica</h3>
      {candidates.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{candidates.map(row => <button key={row.id} type="button"
        onClick={() => { setMode('esistente'); setSelectedId(row.id); setConfirmMismatch(false); }}
        className={`rounded-lg border p-3 text-left text-sm ${mode === 'esistente' && selectedId === row.id ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-600 bg-slate-900'}`}>
        <strong>{row.ragione_sociale}</strong> · {row.id}<br /><span className="text-slate-300">P. IVA {row.partita_iva || '—'} · CF {row.codice_fiscale || '—'} · {row.attivo || '—'}</span></button>)}</div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode('esistente')} className={`rounded-lg px-4 py-2 font-semibold ${mode === 'esistente' ? 'bg-indigo-600' : 'bg-slate-700'}`}>Cliente già presente</button>
        <button type="button" disabled={exactTax} onClick={() => { setMode('nuovo'); setSelectedId(''); }} className={`rounded-lg px-4 py-2 font-semibold disabled:opacity-40 ${mode === 'nuovo' ? 'bg-indigo-600' : 'bg-slate-700'}`}>Nuova anagrafica</button>
      </div>
      {mode === 'esistente' && <div className="mt-4">
        <label className="block text-sm font-semibold">Cerca un cliente<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, Partita IVA o codice fiscale" className={inputClass} /></label>
        {search && <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">{filtered.map(row => <button key={row.id} type="button"
          onClick={() => { setSelectedId(row.id); setSearch(''); setConfirmMismatch(false); }} className="block w-full rounded-lg bg-slate-900 px-3 py-2 text-left text-sm hover:bg-slate-700">{row.ragione_sociale} · {row.id} · {row.partita_iva || row.codice_fiscale}</button>)}</div>}
        {selected && <p className="mt-3 text-sm text-indigo-200">Allegherò la nuova visura alla scheda <strong>{selected.ragione_sociale}</strong> ({selected.id}). Nessun dato esistente sarà sovrascritto.</p>}
        {fiscalMismatch && <label className="mt-3 flex items-center gap-2 text-sm text-amber-200"><input type="checkbox" checked={confirmMismatch} onChange={event => setConfirmMismatch(event.target.checked)} /> Gli identificativi fiscali sono diversi. Confermo che la visura appartiene al cliente selezionato.</label>}
      </div>}
      {mode === 'nuovo' && <div className="mt-4 text-sm text-slate-300"><p>La scheda verrà creata come bozza, con i dati letti dalla visura. Potrai completarla nell’anagrafica clienti.</p>
        {candidates.length > 0 && <label className="mt-3 flex items-center gap-2 text-amber-200"><input type="checkbox" checked={confirmNew} onChange={event => setConfirmNew(event.target.checked)} /> Confermo che non è uno dei clienti suggeriti.</label>}</div>}
    </section>
    {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
    {!attached ? <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-emerald-600 px-5 py-3 font-bold disabled:opacity-50">{busy ? 'Salvataggio...' : mode === 'nuovo' ? 'Crea scheda e allega visura' : 'Conferma e allega visura'}</button> :
      <div className="rounded-xl border border-emerald-700 bg-emerald-950/50 p-5">
        <p role="status">Visura allegata alla scheda cliente {savedId}.</p>
        <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => setShowContract(true)} className="rounded-lg bg-indigo-600 px-5 py-3 font-bold">Prepara il contratto d’appalto</button>
          <button type="button" onClick={() => navigate(`/admin/clienti/modifica?id=${encodeURIComponent(savedId)}`)} className="rounded-lg bg-slate-700 px-5 py-3 font-bold">Completa anagrafica</button></div>
      </div>}
  </div>;
}
