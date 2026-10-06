import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, RefreshCw, UserCheck, UserX } from 'lucide-react';
import { cessaOperatore, creaOperatore, elencaOperatori, riattivaOperatore } from '../../api/operatori';

const oggi = () => new Date().toISOString().slice(0, 10);

export default function Operatori() {
  const [operatori, setOperatori] = useState([]);
  const [nome, setNome] = useState('');
  const [busy, setBusy] = useState(false);
  const [espansi, setEspansi] = useState(new Set());

  const carica = async () => setOperatori(await elencaOperatori(true) || []);
  useEffect(() => { carica().catch(error => window.alert(error.message)); }, []);

  const esegui = async azione => {
    setBusy(true);
    try { await azione(); await carica(); }
    catch (errore) { window.alert(errore.message); }
    finally { setBusy(false); }
  };

  const aggiungi = event => {
    event.preventDefault();
    if (!nome.trim()) return;
    esegui(async () => { await creaOperatore(nome); setNome(''); });
  };

  const cessa = operatore => {
    const data = window.prompt(`Data di cessazione di ${operatore.nome} (AAAA-MM-GG):`, oggi());
    if (data) esegui(() => cessaOperatore(operatore.id, data));
  };

  const riattiva = operatore => {
    const data = window.prompt(`Data di riattivazione di ${operatore.nome} (AAAA-MM-GG):`, oggi());
    if (data) esegui(() => riattivaOperatore(operatore.id, data));
  };

  const cambiaEspansione = id => setEspansi(correnti => {
    const aggiornati = new Set(correnti);
    if (aggiornati.has(id)) aggiornati.delete(id);
    else aggiornati.add(id);
    return aggiornati;
  });

  return (
    <div className="space-y-6 text-slate-100">
      <div>
        <h2 className="text-2xl font-bold">Operatori</h2>
        <p className="mt-1 text-sm text-slate-400">Gestisci gli operatori disponibili nelle schede cliente e il loro storico di attività.</p>
      </div>

      <form onSubmit={aggiungi} className="flex gap-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
        <input value={nome} onChange={event => setNome(event.target.value)} placeholder="Nome nuovo operatore" className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 outline-none focus:border-indigo-500" />
        <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-500 disabled:opacity-50"><Plus className="h-4 w-4" />Aggiungi</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-700">
        <div className="grid grid-cols-[1fr_150px_190px] bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          <span>Operatore / clienti attivi</span><span>Stato</span><span className="text-right">Azioni</span>
        </div>
        {operatori.map(operatore => {
          const aperto = espansi.has(operatore.id);
          return (
            <div key={operatore.id} className="border-t border-slate-700">
              <div className="grid grid-cols-[1fr_150px_190px] items-center px-4 py-3">
                <button type="button" onClick={() => cambiaEspansione(operatore.id)} className="flex items-center gap-3 text-left">
                  {aperto ? <ChevronDown className="h-4 w-4 text-indigo-400" /> : <ChevronRight className="h-4 w-4 text-indigo-400" />}
                  <span>
                    <span className="block font-semibold">{operatore.nome}</span>
                    <span className="block text-xs text-slate-400">{operatore.clientiAttivi.length} {operatore.clientiAttivi.length === 1 ? 'cliente attivo' : 'clienti attivi'}</span>
                  </span>
                </button>
                <span className={operatore.attivo ? 'text-emerald-400' : 'text-amber-400'}>
                  {operatore.attivo ? 'Attivo' : `Cessato${operatore.data_cessazione ? ` · ${operatore.data_cessazione}` : ''}`}
                </span>
                <div className="text-right">
                  {operatore.attivo ? (
                    <button disabled={busy} onClick={() => cessa(operatore)} className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/10"><UserX className="h-4 w-4" />Cessa</button>
                  ) : (
                    <button disabled={busy} onClick={() => riattiva(operatore)} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10"><RefreshCw className="h-4 w-4" />Riattiva</button>
                  )}
                </div>
              </div>
              {aperto && (
                <div className="border-t border-slate-700/70 bg-slate-950/35 px-12 py-3">
                  {operatore.clientiAttivi.length ? (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {operatore.clientiAttivi.map(cliente => (
                        <li key={cliente.id} className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-200">
                          {cliente.ragioneSociale}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-slate-500">Nessun cliente attivo assegnato.</p>}
                </div>
              )}
            </div>
          );
        })}
        {!operatori.length && <div className="p-8 text-center text-slate-400"><UserCheck className="mx-auto mb-2 h-6 w-6" />Nessun operatore presente.</div>}
      </div>
      <p className="text-xs text-slate-400">Un operatore cessato resta nei riepiloghi dei mesi in cui è stato attivo almeno un giorno.</p>
    </div>
  );
}
