import { useEffect, useState } from 'react';
import { FileText, Mail, Send, X } from 'lucide-react';
import { workflowRequest } from '../../api/workflowElaborati';

const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const apiBase = import.meta.env.VITE_API_URL || '';

export default function PerConsulente({ righe, mese, anno, searchActive = false }) {
  const righeConNota = righe.filter(row => row.notaConsulente?.trim());
  const periodo = `${months[mese - 1]} ${anno}`;
  const pdfUrl = `${apiBase}/api/contabilita/consulente/pdf/${anno}/${mese}`;
  const [email, setEmail] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    workflowRequest('contabilita/consulente/email').then(result => {
      if (active) { setEmail(result.email || ''); setEmailDraft(result.email || ''); }
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  const openCompose = () => {
    setError(''); setMessage('');
    if (!email) { setConfigOpen(true); return; }
    setSubject(`Buste paga - ${periodo}`);
    setBody(`Buongiorno Simone,\n\nin allegato il PDF per le buste paga di ${periodo}.\n\nGrazie e buon lavoro.`);
    setComposeOpen(true);
  };

  const saveEmail = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await workflowRequest('contabilita/consulente/email', { method: 'PUT', body: JSON.stringify({ email: emailDraft }) });
      setEmail(result.email); setEmailDraft(result.email); setConfigOpen(false);
      setMessage('Email del consulente salvata.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const send = async event => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await workflowRequest('contabilita/consulente/invia', {
        method: 'POST', body: JSON.stringify({ mese, anno, destinatario: email, oggetto: subject, corpo: body })
      });
      setComposeOpen(false);
      setMessage(result.message || 'Email inviata al consulente.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return <section aria-label="Per consulente" className="space-y-4">
    <div className="flex flex-wrap items-center justify-end gap-3">
      <button type="button" onClick={openCompose} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800"><Send className="h-4 w-4" />Invia a consulente</button>
      <button type="button" onClick={() => { setError(''); setEmailDraft(email); setConfigOpen(true); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900 hover:bg-slate-100"><Mail className="h-4 w-4" />Email consulente</button>
      {email && <span className="text-sm text-slate-600">{email}</span>}
    </div>
    {message && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-800">{message}</p>}
    {!configOpen && !composeOpen && error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
      <table className="w-full table-fixed border-collapse text-left text-slate-900">
        <colgroup><col className="w-1/4" /><col className="w-3/4" /></colgroup>
        <thead className="bg-slate-100 text-sm uppercase"><tr>
          <th scope="col" className="border-b border-r border-slate-300 px-4 py-3">Dipendente</th>
          <th scope="col" className="border-b border-slate-300 px-4 py-3">Note consulente</th>
        </tr></thead>
        <tbody>
          {righeConNota.length ? righeConNota.map((row, index) => <tr key={row.idDipendente} className={index % 2 ? 'bg-sky-50' : 'bg-white'}>
            <td className="border-b border-r border-slate-200 px-4 py-4 font-semibold">{row.cognomeNome}</td>
            <td className="whitespace-pre-wrap break-words border-b border-slate-200 px-4 py-4">{row.notaConsulente}</td>
          </tr>) : <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-500">{searchActive ? 'Nessun dipendente con note consulente corrisponde alla ricerca.' : 'Nessuna nota per consulente in questo mese.'}</td></tr>}
        </tbody>
      </table>
    </div>
    {configOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={saveEmail} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 text-slate-900 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Email consulente</h2><button type="button" disabled={busy} onClick={() => setConfigOpen(false)} aria-label="Chiudi" className="rounded p-1 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
        <label className="block text-sm font-semibold">Indirizzo email<input type="email" required autoFocus value={emailDraft} onChange={event => setEmailDraft(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-base font-normal" /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setConfigOpen(false)} className="rounded-lg bg-slate-100 px-4 py-2 hover:bg-slate-200">Annulla</button><button type="submit" disabled={busy} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">{busy ? 'Salvataggio...' : 'Salva'}</button></div>
      </form>
    </div>}
    {composeOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={send} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-white p-6 text-slate-900 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Invia a consulente</h2><button type="button" disabled={busy} onClick={() => setComposeOpen(false)} aria-label="Chiudi" className="rounded p-1 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
        <label className="block text-sm font-semibold">Destinatario<input type="email" value={email} readOnly className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-base font-normal" /></label>
        <label className="block text-sm font-semibold">Oggetto<input required value={subject} onChange={event => setSubject(event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-base font-normal" /></label>
        <label className="block text-sm font-semibold">Testo<textarea required rows={7} value={body} onChange={event => setBody(event.target.value)} maxLength={10000} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-base font-normal" /></label>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><FileText className="h-5 w-5 text-indigo-700" /><span className="font-semibold">Per_consulente_{months[mese - 1]}_{anno}.pdf</span><a href={pdfUrl} target="_blank" rel="noreferrer" className="ml-auto text-sm font-semibold text-indigo-700 underline">Apri PDF</a></div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setComposeOpen(false)} className="rounded-lg bg-slate-100 px-4 py-2 hover:bg-slate-200">Annulla</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"><Send className="h-4 w-4" />{busy ? 'Invio in corso...' : 'Invia email'}</button></div>
      </form>
    </div>}
  </section>;
}
