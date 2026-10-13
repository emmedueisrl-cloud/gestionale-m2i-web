import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const endpoint = (path) => `${import.meta.env.VITE_API_URL || ''}/api/fatturazione-anagrafiche/${path}`;
async function request(path, body) {
  const res = await fetch(endpoint(path), body ? { method: 'POST', body } : undefined);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Operazione non riuscita.');
  return data;
}

function FieldList({ fields, scope, accepted, setAccepted, hasConflicts = false }) {
  return <div className="space-y-2">
    {fields.filter(f => f.stato !== 'uguale').map(f => {
      const checked = (accepted[scope] || []).includes(f.field);
      return <div key={f.field} className={`rounded-lg border p-3 text-sm ${f.stato === 'diverso' ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-700 bg-slate-900/40'}`}>
        <div className="font-semibold text-slate-100">{f.label}</div>
        <div className="mt-1 text-slate-300">Gestionale: {f.attuale || '—'} · XML: <strong>{f.xml}</strong></div>
        {f.stato === 'diverso' ? <label className="mt-2 flex items-center gap-2 text-amber-200">
          <input type="checkbox" checked={checked} onChange={e => setAccepted(prev => ({ ...prev, [scope]: e.target.checked ? [...(prev[scope] || []), f.field] : (prev[scope] || []).filter(x => x !== f.field) }))} />
          Usa il valore XML per questo campo
        </label> : <span className="mt-1 block text-emerald-300">Campo vuoto: sarà compilato</span>}
      </div>;
    })}
    {!fields.some(f => f.stato !== 'uguale') && <p className="text-sm text-emerald-300">{hasConflicts ? 'Gli altri campi coincidono.' : 'Nessuna differenza.'}</p>}
  </div>;
}

export default function CaricamentoDati() {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mappings, setMappings] = useState({});
  const [accepted, setAccepted] = useState({});
  const [resolutions, setResolutions] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [filter, setFilter] = useState('tutti');

  const refresh = async () => setStatus(await request('stato'));
  useEffect(() => { refresh().catch(err => setError(err.message)); }, []);

  function formData(extra = {}) {
    const body = new FormData();
    files.forEach(file => body.append('files', file));
    for (const [key, value] of Object.entries(extra)) body.append(key, JSON.stringify(value));
    return body;
  }

  async function runPreview(nextMappings = mappings) {
    if (!files.length) { setError('Seleziona almeno un file XML o ZIP.'); return; }
    setBusy(true); setError(''); setResult(null);
    try {
      const data = await request('anteprima', formData({ mappings: nextMappings }));
      setPreview(data);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function selectClientCard(key, clientId) {
    const next = { ...mappings, [key]: clientId };
    setMappings(next);
    setResolutions(prev => ({ ...prev, [key]: {} }));
    await runPreview(next);
  }

  function selectXmlValue(customerKey, field, choice) {
    setResolutions(prev => ({ ...prev, [customerKey]: { ...(prev[customerKey] || {}), [field]: choice } }));
  }

  async function importData() {
    if (!preview) return;
    setBusy(true); setError('');
    try {
      const data = await request('importa', formData({ options: { mappings, accepted, resolutions } }));
      setResult(data);
      setAccepted({});
      if (data.unresolved.length) setPreview(await request('anteprima', formData({ mappings })));
      else { setPreview(null); setFiles([]); setMappings({}); setResolutions({}); }
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const clients = status?.clients || [];
  const ready = clients.filter(c => !c.issues.length);
  const missing = clients.filter(c => c.issues.length);
  const shown = filter === 'pronti' ? ready : filter === 'incompleti' ? missing : clients;

  return <div className="space-y-8 text-slate-100">
    <div>
      <h2 className="text-2xl font-bold">Caricamento dati fatturazione</h2>
      <p className="mt-2 text-sm text-slate-400">Carica gli XML del mese scorso, singolarmente o in uno ZIP, per ricavare i dati fiscali di M2I e dei clienti. Qui vengono aggiornate solo le anagrafiche: il caricamento delle fatture resta nelle sezioni dedicate.</p>
    </div>

    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 space-y-4">
      <h3 className="font-semibold">1. Seleziona i file</h3>
      <input className="block w-full text-sm" type="file" multiple accept=".xml,.zip" onChange={e => { setFiles([...e.target.files]); setPreview(null); setMappings({}); setAccepted({}); setResolutions({}); setResult(null); }} />
      {files.length > 0 && <p className="text-sm text-slate-300">{files.length} file selezionati</p>}
      <button type="button" disabled={busy || !files.length} onClick={() => runPreview()} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-50">Analizza XML</button>
      {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-red-200">{error}</p>}
      {result && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
        Salvati {result.companyFields} campi M2I e {result.fieldsUpdated} campi di {result.clientsUpdated} clienti.
        {!!result.unresolved.length && <p className="mt-1">Da verificare: {result.unresolved.map(x => `${x.name} (${x.reason})`).join('; ')}.</p>}
      </div>}
    </section>

    {preview && <section className="space-y-5">
      <h3 className="text-lg font-semibold">2. Verifica i dati estratti · {preview.count} documenti esaminati</h3>
      <div className="rounded-xl border border-slate-700 p-4 space-y-3">
        <h4 className="font-semibold">Dati M2I <Link className="ml-2 text-sm text-indigo-300 underline" to="/admin/azienda">Apri scheda</Link></h4>
        {preview.issuer.identityMismatch && <p className="rounded bg-red-500/15 p-2 text-red-200">Partita IVA emittente diversa da M2I. L'importazione è bloccata.</p>}
        {preview.issuer.internal.map(x => <p className="text-amber-200" key={x.field}>{x.label}: valori discordanti nei file ({x.values.join(' / ')})</p>)}
        <FieldList fields={preview.issuer.fields} scope="issuer" accepted={accepted} setAccepted={setAccepted} hasConflicts={!!preview.issuer.internal.length} />
      </div>
      {preview.customers.map(c => <div key={c.key} className="rounded-xl border border-slate-700 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">Dati cliente: {c.name}</h4>
          {c.clientId && <Link className="text-sm text-indigo-300 underline" to={`/admin/clienti/modifica?id=${encodeURIComponent(c.clientId)}`}>Apri scheda</Link>}
        </div>
        <p className="text-xs text-slate-400">{c.files.join(', ')}</p>
        {c.clientId ? <p className="text-sm text-emerald-300">Scheda cliente da aggiornare: {c.clientName} ({c.clientId})</p> : <p className="text-sm text-amber-200">Nessuna scheda cliente individuata automaticamente. Scegli la scheda in cui salvare i dati oppure <Link className="underline" to="/admin/clienti/nuovo">crea un nuovo cliente</Link>.</p>}
        <label className="block text-sm text-slate-300" htmlFor={`client-card-${c.key}`}>Scheda cliente in cui salvare i dati estratti</label>
        <select id={`client-card-${c.key}`} className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm" value={mappings[c.key] || c.clientId || ''} onChange={e => selectClientCard(c.key, e.target.value)}>
          <option value="">{c.clientId ? 'Usa la scheda individuata automaticamente' : 'Seleziona una scheda cliente'}</option>
          {(c.match.candidates || []).map(x => <option key={x.id} value={x.id}>{x.name} ({x.id})</option>)}
          {clients.filter(x => !(c.match.candidates || []).some(y => y.id === x.id)).map(x => <option key={x.id} value={x.id}>{x.name} ({x.id})</option>)}
        </select>
        {c.internal.map(x => <div className="space-y-2 rounded bg-amber-500/10 p-3 text-sm text-amber-200" key={x.field}>
          <p><strong>{x.label}:</strong> negli XML dello stesso cliente compaiono valori diversi: {x.values.map(value => `“${value}”`).join(' oppure ')}.</p>
          {['partita_iva', 'codice_fiscale'].includes(x.field)
            ? <p>Gli identificativi fiscali discordanti richiedono una verifica prima di aggiornare questa scheda.</p>
            : c.clientId && <label className="block text-slate-100">Quale valore conservare nella scheda cliente?
              <select className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm" value={resolutions[c.key]?.[x.field] || (x.field === 'ragione_sociale' && x.current ? 'keep' : '')} onChange={e => selectXmlValue(c.key, x.field, e.target.value)}>
                <option value="">Seleziona un valore</option>
                {x.current && <option value="keep">Mantieni il valore del gestionale: {x.current}</option>}
                {x.values.map((value, index) => <option key={index} value={`xml:${index}`}>Usa il valore XML: {value}</option>)}
              </select>
              {x.field === 'ragione_sociale' && x.current && <span className="mt-1 block text-xs text-emerald-300">Per impostazione predefinita viene mantenuto il nome già salvato.</span>}
            </label>}
        </div>)}
        {c.clientId && <FieldList fields={c.fields} scope={c.key} accepted={accepted} setAccepted={setAccepted} hasConflicts={!!c.internal.length} />}
      </div>)}
      <button type="button" disabled={busy || preview.issuer.identityMismatch} onClick={importData} className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold disabled:opacity-50">Salva i dati proposti</button>
      <p className="text-xs text-slate-400">I campi vuoti vengono compilati; i valori diversi cambiano solo se spunti “Usa il valore XML”. I dati dei clienti senza una scheda individuata restano da verificare. Nessuna fattura viene registrata in questa pagina.</p>
    </section>}

    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Stato clienti per la fatturazione</h3>
        <p className="text-sm text-slate-400">Pronti: {ready.length} · Da completare: {missing.length}</p>
        {!!status?.issuerIssues.length && <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">M2I da completare: {status.issuerIssues.join(', ')}. <Link to="/admin/azienda" className="underline">Apri scheda M2I</Link></p>}
      </div>
      <div className="flex gap-2">
        {[['tutti', 'Tutti'], ['pronti', 'Pronti'], ['incompleti', 'Da completare']].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-sm ${filter === value ? 'bg-indigo-600' : 'bg-slate-800'}`}>{label}</button>)}
      </div>
      <div className="max-h-[500px] space-y-2 overflow-y-auto">
        {shown.map(c => <div key={c.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm">
          <div><strong>{c.name}</strong> <span className="text-slate-400">({c.id})</span><p className={c.issues.length ? 'text-amber-200' : 'text-emerald-300'}>{c.issues.length ? `Mancano: ${c.issues.join(', ')}` : 'Dati essenziali presenti'}</p></div>
          <Link className="text-indigo-300 underline" to={`/admin/clienti/modifica?id=${encodeURIComponent(c.id)}`}>Apri scheda</Link>
        </div>)}
      </div>
    </section>
  </div>;
}
