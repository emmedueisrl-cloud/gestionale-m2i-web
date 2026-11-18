import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { workflowRequest } from '../../api/workflowElaborati';
import UnilavReview from '../AzioniVeloci/UnilavReview';

const dateIt = value => value ? new Date(value).toLocaleDateString('it-IT') : '—';

export default function BozzeUnilav({ onClose, onCompleted }) {
  const [drafts, setDrafts] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reviewRef = useRef(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true); setError('');
    try { setDrafts(await workflowRequest('azioni-veloci/unilav/bozze')); }
    catch (err) { setError(err.message || 'Impossibile caricare le bozze.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  const close = useCallback(async () => {
    if (busy) return;
    if (!current) { onClose(); return; }
    setBusy(true); setError('');
    try {
      await reviewRef.current?.saveDraftOnClose();
      setCurrent(null);
      await loadDrafts();
      onCompleted();
    } catch (err) { setError(err.message || 'Impossibile salvare la bozza.'); }
    finally { setBusy(false); }
  }, [busy, current, loadDrafts, onClose, onCompleted]);

  useEffect(() => {
    const onEscape = event => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [close]);

  const open = async id => {
    setBusy(true); setError('');
    try { setCurrent(await workflowRequest(`azioni-veloci/unilav/bozze/${encodeURIComponent(id)}`)); }
    catch (err) { setError(err.message || 'Impossibile aprire la bozza.'); }
    finally { setBusy(false); }
  };

  const remove = async id => {
    if (!window.confirm('Eliminare questa bozza UNILAV?')) return;
    setBusy(true); setError('');
    try { await workflowRequest(`azioni-veloci/unilav/bozze/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadDrafts(); }
    catch (err) { setError(err.message || 'Impossibile eliminare la bozza.'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-2 sm:p-4 lg:p-8" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="bozze-unilav-title" className="flex h-full max-h-[960px] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 text-slate-100 shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-700 px-5 py-4 sm:px-7">
        <div><h2 id="bozze-unilav-title" className="text-2xl font-bold">{current ? 'Riprendi UNILAV in bozza' : 'Bozze UNILAV'}</h2>
          <p className="mt-1 text-sm text-slate-300">{current ? 'Completa i dati e conferma la nuova scheda dipendente.' : 'Assunzioni iniziate e non ancora confermate.'}</p></div>
        <button type="button" disabled={busy} onClick={close} aria-label={current ? 'Torna alle bozze' : 'Chiudi bozze'} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"><X size={24} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-7">
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
        {current ? <UnilavReview key={current.id} ref={reviewRef} file={null} preview={current.preview} initialDraft={current}
          onSaved={() => { setCurrent(null); loadDrafts(); onCompleted(); }} /> : <>
          {loading ? <p>Caricamento bozze...</p> : drafts.length === 0 ?
            <p className="rounded-xl border border-slate-700 bg-slate-800 p-5 text-slate-300">Nessuna bozza UNILAV da completare.</p> :
            <div className="space-y-3">{drafts.map(draft => <div key={draft.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div><p className="font-bold">{draft.cognome} {draft.nome}</p>
                <p className="mt-1 text-sm text-slate-300">CF {draft.codiceFiscale} · Assunzione {dateIt(draft.dataOperazione)} · Aggiornata {dateIt(draft.aggiornataAt)}</p>
                <p className="mt-1 text-xs text-slate-400">{draft.fileName}</p></div>
              <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => open(draft.id)} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">Apri bozza</button>
                <button type="button" disabled={busy} onClick={() => remove(draft.id)} className="rounded-lg border border-slate-600 px-4 py-2 font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50">Elimina</button></div>
            </div>)}</div>}
        </>}
      </div>
    </div>
  </div>;
}
