import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, CircleAlert, CreditCard, FileText } from 'lucide-react';
import { attachmentUrl } from '../../utils/attachmentUrl';

const columns = [
  ['Dipendente', '17%'],
  ['Ore', '7%'],
  ['Paga base', '9%'],
  ['Lavorato', '10%'],
  ['Ferie / permessi / malattia', '10%'],
  ['Maggiorazioni', '9%'],
  ['Detrazioni', '9%'],
  ['Netto da elaborato', '10%'],
  ['Netto busta', '10%'],
  ['Azioni', '9%']
];

function DettagliPagamento({ row }) {
  const [espanso, setEspanso] = useState(false);
  const [puoEspandere, setPuoEspandere] = useState(false);
  const contenutoRef = useRef(null);
  const note = [row.notaFissa, row.notaMensile, row.noteMaggiorazioni, row.noteDetrazioni, row.noteGenerali, row.storicoPreesistente && !row.pagamento ? 'storico' : ''].join('\u0000');

  useLayoutEffect(() => {
    const contenuto = contenutoRef.current;
    if (!contenuto) return;
    const misura = () => setPuoEspandere(contenuto.scrollHeight > 44);
    misura();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(misura);
    observer.observe(contenuto);
    return () => observer.disconnect();
  }, [note]);

  return <div className="grid min-h-11 grid-cols-[35%_minmax(0,1fr)_auto] items-start gap-4 rounded-md bg-white/35 px-3 py-1 text-[16px] leading-snug">
    <div className="max-h-11 overflow-y-auto break-all">IBAN: {row.iban || 'N/D'}</div>
    <div className={`min-w-0 break-words ${espanso ? '' : 'h-11 overflow-hidden'}`}>
      <div ref={contenutoRef}>
        {row.notaFissa && <p>Nota fissa: {row.notaFissa}</p>}
        {row.notaMensile && <p>Nota del mese: {row.notaMensile}</p>}
        {row.noteMaggiorazioni && <p>Maggiorazione: {row.noteMaggiorazioni}</p>}
        {row.noteDetrazioni && <p>Detrazione: {row.noteDetrazioni}</p>}
        {row.noteGenerali && <p>Note: {row.noteGenerali}</p>}
        {row.storicoPreesistente && !row.pagamento && <p className="text-amber-900">Storico: verifica prima di registrare il pagamento.</p>}
      </div>
    </div>
    {puoEspandere && <button type="button" onClick={() => setEspanso(value => !value)} aria-expanded={espanso} aria-label={`${espanso ? 'Riduci' : 'Espandi'} le note di ${row.cognomeNome}`} className="flex items-center gap-1 self-start rounded bg-white/80 px-2 py-1 text-xs font-bold text-slate-800 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700">
      {espanso ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}{espanso ? 'Riduci' : 'Espandi'}
    </button>}
  </div>;
}

export default function TabellaPagamenti({ titolo, pagati, righe, vuoto, onPaga, busy, euro }) {
  return <section className="space-y-10 pt-10">
    <div className="flex items-center gap-4 border-b border-slate-200 pb-2">
      <h2 className="text-2xl font-semibold text-slate-900">{titolo}</h2>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-[17px] font-semibold text-slate-700">{righe.length}</span>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
      <table className="w-full min-w-[1400px] table-fixed border-collapse text-center text-[13px] text-slate-800">
        <colgroup>{columns.map(([label, width]) => <col key={label} style={{ width }} />)}</colgroup>
        <thead className="bg-slate-100 text-slate-900"><tr>
          {columns.map(([label]) => <th key={label} scope="col" className="border-b border-r border-slate-300 px-2 py-3 align-middle font-semibold uppercase last:border-r-0">{label}</th>)}
        </tr></thead>
        <tbody className="text-[13px] leading-snug">
          {!righe.length && <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-600">{vuoto}</td></tr>}
          {righe.map((row, index) => {
            const cell = 'border-r border-r-slate-200 px-2 py-1 align-middle last:border-r-0';
            const numberCell = `${cell} whitespace-nowrap text-[16px]`;
            const rowColor = pagati ? (index % 2 ? 'bg-green-400' : 'bg-emerald-200') : (index % 2 ? 'bg-sky-200' : 'bg-white');
            const paroleNome = String(row.cognomeNome || '').trim().split(/\s+/);
            const netto = Number(row.stipendioNetto) || 0;
            const dettaglioFPM = Object.entries(row.dettaglioFPM || {}).map(([causale, ore]) => `${causale}: ${ore} h`).join(' · ');
            return <Fragment key={row.idDipendente}>
              <tr className={`${rowColor} h-20`}>
                <td rowSpan={2} className={`${cell} break-words border-b-2 border-b-slate-400`}>
                  <div className="max-h-24 overflow-y-auto font-semibold text-slate-900"><span className="text-[17px]">{paroleNome.slice(0, 3).join(' ')}</span>{paroleNome.length > 3 && <> <span>{paroleNome.slice(3).join(' ')}</span></>}</div>
                </td>
                <td className={numberCell}>{Number(row.oreLavorate || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })}</td>
                <td className={numberCell}>{euro(row.pagaOraria)}<span className="block text-xs font-semibold">{row.tipoPaga === 'Mensile' ? 'Mensile' : 'Oraria'}</span></td>
                <td className={numberCell}>{euro(row.pagaLavorato)}</td>
                <td className={numberCell} title={dettaglioFPM || undefined}>{euro(row.pagaFPM)}{dettaglioFPM && <span className="block truncate text-xs" title={dettaglioFPM}>{dettaglioFPM}</span>}</td>
                <td className={numberCell}>{euro(row.maggiorazioni)}</td>
                <td className={numberCell}>{euro(row.detrazioni)}</td>
                <td className={`${numberCell} font-semibold`}>{euro(netto)}{row.pagamento && <><span className="block text-xs">Pagato: {euro(row.pagamento.importo)}</span><span className="block text-xs">{new Date(row.pagamento.pagatoAt).toLocaleString('it-IT')}</span></>}{!row.pagamento && netto <= 0 && <span className="block whitespace-normal text-xs text-amber-900">Nessun importo da pagare</span>}</td>
                <td className={`${numberCell} font-semibold`}>{row.nettoBusta == null ? <span className="whitespace-normal text-xs text-slate-500">Busta non caricata</span> : euro(row.nettoBusta)}</td>
                <td rowSpan={2} className={`${cell} border-b-2 border-b-slate-400`}>
                  <div className="flex items-center justify-center gap-2">
                    {row.allegatoBustaPaga ? <a href={attachmentUrl(row.allegatoBustaPaga)} target="_blank" rel="noreferrer" aria-label={`Visualizza la busta paga di ${row.cognomeNome}`} title="Visualizza busta paga" className="rounded-lg bg-white/70 p-2 text-indigo-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700"><FileText className="h-5 w-5" aria-hidden="true" /></a> :
                      <button type="button" disabled aria-label={`Busta paga non caricata per ${row.cognomeNome}`} title="Busta paga non caricata" className="cursor-not-allowed rounded-lg bg-slate-200/70 p-2 text-slate-400 opacity-50"><FileText className="h-5 w-5" aria-hidden="true" /></button>}
                    {row.pagamento ? <span role="status" title={`Pagato il ${new Date(row.pagamento.pagatoAt).toLocaleString('it-IT')} · ${euro(row.pagamento.importo)}`} className="flex flex-col items-center gap-1 rounded-lg bg-white/70 p-1 text-emerald-900"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /><span className="text-[11px] font-bold">Pagato!</span></span> : netto > 0 ?
                      <button type="button" disabled={busy} onClick={() => onPaga(row)} aria-label={`Conferma pagamento a ${row.cognomeNome}`} title="Conferma pagamento effettuato" className="rounded-lg bg-white/70 p-2 text-emerald-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50"><CreditCard className="h-5 w-5" aria-hidden="true" /></button> :
                      <span role="status" title="Nessun importo positivo da pagare: verifica l’elaborato" aria-label="Nessun importo positivo da pagare" className="rounded-lg bg-white/70 p-2 text-amber-800"><CircleAlert className="h-5 w-5" aria-hidden="true" /></span>}
                    {row.storicoPreesistente && !row.pagamento && <span title="Mese storico: verifica prima di registrare il pagamento" aria-label="Mese storico: verifica prima di registrare il pagamento" className="text-amber-800"><CircleAlert className="h-5 w-5" aria-hidden="true" /></span>}
                  </div>
                </td>
              </tr>
              <tr className={`${rowColor} h-14`}>
                <td colSpan={columns.length - 2} className="border-b-2 border-b-slate-400 px-4 py-1 text-left align-middle font-semibold text-slate-800">
                  <DettagliPagamento row={row} />
                </td>
              </tr>
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}
