import React, { useState, useEffect } from 'react';
import { Plus, FileText, Search, Download, Trash2, CalendarDays, Upload, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import NuovoPreventivoModal from './NuovoPreventivoModal';
import AppuntamentiPreventivi from './AppuntamentiPreventivi';
import ProformePreventivoModal from './ProformePreventivoModal';

const API_URL = (import.meta.env.VITE_API_URL || '') + '/api';

function CaricaPreventivoModal({ onClose, onSuccess }) {
  const [appuntamenti, setAppuntamenti] = useState([]);
  const [numero, setNumero] = useState('');
  const [data, setData] = useState(() => {
    const oggi = new Date();
    return `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`;
  });
  const [nominativo, setNominativo] = useState('');
  const [appuntamentoId, setAppuntamentoId] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/appuntamenti-preventivi`)
      .then(response => response.ok ? response.json() : [])
      .then(setAppuntamenti)
      .catch(() => setAppuntamenti([]));
  }, []);

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (!file || !file.name.toLowerCase().endsWith('.pdf') || file.size > 10 * 1024 * 1024) {
      setError('Seleziona un PDF valido di massimo 10 MB.');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    body.append('numeroPreventivo', numero);
    body.append('dataPreventivo', data);
    body.append('nominativo', nominativo.trim());
    if (appuntamentoId) body.append('appuntamentoId', appuntamentoId);
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/preventivi/upload`, { method: 'POST', body });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Impossibile caricare il preventivo.');
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-slate-100';
  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="carica-preventivo-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-2xl sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 id="carica-preventivo-title" className="text-xl font-bold text-white">Carica preventivo già fatto</h2><button type="button" onClick={onClose} aria-label="Chiudi" className="rounded-lg p-2 text-slate-300 hover:bg-slate-700"><X size={20} /></button></div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-semibold text-slate-200">Numero preventivo (facoltativo)<input value={numero} onChange={event => setNumero(event.target.value)} maxLength={80} className={inputClass} placeholder="Se vuoto, viene assegnato automaticamente" /></label>
        <label className="block text-sm font-semibold text-slate-200">Data preventivo<input type="date" required value={data} onChange={event => setData(event.target.value)} className={inputClass} /></label>
        <label className="block text-sm font-semibold text-slate-200">Collega a un appuntamento (facoltativo)
          <select value={appuntamentoId} onChange={event => {
            const id = event.target.value;
            setAppuntamentoId(id);
            const selected = appuntamenti.find(item => String(item.id) === id);
            if (selected) setNominativo(selected.nominativo);
          }} className={inputClass}>
            <option value="">Nessun appuntamento</option>
            {appuntamenti.map(item => <option key={item.id} value={item.id}>{item.nominativo} · {item.dataOra.slice(0, 10)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-200">Cliente / prospect<input required value={nominativo} onChange={event => setNominativo(event.target.value)} maxLength={200} className={inputClass} /></label>
        <label className="block text-sm font-semibold text-slate-200">Preventivo PDF (massimo 10 MB)<input type="file" required accept="application/pdf,.pdf" onChange={event => setFile(event.target.files?.[0] || null)} className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1 file:text-white`} /></label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className="rounded-lg bg-slate-700 px-4 py-2 text-slate-100 hover:bg-slate-600">Annulla</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{saving ? 'Caricamento...' : 'Salva preventivo'}</button></div>
      </form>
    </div>
  </div>;
}

const Preventivi = () => {
  const [preventivi, setPreventivi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [proformeOpen, setProformeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('sezione') === 'preventivi' ? 'preventivi' : 'appuntamenti';
  const apriSezione = sezione => setSearchParams({ sezione });

  const fetchPreventivi = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/preventivi`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Impossibile caricare i preventivi.');
      const data = await res.json();
      setPreventivi(data);
    } catch (err) {
      console.error('Errore fetch preventivi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'preventivi') fetchPreventivi();
  }, [activeTab]);

  const handleElimina = async (preventivo) => {
    if (!window.confirm(`Eliminare il preventivo ${preventivo.numero_preventivo} di ${preventivo.ragione_sociale_prospect}?`)) return;
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/preventivi/${encodeURIComponent(preventivo.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Impossibile eliminare il preventivo.');
      setPreventivi(current => current.filter(item => item.id !== preventivo.id));
      setMessage('Preventivo eliminato.');
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = preventivi.filter(p => 
    p.ragione_sociale_prospect?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.numero_preventivo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 w-full pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
          <CalendarDays size={28} />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-50 uppercase tracking-tight">Appuntamenti e Preventivi</h1>
      </div>

      <div role="tablist" aria-label="Sezioni appuntamenti e preventivi" className="mb-8 grid gap-4 sm:grid-cols-2">
        <button type="button" role="tab" id="tab-appuntamenti" aria-controls="panel-appuntamenti" aria-selected={activeTab === 'appuntamenti'} onClick={() => apriSezione('appuntamenti')} className={`flex items-center gap-4 rounded-2xl border p-5 text-left transition-colors ${activeTab === 'appuntamenti' ? 'border-indigo-400 bg-indigo-500/20 text-white ring-2 ring-indigo-500/30' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
          <CalendarDays className="h-8 w-8 shrink-0 text-indigo-300" />
          <span><strong className="block text-lg">Appuntamenti</strong><span className="mt-1 block text-sm text-slate-400">Incontri programmati, svolti e annullati</span></span>
        </button>
        <button type="button" role="tab" id="tab-preventivi" aria-controls="panel-preventivi" aria-selected={activeTab === 'preventivi'} onClick={() => apriSezione('preventivi')} className={`flex items-center gap-4 rounded-2xl border p-5 text-left transition-colors ${activeTab === 'preventivi' ? 'border-indigo-400 bg-indigo-500/20 text-white ring-2 ring-indigo-500/30' : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
          <FileText className="h-8 w-8 shrink-0 text-indigo-300" />
          <span><strong className="block text-lg">Preventivi</strong><span className="mt-1 block text-sm text-slate-400">Offerte e documenti</span></span>
        </button>
      </div>

      {activeTab === 'appuntamenti' ? <section id="panel-appuntamenti" role="tabpanel" aria-labelledby="tab-appuntamenti"><AppuntamentiPreventivi /></section> : <section id="panel-preventivi" role="tabpanel" aria-labelledby="tab-preventivi">
      <h2 className="mb-5 text-xl font-bold text-slate-50">Preventivi <span className="text-base font-medium text-slate-400">({filtered.length})</span></h2>
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
      
      <div className="flex flex-col md:flex-row justify-between mb-8 gap-4">
        <div className="flex items-center bg-slate-900/50 p-3 rounded-xl flex-1 border border-slate-700 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input 
            type="text" 
            placeholder="Cerca per numero o nome prospect/cliente..." 
            className="bg-transparent border-none text-slate-200 w-full focus:outline-none placeholder:text-slate-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
        <button type="button" className="flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/15 px-5 py-3 font-bold text-indigo-100 hover:bg-indigo-500/25" onClick={() => setUploadOpen(true)}><Upload size={18} /> Carica preventivo già fatto</button>
        <button type="button" className="flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/15 px-5 py-3 font-bold text-indigo-100 hover:bg-indigo-500/25" onClick={() => setProformeOpen(true)}><FileText size={18} /> Proforme di testo</button>
        <button 
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm shrink-0" 
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={18} />
          Nuovo Preventivo
        </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-700">
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Numero</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Data</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente / Prospect</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Importo</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Appuntamento</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="6" className="text-center p-8 text-slate-400 font-medium">Caricamento in corso...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center p-12 text-slate-500">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium text-lg">Nessun preventivo trovato.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-4">
                      <strong className="text-slate-200">{p.numero_preventivo}</strong>
                    </td>
                    <td className="p-4 text-slate-300 font-medium">{new Date(p.data_preventivo).toLocaleDateString('it-IT')}</td>
                    <td className="p-4">
                      <span className="text-slate-100 font-bold uppercase tracking-wide">{p.ragione_sociale_prospect}</span>
                      {p.cliente_prospect_id && (
                        <span className="inline-block ml-3 px-2 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded text-[10px] font-bold uppercase tracking-widest align-middle">
                          Cliente
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-amber-400">{p.tipo_prezzo === 'Allegato' ? 'Da PDF' : `€ ${Number(p.costo_mensile).toLocaleString('it-IT', {minimumFractionDigits: 2})}`}</span>
                    </td>
                    <td className="p-4">{p.appuntamento_id ? <Link to="/admin/preventivi?sezione=appuntamenti" className="text-sm font-semibold text-indigo-300 hover:text-indigo-200">Appuntamento #{p.appuntamento_id}</Link> : <span className="text-slate-500">—</span>}</td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-end">
                        {p.allegato_preventivo && (
                          <a href={`${import.meta.env.VITE_API_URL || ''}${p.allegato_preventivo}`} download className="p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-lg transition-colors border border-indigo-500/20" title="Scarica PDF" aria-label={`Scarica preventivo ${p.numero_preventivo}`}>
                            <Download size={18} />
                          </a>
                        )}
                        <button type="button" onClick={() => handleElimina(p)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors border border-red-500/20" title="Elimina preventivo" aria-label={`Elimina preventivo ${p.numero_preventivo}`}><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <NuovoPreventivoModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            fetchPreventivi();
          }} 
        />
      )}
      {uploadOpen && <CaricaPreventivoModal onClose={() => setUploadOpen(false)} onSuccess={() => { setUploadOpen(false); setMessage('Preventivo caricato.'); fetchPreventivi(); }} />}
      {proformeOpen && <ProformePreventivoModal onClose={() => setProformeOpen(false)} />}
      </section>}
    </div>
  );
};

export default Preventivi;
