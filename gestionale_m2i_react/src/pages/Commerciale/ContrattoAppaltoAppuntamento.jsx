import { useEffect, useState } from 'react';
import { FileText, Keyboard, Upload, X } from 'lucide-react';
import ContrattoAppaltoForm from '../../components/appalto/ContrattoAppaltoForm';
import { workflowRequest } from '../../api/workflowElaborati';

const campiVisura = [
  ['ragioneSociale', 'Ragione sociale'], ['partitaIva', 'Partita IVA'], ['codiceFiscale', 'Codice fiscale'],
  ['sedeLegale', 'Sede legale completa'], ['indirizzoSede', 'Via e civico'], ['cap', 'CAP'],
  ['citta', 'Comune'], ['provincia', 'Provincia'], ['pec', 'PEC'], ['rappresentante', 'Legale rappresentante'],
  ['numeroRea', 'Numero REA'], ['formaGiuridica', 'Forma giuridica'], ['codiceAteco', 'Codice ATECO'], ['attivita', 'Attività']
];

export default function ContrattoAppaltoAppuntamento({ appuntamento, onClose }) {
  const [fase, setFase] = useState('scelta');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [datiVisura, setDatiVisura] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener('keydown', escape); };
  }, [onClose]);

  const leggiVisura = async () => {
    if (!file || busy) return;
    setBusy(true); setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await workflowRequest('azioni-veloci/visura/anteprima', { method: 'POST', body });
      setPreview(result);
      setDatiVisura({ ...result.dati });
      setFase('verifica');
    } catch (err) { setError(err.message || 'Impossibile leggere la visura.'); }
    finally { setBusy(false); }
  };

  const contrattoVisura = fase === 'contratto'
    ? (datiVisura || { ragioneSociale: appuntamento.nominativo || '' }) : null;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-5" role="presentation">
    <div role="dialog" aria-modal="true" aria-label={`Contratto d’appalto per ${appuntamento.nominativo}`} className="max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-4 text-slate-100 shadow-2xl sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-700 pb-4">
        <div><h2 className="text-xl font-bold">Genera contratto d’appalto</h2><p className="mt-1 text-sm text-slate-300">Appuntamento: <strong>{appuntamento.nominativo}</strong></p></div>
        <button type="button" onClick={onClose} aria-label="Chiudi" className="rounded-lg p-2 hover:bg-slate-700"><X size={20} /></button>
      </div>

      {fase === 'scelta' && <div className="space-y-4">
        <p className="text-sm text-slate-300">Come vuoi compilare i dati del committente?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => { setError(''); setFase('carica'); }} className="rounded-xl border border-indigo-400/50 bg-indigo-500/10 p-5 text-left hover:bg-indigo-500/20"><Upload className="mb-3 text-indigo-300" size={24} /><strong className="block">Allega visura camerale</strong><span className="mt-1 block text-sm text-slate-300">Leggi il PDF, verifica i dati trovati e completa il contratto.</span></button>
          <button type="button" onClick={() => { setError(''); setDatiVisura(null); setFase('contratto'); }} className="rounded-xl border border-slate-600 bg-slate-800 p-5 text-left hover:bg-slate-700"><Keyboard className="mb-3 text-indigo-300" size={24} /><strong className="block">Inserisci i dati manualmente</strong><span className="mt-1 block text-sm text-slate-300">Compila direttamente i campi del contratto.</span></button>
        </div>
      </div>}

      {fase === 'carica' && <div className="max-w-xl space-y-4">
        <label className="block text-sm font-semibold">Visura camerale in PDF
          <input type="file" accept="application/pdf,.pdf" onChange={event => {
            const selected = event.target.files?.[0] || null;
            setError(''); setFile(null);
            if (selected && (!/\.pdf$/i.test(selected.name) || selected.size > 10 * 1024 * 1024)) {
              setError('Seleziona una visura PDF di massimo 10 MB.'); return;
            }
            setFile(selected);
          }} className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-800 p-3 text-slate-100" />
        </label>
        {file && <p className="flex items-center gap-2 text-sm text-slate-300"><FileText size={16} /> {file.name}</p>}
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setFase('scelta')} disabled={busy} className="rounded-lg bg-slate-700 px-4 py-2 font-semibold disabled:opacity-50">Indietro</button><button type="button" onClick={leggiVisura} disabled={!file || busy} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold disabled:opacity-50">{busy ? 'Lettura in corso…' : 'Leggi visura'}</button></div>
      </div>}

      {fase === 'verifica' && <div className="space-y-5">
        <p className="text-sm text-slate-300">{preview?.pagine} {preview?.pagine === 1 ? 'pagina letta' : 'pagine lette'}. {preview?.letturaOcr ? 'La visura è stata letta con OCR: controlla con attenzione tutti i dati.' : 'Controlla e correggi i dati estratti prima di proseguire.'}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{campiVisura.map(([key, label]) => <label key={key} className="block text-sm font-semibold">{label}<input value={datiVisura?.[key] || ''} onChange={event => setDatiVisura(current => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" /></label>)}</div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setFase('carica')} className="rounded-lg bg-slate-700 px-4 py-2 font-semibold">Cambia visura</button><button type="button" onClick={() => setFase('contratto')} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold">Continua al contratto</button></div>
      </div>}

      {fase === 'contratto' && <ContrattoAppaltoForm key={datiVisura ? 'visura' : 'manuale'} visura={contrattoVisura} onClose={() => setFase(datiVisura ? 'verifica' : 'scelta')} backLabel={datiVisura ? 'Torna ai dati della visura' : 'Torna alla scelta'} />}
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-950/50 p-3 text-sm text-red-200">{error}</p>}
    </div>
  </div>;
}
