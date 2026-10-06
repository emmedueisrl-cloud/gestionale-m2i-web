import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, RefreshCw, Users } from 'lucide-react';

const dateKey = date => date.toISOString().slice(0, 10);
const parseDate = value => new Date(`${value}T12:00:00Z`);
const mondayOf = date => {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return dateKey(day);
};
const shift = (value, days) => {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
};
const format = (value, options) => new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', ...options }).format(parseDate(value));
const safeColor = color => /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#6366f1';

export default function AgendaCaposquadraPubblica() {
  const { token } = useParams();
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [data, setData] = useState({ capisquadra: [], impegni: [] });
  const [person, setPerson] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/public/agenda/${encodeURIComponent(token)}?week=${week}`, {
      signal: controller.signal, cache: 'no-store', referrerPolicy: 'no-referrer'
    }).then(async response => {
      if (!response.ok) throw new Error(response.status === 404 ? 'Il link non è valido o è stato sostituito.' : 'Impossibile caricare gli impegni.');
      return response.json();
    }).then(setData).catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, week, reload]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => shift(week, index)), [week]);
  const names = useMemo(() => new Map(data.capisquadra.map(p => [p.id, p.nome])), [data.capisquadra]);
  const visible = useMemo(() => person === 'all' ? data.impegni : data.impegni.filter(item => item.idCaposquadra === person), [data.impegni, person]);
  const today = dateKey(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 12)));

  return (
    <main className="min-h-screen bg-[#0c1224] text-slate-100 pb-12" style={{ fontFamily: 'Outfit, sans-serif' }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <header className="pt-8 pb-6 sm:pt-12">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300"><CalendarDays size={25} /></span>
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">M2I · Agenda condivisa</p><h1 className="text-2xl font-bold leading-tight">Impegni caposquadra</h1></div>
          </div>
          <p className="mt-4 text-sm text-slate-400">Calendario di tutti i caposquadra · sola visualizzazione</p>
        </header>

        <section className="rounded-2xl border border-slate-700/80 bg-slate-800/70 p-4 shadow-xl shadow-black/10 sm:p-5" aria-label="Selezione settimana">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setWeek(shift(week, -7))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700 hover:bg-slate-600" aria-label="Settimana precedente"><ChevronLeft /></button>
            <div className="text-center"><div className="text-xs uppercase tracking-wider text-slate-400">Settimana</div><div className="font-semibold text-sm sm:text-base">{format(week, { day: 'numeric', month: 'short' })} – {format(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
            <button type="button" onClick={() => setWeek(shift(week, 7))} className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700 hover:bg-slate-600" aria-label="Settimana successiva"><ChevronRight /></button>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setWeek(mondayOf(new Date()))} className="rounded-lg bg-indigo-500/20 px-3 py-2 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/30">Questa settimana</button>
            <button type="button" onClick={() => setReload(value => value + 1)} className="flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-600"><RefreshCw size={15} /> Aggiorna</button>
          </div>
        </section>

        <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-800/50 px-4 py-3">
          <Users size={19} className="shrink-0 text-indigo-300" />
          <label htmlFor="caposquadra-filter" className="sr-only">Filtra caposquadra</label>
          <select id="caposquadra-filter" value={person} onChange={event => setPerson(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none [&>option]:bg-slate-800">
            <option value="all">Tutti i caposquadra</option>
            {data.capisquadra.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <span className="text-xs text-slate-400">{visible.length}</span>
        </div>

        {error ? <div role="alert" className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
        {loading ? <p role="status" className="mt-8 text-center text-slate-400">Caricamento impegni…</p> : !error && (
          <div className="mt-6 space-y-6">
            {days.map(day => {
              const items = visible.filter(item => item.data === day);
              return <section key={day} aria-label={format(day, { weekday: 'long', day: 'numeric', month: 'long' })}>
                <div className="mb-3 flex items-center gap-3">
                  <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${day === today ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-200'}`}><span className="text-[10px] font-bold uppercase">{format(day, { weekday: 'short' })}</span><span className="mt-1 text-lg font-bold">{format(day, { day: 'numeric' })}</span></div>
                  <h2 className="font-semibold capitalize">{format(day, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                  <span className="ml-auto text-xs text-slate-500">{items.length}</span>
                </div>
                {items.length ? <div className="space-y-3 pl-2">
                  {items.map(item => <article key={item.id} className="rounded-xl border border-slate-700 bg-slate-800/80 p-4 shadow-sm" style={{ borderLeft: `4px solid ${safeColor(item.colore)}` }}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-base">{names.get(item.idCaposquadra) || 'Caposquadra'}</strong><span className="flex items-center gap-1.5 rounded-lg bg-slate-900/70 px-2.5 py-1 text-sm font-semibold text-indigo-200"><Clock3 size={14} />{item.oraInizio} – {item.oraFine}</span></div>
                    <div className="mt-3 flex items-start gap-2 text-sm text-slate-200"><MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" /><span className="break-words">{item.cliente}</span></div>
                    {item.note && <p className="mt-2 pl-6 text-sm text-slate-400 break-words">{item.note}</p>}
                  </article>)}
                </div> : <p className="pl-2 text-sm text-slate-500">Nessun impegno</p>}
              </section>;
            })}
          </div>
        )}
      </div>
    </main>
  );
}
