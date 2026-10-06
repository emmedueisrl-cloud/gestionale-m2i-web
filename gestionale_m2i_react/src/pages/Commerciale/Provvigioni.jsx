import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Printer, Search, UserRound } from 'lucide-react';
import { calcolaProvvigioni } from '../../api/commerciale';

const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const euro = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR'
});

export default function Provvigioni() {
  const oggi = new Date();
  const mesePrecedente = oggi.getMonth() === 0 ? 12 : oggi.getMonth();
  const annoPrecedente = oggi.getMonth() === 0 ? oggi.getFullYear() - 1 : oggi.getFullYear();
  const anniDisponibili = Array.from({ length: 8 }, (_, index) => oggi.getFullYear() + 1 - index);

  const [mese, setMese] = useState(mesePrecedente);
  const [anno, setAnno] = useState(annoPrecedente);
  const [operatori, setOperatori] = useState([]);
  const [ricerca, setRicerca] = useState('');
  const [espansi, setEspansi] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [erroreCaricamento, setErroreCaricamento] = useState('');

  useEffect(() => {
    let richiestaAttiva = true;

    async function caricaElaborato() {
      setIsLoading(true);
      setErroreCaricamento('');
      try {
        const risposta = await calcolaProvvigioni(mese, anno);
        if (richiestaAttiva) setOperatori(risposta || []);
      } catch (errore) {
        console.error(errore);
        if (richiestaAttiva) {
          setOperatori([]);
          setErroreCaricamento(errore.message || 'Impossibile caricare le provvigioni.');
        }
      } finally {
        if (richiestaAttiva) setIsLoading(false);
      }
    }

    setEspansi(new Set());
    caricaElaborato();
    return () => { richiestaAttiva = false; };
  }, [mese, anno]);

  const operatoriFiltrati = useMemo(() => {
    const termine = ricerca.trim().toLocaleLowerCase('it-IT');
    if (!termine) return operatori;

    return operatori.filter((operatore) =>
      operatore.operatore.toLocaleLowerCase('it-IT').includes(termine)
      || operatore.clienti.some((cliente) =>
        cliente.ragioneSociale.toLocaleLowerCase('it-IT').includes(termine)
      )
    );
  }, [operatori, ricerca]);

  const totaleMese = operatori.reduce(
    (totale, operatore) => totale + Number(operatore.provvigioneTotale || 0),
    0
  );
  const provvigioniErogate = operatori.reduce(
    (totale, operatore) => totale + operatore.clienti.length,
    0
  );

  const cambiaEspansione = (nomeOperatore) => {
    setEspansi((correnti) => {
      const aggiornati = new Set(correnti);
      if (aggiornati.has(nomeOperatore)) aggiornati.delete(nomeOperatore);
      else aggiornati.add(nomeOperatore);
      return aggiornati;
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap justify-between items-end gap-5 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Provvigioni Operatori</h1>
          <p className="text-slate-600 mt-1">Operatori con clienti che hanno fatturato nel periodo selezionato</p>
        </div>
        <div className="flex items-end gap-3">
          <FiltroSelect etichetta="Mese" valore={mese} onChange={setMese} larghezza="min-w-36">
            {MESI.map((nome, index) => <option key={nome} value={index + 1}>{nome}</option>)}
          </FiltroSelect>
          <FiltroSelect etichetta="Anno" valore={anno} onChange={setAnno} larghezza="w-28">
            {anniDisponibili.map((valore) => <option key={valore} value={valore}>{valore}</option>)}
          </FiltroSelect>
          <a
            href={`${import.meta.env.VITE_API_URL || ''}/api/contabilita/pdf/provvigioni/${anno}/${mese}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-800"
          >
            <Printer className="h-4 w-4" />
            Stampa riepilogo
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-5">
        <Riepilogo etichetta="Totale provvigioni del mese" valore={euro.format(totaleMese)} evidenza />
        <Riepilogo etichetta="Provvigioni erogate nel mese" valore={provvigioniErogate} />
        <Riepilogo etichetta="Operatori nel periodo" valore={operatori.length} />
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center text-indigo-600">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}

        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={ricerca}
              onChange={(event) => setRicerca(event.target.value)}
              placeholder="Cerca operatore o cliente..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="h-full overflow-auto p-4 space-y-3">
          {!isLoading && erroreCaricamento && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              Errore nel caricamento delle provvigioni: {erroreCaricamento}
            </div>
          )}
          {!isLoading && !erroreCaricamento && operatoriFiltrati.length === 0 && (
            <div className="py-16 text-center text-slate-500">
              Nessun operatore con clienti fatturati nel periodo selezionato.
            </div>
          )}

          {operatoriFiltrati.map((operatore) => {
            const aperto = espansi.has(operatore.operatore);
            return (
              <section key={operatore.operatore} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => cambiaEspansione(operatore.operatore)}
                  aria-expanded={aperto}
                  className="w-full overflow-x-auto text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-[720px] grid grid-cols-[minmax(260px,1fr)_210px_210px_36px] items-center gap-5 px-5 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                        <UserRound className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-950 truncate">{operatore.operatore}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {operatore.clienti.length} {operatore.clienti.length === 1 ? 'cliente' : 'clienti'}
                        </div>
                      </div>
                    </div>
                      <Valore etichetta="Fatturato imponibile totale" valore={euro.format(operatore.fatturatoTotale || 0)} />
                    <Valore etichetta="Provvigioni totali" valore={euro.format(operatore.provvigioneTotale || 0)} evidenza />
                    {aperto ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                  </div>
                </button>

                {aperto && (
                  <div className="overflow-x-auto border-t border-slate-200">
                    <div className="min-w-[700px]">
                      <div className="grid grid-cols-[minmax(300px,1fr)_200px_200px] gap-5 bg-slate-100 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                        <span>Cliente</span>
                        <span>Fatturato imponibile cliente</span>
                        <span>Provvigione</span>
                      </div>
                      {operatore.clienti.map((cliente) => (
                        <div key={cliente.cliente_id} className="grid grid-cols-[minmax(300px,1fr)_200px_200px] items-center gap-5 border-t border-slate-200 px-5 py-3.5 text-sm">
                          <span className="font-semibold text-slate-900">{cliente.ragioneSociale}</span>
                          <span className="text-slate-700">{euro.format(cliente.fatturato || 0)}</span>
                          <span className="font-bold text-indigo-700">{euro.format(cliente.provvigione || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FiltroSelect({ etichetta, valore, onChange, larghezza, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-slate-600">
      {etichetta}
      <select
        value={valore}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`${larghezza} rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20`}
      >
        {children}
      </select>
    </label>
  );
}

function Riepilogo({ etichetta, valore, evidenza = false }) {
  return (
    <div className={`px-6 py-4 rounded-xl border shadow-sm inline-flex min-w-60 flex-col ${evidenza ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
      <span className="text-slate-600 font-medium text-xs uppercase tracking-wider mb-1">{etichetta}</span>
      <span className={`font-black text-2xl ${evidenza ? 'text-indigo-700' : 'text-slate-950'}`}>{valore}</span>
    </div>
  );
}

function Valore({ etichetta, valore, evidenza = false }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{etichetta}</div>
      <div className={`mt-1 text-base font-bold ${evidenza ? 'text-indigo-700' : 'text-slate-950'}`}>{valore}</div>
    </div>
  );
}
