import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquareText, Pencil, Trash2 } from 'lucide-react';

const columns = [
  ['Dipendente', '16%'],
  ['Ore\nlavorate', '5%'],
  ['Ferie /\npermessi /\nmalattia', '9%'],
  ['Netto da\nelaborato', '11%'],
  ['Note', '28%'],
  ['Netto\nbusta', '10%'],
  ['CC', '8%'],
  ['Azioni', '13%']
];

const haNotaConsulente = row => Boolean(row.notaConsulente?.trim());

function DettagliPagamento({ row }) {
  const [espanso, setEspanso] = useState(false);
  const [puoEspandere, setPuoEspandere] = useState(false);
  const contenutoRef = useRef(null);
  const note = [row.notaFissa, row.notaMensile, row.noteMaggiorazioni, row.noteDetrazioni, row.noteGenerali].join('\u0000');

  useLayoutEffect(() => {
    const contenuto = contenutoRef.current;
    if (!contenuto) return;
    const misura = () => setPuoEspandere(contenuto.scrollHeight > 96);
    misura();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(misura);
    observer.observe(contenuto);
    return () => observer.disconnect();
  }, [note]);

  return <div className="space-y-1 text-left text-[16px] leading-snug">
    <div className={`min-w-0 whitespace-pre-wrap break-words ${espanso ? '' : 'max-h-24 overflow-hidden'}`}>
      <div ref={contenutoRef}>
        {row.notaFissa && <p>Nota fissa: {row.notaFissa}</p>}
        {row.notaMensile && <p>Nota del mese: {row.notaMensile}</p>}
        {row.noteMaggiorazioni && <p>Maggiorazione: {row.noteMaggiorazioni}</p>}
        {row.noteDetrazioni && <p>Detrazione: {row.noteDetrazioni}</p>}
        {row.noteGenerali && <p>Note: {row.noteGenerali}</p>}
      </div>
    </div>
    {puoEspandere && <button type="button" onClick={() => setEspanso(value => !value)} aria-expanded={espanso} aria-label={`${espanso ? 'Riduci' : 'Espandi'} le note di ${row.cognomeNome}`} className="flex items-center gap-1 rounded bg-white/80 px-2 py-1 text-xs font-bold text-slate-800 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700">
      {espanso ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}{espanso ? 'Riduci' : 'Espandi'}
    </button>}
  </div>;
}

export default function TabellaPagamenti({ righe, vuoto, euro, onNotaConsulente, onEliminaBusta, onModificaCc, busy }) {
  const righeOrdinate = [
    ...righe.filter(row => !row.inProva && !haNotaConsulente(row)),
    ...righe.filter(row => !row.inProva && haNotaConsulente(row)),
    ...righe.filter(row => row.inProva)
  ];
  return <section className="pt-16">
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
      <table className="w-full min-w-[1280px] table-fixed border-collapse text-center text-[13px] text-slate-800">
        <colgroup>{columns.map(([label, width]) => <col key={label} style={{ width }} />)}</colgroup>
        <thead className="bg-slate-100 text-slate-900"><tr>
          {columns.map(([label]) => <th key={label} scope="col" className="whitespace-pre-line border-b border-r border-slate-300 px-2 py-3 align-middle font-semibold uppercase last:border-r-0">{label}</th>)}
        </tr></thead>
        <tbody className="text-[13px] leading-snug">
          {!righe.length && <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-600">{vuoto}</td></tr>}
          {righeOrdinate.map((row, index) => {
            const hasDetails = Boolean(row.notaFissa || row.notaMensile || row.noteMaggiorazioni || row.noteDetrazioni || row.noteGenerali);
            const cell = 'border-r border-r-slate-200 border-b-2 border-b-slate-400 px-2 py-2 align-middle last:border-r-0';
            const numberCell = `${cell} whitespace-nowrap text-[16px]`;
            const rowColor = index % 2 ? 'bg-sky-200' : 'bg-white';
            const paroleNome = String(row.cognomeNome || '').trim().split(/\s+/);
            const netto = Number(row.stipendioNetto) || 0;
            const oreAssenze = [
              ['Ferie', /ferie/i],
              ['Permessi', /permess/i],
              ['Malattia', /malatt/i]
            ].map(([label, pattern]) => ({
              label,
              ore: Object.entries(row.dettaglioFPM || {}).reduce((totale, [causale, ore]) => totale + (pattern.test(causale) ? Number(ore) || 0 : 0), 0)
            })).filter(({ ore }) => ore > 0);
            return <tr key={row.idDipendente} className={`${rowColor} h-24`}>
                <td className={`${cell} break-words ${haNotaConsulente(row) ? 'bg-emerald-100' : ''}`}>
                  <div className="max-h-24 overflow-y-auto font-semibold text-slate-900"><span className="text-[17px]">{paroleNome.slice(0, 3).join(' ')}</span>{paroleNome.length > 3 && <> <span>{paroleNome.slice(3).join(' ')}</span></>}</div>
                </td>
                <td className={numberCell}>{Number(row.oreLavorate || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })}</td>
                <td className={`${cell} text-[14px]`}>
                  {oreAssenze.length ? <div className="inline-grid grid-cols-[max-content_max-content] gap-x-2 gap-y-1 text-left">
                    {oreAssenze.map(({ label, ore }) => <Fragment key={label}>
                      <span>{label}</span><span className="whitespace-nowrap font-semibold">{ore.toLocaleString('it-IT', { maximumFractionDigits: 2 })} h</span>
                    </Fragment>)}
                  </div> : <span className="text-slate-500">—</span>}
                </td>
                <td className={`${numberCell} font-semibold`}>{euro(netto)}</td>
                <td className={`${cell} px-3 text-left`}>{hasDetails ? <DettagliPagamento row={row} /> : <span className="text-slate-500">—</span>}</td>
                <td className={`${numberCell} font-semibold`}>{row.inProva ? <span className="whitespace-normal text-xs text-slate-500">Non prevista</span> : row.nettoBusta == null ? <span className="whitespace-normal text-xs text-slate-500">Busta non caricata</span> : euro(row.nettoBusta)}</td>
                <td className={cell}><button type="button" onClick={() => onModificaCc(row)} aria-label={`Modifica CC di ${row.cognomeNome}`} className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-slate-900 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700"><span>{row.cc == null ? '—' : euro(row.cc)}</span><Pencil className="h-3.5 w-3.5 shrink-0 text-indigo-700" aria-hidden="true" /></button></td>
                <td className={cell}>
                  <div className="flex flex-col items-center justify-center gap-2">
                    {row.inProva ? <span className="inline-flex min-h-14 w-full items-center justify-center rounded-lg bg-cyan-100 px-3 py-3 text-center text-sm font-semibold text-cyan-900">Dipendente in prova</span> :
                      <button type="button" onClick={() => onNotaConsulente(row)} className={`inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 font-semibold text-slate-800 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700 ${row.allegatoBustaPaga ? 'px-2 py-2 text-xs' : 'min-h-14 w-full px-3 py-3 text-base leading-tight'}`}>
                        <MessageSquareText className={`${row.allegatoBustaPaga ? 'h-4 w-4' : 'h-5 w-5'} shrink-0`} aria-hidden="true" />{haNotaConsulente(row) ? 'Modifica note consulente' : 'Note per consulente'}
                      </button>}
                    {!row.inProva && row.nettoBusta != null && <button type="button" disabled={busy} onClick={() => onEliminaBusta(row)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"><Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />Elimina busta paga</button>}
                  </div>
                </td>
              </tr>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}
