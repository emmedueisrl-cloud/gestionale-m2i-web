import { useEffect, useState } from 'react';
import { FileText, Plus, Trash2, X } from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/preventivi-proforme`;
const empty = { nome: '', titolo_documento: 'PREVENTIVO N° {{numero}}', riga_data: 'Roma, {{data}}', destinatario_label: 'Spett.le', oggetto_label: 'Oggetto:', oggetto: '', servizi_inclusi: '', testo_corpo: '' };
const inputClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-slate-100';

export default function ProformePreventivoModal({ onClose }) {
  const [proforme, setProforme] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(API, { credentials: 'same-origin' })
      .then(async response => { if (!response.ok) throw new Error('Impossibile caricare le proforme.'); return response.json(); })
      .then(items => { setProforme(items); if (items.length) { setSelectedId(items[0].id); setForm(items[0]); } })
      .catch(err => setError(err.message));
  }, []);

  const select = item => { setSelectedId(item.id); setForm(item); setError(''); };
  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(selectedId === null ? API : `${API}/${selectedId}`, {
        method: selectedId === null ? 'POST' : 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Impossibile salvare la proforma.');
      const saved = await response.json();
      setProforme(previous => [...previous.filter(item => item.id !== saved.id), saved].sort((a, b) => a.nome.localeCompare(b.nome, 'it')));
      setSelectedId(saved.id);
      setForm(saved);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (selectedId === null || !window.confirm(`Eliminare la proforma “${form.nome}”? I preventivi già generati resteranno disponibili.`)) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API}/${selectedId}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Impossibile eliminare la proforma.');
      const remaining = proforme.filter(item => item.id !== selectedId);
      setProforme(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setForm(remaining[0] || empty);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="proforme-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4"><h2 id="proforme-title" className="flex items-center gap-2 text-xl font-bold text-white"><FileText size={21} /> Proforme preventivo</h2><button type="button" onClick={onClose} aria-label="Chiudi" className="rounded p-2 text-slate-300 hover:bg-slate-700"><X size={20} /></button></div>
      <div className="grid min-h-0 flex-1 md:grid-cols-[230px_1fr]">
        <div className="space-y-2 border-b border-slate-700 p-4 md:border-b-0 md:border-r"><button type="button" onClick={() => { setSelectedId(null); setForm(empty); setError(''); }} className="flex w-full items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-500"><Plus size={16} /> Nuova proforma</button><div className="max-h-40 space-y-1 overflow-y-auto md:max-h-[65vh]">{proforme.map(item => <button type="button" key={item.id} onClick={() => select(item)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selectedId === item.id ? 'bg-indigo-500/25 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>{item.nome}</button>)}</div></div>
        <form onSubmit={save} className="min-h-0 space-y-4 overflow-y-auto p-5">
          <label className="block text-sm font-semibold text-slate-200">Nome proforma<input required maxLength={120} value={form.nome} onChange={event => setForm({ ...form, nome: event.target.value })} className={inputClass} placeholder="Es. Sgrosso" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-200">Titolo documento<input required maxLength={200} value={form.titolo_documento} onChange={event => setForm({ ...form, titolo_documento: event.target.value })} className={inputClass} /></label>
            <label className="block text-sm font-semibold text-slate-200">Riga data<input required maxLength={200} value={form.riga_data} onChange={event => setForm({ ...form, riga_data: event.target.value })} className={inputClass} /></label>
            <label className="block text-sm font-semibold text-slate-200">Intestazione destinatario<input required maxLength={100} value={form.destinatario_label} onChange={event => setForm({ ...form, destinatario_label: event.target.value })} className={inputClass} /></label>
            <label className="block text-sm font-semibold text-slate-200">Etichetta oggetto<input required maxLength={100} value={form.oggetto_label} onChange={event => setForm({ ...form, oggetto_label: event.target.value })} className={inputClass} /></label>
          </div>
          <label className="block text-sm font-semibold text-slate-200">Oggetto predefinito<input required maxLength={500} value={form.oggetto} onChange={event => setForm({ ...form, oggetto: event.target.value })} className={inputClass} /></label>
          <label className="block text-sm font-semibold text-slate-200">Servizi inclusi predefiniti<textarea required maxLength={5000} rows={3} value={form.servizi_inclusi} onChange={event => setForm({ ...form, servizi_inclusi: event.target.value })} className={inputClass} /></label>
          <label className="block text-sm font-semibold text-slate-200">Testo del preventivo<textarea required maxLength={20000} rows={13} value={form.testo_corpo} onChange={event => setForm({ ...form, testo_corpo: event.target.value })} className={`${inputClass} font-mono text-sm`} /></label>
          <p className="text-xs text-slate-400">Segnaposto disponibili: {'{{cliente}}'}, {'{{indirizzo}}'}, {'{{oggetto}}'}, {'{{servizi}}'}, {'{{tipo_prezzo}}'}, {'{{costo}}'}, {'{{numero}}'}, {'{{data}}'}. I riferimenti societari in basso restano automatici.</p>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2 border-t border-slate-700 pt-4"><div className="flex gap-2">{selectedId !== null && <><button type="button" onClick={() => { setSelectedId(null); setForm({ ...form, nome: `${form.nome} - copia`.slice(0, 120) }); setError(''); }} className="rounded-lg border border-slate-500 px-4 py-2 text-slate-200 hover:bg-slate-700">Duplica</button><button type="button" onClick={remove} disabled={saving} className="flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-red-200 hover:bg-red-500/10 disabled:opacity-50"><Trash2 size={16} /> Elimina</button></>}</div><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{saving ? 'Salvataggio...' : selectedId === null ? 'Crea proforma' : 'Salva modifiche'}</button></div>
        </form>
      </div>
    </div>
  </div>;
}
