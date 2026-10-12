import { useCallback, useEffect, useMemo, useState } from 'react';
import { recuperaTuttiIClienti } from '../../api/clienti';
import { workflowRequest } from '../../api/workflowElaborati';
import { mesePredefinitoElaborati } from '../../utils/mesePredefinitoElaborati';

const euro = value => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const today = () => new Date().toLocaleDateString('sv-SE');
const months = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
const defaultInvoiceDescription = (category, month, year) => `${category.toUpperCase()} ${months[Number(month) - 1]} ${year}`;
const empty = (mese, anno) => ({ clienteId: '', mese, anno,
  dataServizio: today().startsWith(`${anno}-${String(mese).padStart(2, '0')}`)
    ? today() : `${anno}-${String(mese).padStart(2, '0')}-01`,
  nome: 'Sgrosso', categoria: 'Sgrosso', descrizioneFattura: defaultInvoiceDescription('Sgrosso', mese, anno),
  descrizione: '', imponibile: '', destinazione: 'extra', gruppoId: '', lavori: [] });
const newWorker = () => ({ dipendenteId: '', modalita: 'elaborato', compenso: '', giornate: [{ data: today(), ore: '' }] });
const inputClass = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100';
const labelClass = 'block space-y-1 text-sm font-medium text-slate-300';

export default function ServiziExtra() {
  const [periodoIniziale] = useState(mesePredefinitoElaborati);
  const [mese, setMese] = useState(periodoIniziale.mese);
  const [anno, setAnno] = useState(periodoIniziale.anno);
  const [clienti, setClienti] = useState([]);
  const [dipendenti, setDipendenti] = useState([]);
  const [servizi, setServizi] = useState([]);
  const [gruppi, setGruppi] = useState([]);
  const [form, setForm] = useState(() => empty(periodoIniziale.mese, periodoIniziale.anno));
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [extras, groups] = await Promise.all([
      workflowRequest(`servizi-extra/${anno}/${mese}`),
      workflowRequest(`servizi-extra/${anno}/${mese}/gruppi`)
    ]);
    setServizi(extras); setGruppi(groups);
  }, [anno, mese]);

  useEffect(() => {
    Promise.all([recuperaTuttiIClienti(), workflowRequest('servizi-extra-dipendenti')])
      .then(([clients, employees]) => { setClienti(clients || []); setDipendenti(employees || []); })
      .catch(err => setError(err.message));
  }, []);
  useEffect(() => { load().catch(err => setError(err.message)); }, [load]);
  useEffect(() => { if (!editingId) setForm(empty(mese, anno)); }, [mese, anno, editingId]);

  const groupsForClient = useMemo(() => gruppi.filter(group => group.clienteId === form.clienteId && (
    group.id === form.gruppoId || (!group.inviataAt && !group.fatturaRegistrazioneId)
  )), [gruppi, form.clienteId, form.gruppoId]);
  const editingService = servizi.find(item => item.id === editingId);
  const priceLocked = Boolean(editingService?.inviataAt || editingService?.fatturaRegistrazioneId || editingService?.bloccatoAt);
  const billingLockedReason = editingService?.fatturaRegistrazioneId ? 'Fattura registrata: imponibile e raggruppamento non modificabili.'
    : editingService?.inviataAt ? 'Fattura inviata: imponibile e raggruppamento non modificabili.'
      : editingService?.bloccatoAt ? 'Servizio blindato: sblinda la riga nell’elaborato clienti per modificare imponibile o fatturazione.' : '';
  const invoiceDescriptionLocked = Boolean(editingService?.inviataAt || editingService?.fatturaRegistrazioneId);
  const clientName = id => clienti.find(client => client.id === id)?.ragione_sociale || id;
  const employeeName = id => dipendenti.find(employee => employee.id === id)?.nome || id;
  const editWorker = (index, key, value) => setForm(current => ({ ...current, lavori: current.lavori.map((worker, i) => i === index ? { ...worker, [key]: value } : worker) }));
  const editDay = (index, dayIndex, key, value) => setForm(current => ({ ...current, lavori: current.lavori.map((worker, i) => i !== index ? worker : {
    ...worker, giornate: worker.giornate.map((day, d) => d === dayIndex ? { ...day, [key]: value } : day)
  }) }));

  const startEdit = service => {
    const currentGroup = gruppi.find(group => group.id === service.gruppoId);
    setEditingId(service.id);
    setForm({ id: service.id, clienteId: service.clienteId, mese: service.mese, anno: service.anno,
      dataServizio: service.dataServizio, nome: service.nome, categoria: service.categoria,
      descrizioneFattura: service.descrizioneFattura || defaultInvoiceDescription(service.nome || service.categoria, service.mese, service.anno),
      descrizione: service.descrizione, imponibile: String(service.imponibile),
      destinazione: service.gruppoTipo === 'mensile' ? 'mensile' : currentGroup?.servizi?.length > 1 ? 'existing' : 'extra', gruppoId: service.gruppoId,
      lavori: service.lavori.map(worker => ({ ...worker, compenso: worker.compenso == null ? '' : String(worker.compenso) })) });
    setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async event => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const body = { ...form, nome: editingService && form.categoria === editingService.categoria
        ? editingService.nome : form.categoria,
        mese, anno, gruppoId: form.gruppoId || null };
      await workflowRequest(editingId ? `servizi-extra/${editingId}` : 'servizi-extra', {
        method: editingId ? 'PUT' : 'POST', body: JSON.stringify(body)
      });
      await load(); setEditingId(null); setForm(empty(mese, anno)); setMessage('Servizio extra salvato.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return <main className="mx-auto max-w-7xl space-y-6 p-5 text-slate-100">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Servizi extra</h1><p className="mt-1 text-slate-400">Registra il servizio, scegli come fatturarlo e indica gli eventuali dipendenti.</p></div>
      <div className="flex gap-2"><label className={labelClass}>Mese<select className={`${inputClass} min-w-36`} value={mese} onChange={e => { setEditingId(null); setMese(Number(e.target.value)); }}>{months.map((name, index) => <option key={name} value={index + 1}>{name[0] + name.slice(1).toLowerCase()}</option>)}</select></label><label className={labelClass}>Anno<input className={inputClass} type="number" min="2000" max="2100" value={anno} onChange={e => { setEditingId(null); setAnno(Number(e.target.value)); }} /></label></div>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-500 bg-red-950 p-3 text-red-100">{error}</div>}
    {message && <div role="status" className="rounded-lg border border-emerald-500 bg-emerald-950 p-3 text-emerald-100">{message}</div>}
    <form onSubmit={save} className="space-y-5 rounded-xl border border-slate-700 bg-slate-900 p-5">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{editingId ? 'Modifica servizio' : 'Nuovo servizio extra'}</h2>{editingId && <button type="button" className="text-indigo-300 underline" onClick={() => { setEditingId(null); setForm(empty(mese, anno)); }}>Annulla modifica</button>}</div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className={labelClass}>Cliente<select required disabled={Boolean(editingId)} className={inputClass} value={form.clienteId} onChange={e => setForm(v => ({ ...v, clienteId: e.target.value, gruppoId: '' }))}><option value="">Seleziona cliente</option>{clienti.map(client => <option key={client.id} value={client.id}>{client.ragione_sociale}</option>)}</select></label>
        <label className={labelClass}>Data del servizio<input required className={inputClass} type="date" min={`${anno}-${String(mese).padStart(2, '0')}-01`} max={`${anno}-${String(mese).padStart(2, '0')}-31`} value={form.dataServizio} onChange={e => setForm(v => ({ ...v, dataServizio: e.target.value }))} /></label>
        <label className={labelClass}>Categoria<select className={inputClass} value={form.categoria} onChange={e => setForm(v => ({ ...v, categoria: e.target.value,
          descrizioneFattura: v.descrizioneFattura === defaultInvoiceDescription(v.categoria, mese, anno)
            ? defaultInvoiceDescription(e.target.value, mese, anno) : v.descrizioneFattura }))}>{['Sgrosso', 'Giardinaggio', 'Disinfestazione', 'Sanificazione', 'Altro'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className={labelClass}>Descrizione fattura<input required maxLength="500" disabled={invoiceDescriptionLocked} className={inputClass} value={form.descrizioneFattura || ''} onChange={e => setForm(v => ({ ...v, descrizioneFattura: e.target.value }))} placeholder="Es. SGROSSO OTTOBRE 2026" /></label>
        <label className={labelClass}>Imponibile per il cliente (€)<input required disabled={priceLocked} className={inputClass} inputMode="decimal" value={form.imponibile} onChange={e => setForm(v => ({ ...v, imponibile: e.target.value }))} placeholder="0,00" /></label>
        <label className={labelClass}>Fatturazione<select disabled={priceLocked} className={inputClass} value={form.destinazione} onChange={e => setForm(v => ({ ...v, destinazione: e.target.value, gruppoId: '' }))}><option value="extra">Fattura extra singola</option><option value="mensile">Unisci al mensile</option><option value="existing">Unisci ad altri extra</option></select></label>
      </div>
      {billingLockedReason && <p className="text-sm text-amber-300">{billingLockedReason}</p>}
      {form.destinazione === 'existing' && <label className={labelClass}>Gruppo fattura esistente<select required disabled={priceLocked} className={inputClass} value={form.gruppoId} onChange={e => setForm(v => ({ ...v, gruppoId: e.target.value }))}><option value="">Seleziona gruppo</option>{groupsForClient.filter(group => group.tipo === 'extra').map(group => <option key={group.id} value={group.id}>{group.nome} · {euro(group.imponibileExtra)}</option>)}</select></label>}
      <label className={labelClass}>Note sul servizio (facoltative)<textarea className={inputClass} rows="2" maxLength="3000" value={form.descrizione} onChange={e => setForm(v => ({ ...v, descrizione: e.target.value }))} /></label>
      <section className="space-y-3 rounded-lg border border-slate-700 p-4">
        <div className="flex justify-between gap-3"><div><h3 className="font-semibold">Dipendenti coinvolti</h3><p className="text-sm text-slate-400">Facoltativi. Per ogni dipendente completa giorni, ore e modalità.</p></div><button type="button" className="rounded bg-indigo-700 px-3 py-2 text-sm" onClick={() => setForm(v => ({ ...v, lavori: [...v.lavori, { ...newWorker(), giornate: [{ data: v.dataServizio, ore: '' }] }] }))}>Aggiungi dipendente</button></div>
        {form.lavori.map((worker, index) => {
          const employee = dipendenti.find(item => item.id === worker.dipendenteId);
          const needsAmount = worker.modalita === 'solo_nota' || employee?.tipoPaga?.toLowerCase() === 'mensile';
          return <div key={index} className="space-y-3 rounded-lg bg-slate-800/70 p-3">
            <div className="grid gap-3 md:grid-cols-3"><label className={labelClass}>Dipendente<select required className={inputClass} value={worker.dipendenteId} onChange={e => editWorker(index, 'dipendenteId', e.target.value)}><option value="">Seleziona</option>{dipendenti.map(item => <option key={item.id} value={item.id}>{item.nome} · {item.tipoPaga}</option>)}</select></label>
              <label className={labelClass}>Come lo tratto?<select className={inputClass} value={worker.modalita} onChange={e => editWorker(index, 'modalita', e.target.value)}><option value="elaborato">Aggiungo ore e compenso all’elaborato</option><option value="solo_nota">Creo solo la nota</option></select></label>
              {needsAmount && <label className={labelClass}>Compenso individuale (€)<input required className={inputClass} inputMode="decimal" value={worker.compenso} onChange={e => editWorker(index, 'compenso', e.target.value)} /></label>}</div>
            {worker.giornate.map((day, dayIndex) => <div key={dayIndex} className="flex flex-wrap items-end gap-2"><label className={labelClass}>Giorno<input required className={inputClass} type="date" value={day.data} onChange={e => editDay(index, dayIndex, 'data', e.target.value)} /></label><label className={labelClass}>Ore<input required className={inputClass} inputMode="decimal" value={day.ore} onChange={e => editDay(index, dayIndex, 'ore', e.target.value)} /></label><button type="button" className="rounded border border-slate-600 px-3 py-2" onClick={() => editWorker(index, 'giornate', worker.giornate.filter((_, d) => d !== dayIndex))}>Rimuovi giorno</button></div>)}
            <div className="flex gap-2"><button type="button" className="text-sm text-indigo-300 underline" onClick={() => editWorker(index, 'giornate', [...worker.giornate, { data: form.dataServizio, ore: '' }])}>Aggiungi giorno</button><button type="button" className="text-sm text-red-300 underline" onClick={() => setForm(v => ({ ...v, lavori: v.lavori.filter((_, i) => i !== index) }))}>Rimuovi dipendente</button></div>
          </div>;
        })}
      </section>
      <button disabled={busy} type="submit" className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold disabled:opacity-50">{busy ? 'Salvataggio...' : editingId ? 'Salva modifiche' : 'Crea servizio extra'}</button>
    </form>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Servizi del mese ({servizi.length})</h2>
      {!servizi.length && <p className="rounded-lg border border-slate-700 p-4 text-slate-400">Nessun servizio extra in questo mese.</p>}
      {servizi.map(service => <article key={service.id} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{service.categoria} · {clientName(service.clienteId)}</h3>
            <p className="text-sm text-slate-300">Descrizione fattura: {service.descrizioneFattura}</p>
            <p className="text-sm text-slate-400">{service.dataServizio} · imponibile {euro(service.imponibile)}</p>
            <p className="mt-1 text-sm">{service.lavori.length ? service.lavori.map(work => employeeName(work.dipendenteId)).join(', ') : 'Nessun dipendente associato'}</p>
          </div>
          {service.inviataAt || service.fatturaRegistrazioneId
            ? <span className="h-fit rounded border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-sm font-semibold text-sky-300">Fattura {service.inviataAt ? 'inviata' : 'registrata'} · non modificabile</span>
            : service.modificabile && <button type="button" disabled={busy} className="h-fit rounded border border-slate-500 px-3 py-1 text-sm disabled:opacity-50" onClick={() => startEdit(service)}>Modifica</button>}
        </div>
      </article>)}
    </section>
  </main>;
}
