import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, FilePlus2, Send, X } from 'lucide-react';

const columns = [
  ['Cliente (ragione sociale)', '20%'],
  ['Totale imponibile', '11%'],
  ['R. FIS.', '7%'],
  ['Tassa', '9%'],
  ['Totale\nfattura', '11%'],
  ['Note', '34%'],
  ['Azioni', '8%']
];

const differenceCents = row => Math.round((Number(row.importoRealmenteFatturato) || 0) * 100) - Math.round((Number(row.importoTotale) || 0) * 100);
const regimeBreve = value => {
  const regime = String(value || 'IVA').trim().toUpperCase();
  if (regime === 'REVERSE CHARGE') return 'R.G';
  if (regime === 'TRAT. ACC.' || regime === 'TRATTENUTA ACCONTO') return 'T.A';
  return regime;
};

export default function TabellaFatture({ titolo, elaborate, righe, vuoto, base, onRegistra, onInviata, busy, euro }) {
  const [detailsRow, setDetailsRow] = useState(null);
  useEffect(() => {
    if (!detailsRow) return;
    const closeOnEscape = event => { if (event.key === 'Escape') setDetailsRow(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [detailsRow]);

  return <section className="space-y-10 pt-10">
    <div className="flex items-center gap-4 border-b border-slate-200 pb-2">
      <h2 className="text-2xl font-semibold text-slate-900">{titolo}</h2>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-[17px] font-semibold text-slate-700">{righe.length}</span>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
      <table className="w-full min-w-[1100px] table-fixed border-collapse text-center text-[13px] text-slate-800">
        <colgroup>{columns.map(([label, width]) => <col key={label} style={{ width }} />)}</colgroup>
        <thead className="bg-slate-100 text-slate-900"><tr>
          {columns.map(([label]) => <th key={label} scope="col" className="whitespace-pre-line border-b border-r border-slate-300 px-2 py-3 align-middle font-semibold uppercase last:border-r-0">{label}</th>)}
        </tr></thead>
        <tbody className="text-[17px] leading-snug">
          {!righe.length && <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-600">{vuoto}</td></tr>}
          {righe.map((row, index) => {
            const fatture = row.fatture || [];
            const totale = Number(row.importoTotale) || 0;
            const tassa = Number.isFinite(Number(row.importoTassa)) ? Number(row.importoTassa) : totale - (Number(row.imponibile) || 0);
            const registered = fatture.length > 0;
            const hasDifference = registered && Math.abs(differenceCents(row)) > 20;
            const cell = 'border-r border-r-slate-200 border-b-2 border-b-slate-400 px-2 py-2 align-middle last:border-r-0';
            const numberCell = `${cell} whitespace-nowrap text-[18px]`;
            const rowColor = elaborate
              ? (index % 2 ? 'bg-green-400' : 'bg-emerald-200')
              : (index % 2 ? 'bg-sky-200' : 'bg-white');
            const paroleNome = String(row.ragioneSociale || '').trim().split(/\s+/);
            return <tr key={row.idCliente} className={`${rowColor} h-24`}>
              <td className={`${cell} break-words`}>
                <div className="max-h-24 overflow-y-auto">
                <div className="font-semibold text-slate-900"><span className="text-[17px]">{paroleNome.slice(0, 3).join(' ')}</span>{paroleNome.length > 3 && <> <span>{paroleNome.slice(3).join(' ')}</span></>}</div>
                </div>
              </td>
              <td className={numberCell}>{euro(row.imponibile)}</td>
              <td className={`${cell} whitespace-nowrap`} title={row.tipoTassazione || 'IVA'}>{regimeBreve(row.tipoTassazione)}</td>
              <td className={numberCell}>{euro(tassa)}</td>
              <td className={`${numberCell} font-semibold`}>{euro(totale)}</td>
              <td className={`${cell} break-words px-3 text-left text-[18px] text-slate-800`}>
                <div className="max-h-28 space-y-1 overflow-y-auto whitespace-pre-wrap">
                  {row.notaFissa && <p><span className="font-semibold">Nota fissa:</span> {row.notaFissa}</p>}
                  {row.notaMensile && <p><span className="font-semibold">Nota del mese:</span> {row.notaMensile}</p>}
                  {!row.notaFissa && !row.notaMensile && <span className="text-slate-500">—</span>}
                </div>
              </td>
              <td className={cell}>
                <div className="flex items-center justify-center gap-2">
                  {registered ? <>
                    <span role="status" title="Fattura registrata!" className="flex flex-col items-center gap-1 rounded-lg bg-white/70 p-2 text-emerald-900"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /><span className="text-[11px] font-bold">Fattura registrata!</span></span>
                    {hasDifference && <button type="button" onClick={() => setDetailsRow(row)} aria-label={`Differenza nella fattura di ${row.ragioneSociale}: apri note e allegati`} title="Differenza superiore a € 0,20: apri note e allegati" className="rounded-full bg-white p-1.5 text-red-700 ring-1 ring-red-700 hover:bg-red-50">
                      <CircleAlert className="h-5 w-5" aria-hidden="true" />
                    </button>}
                  </> : <>
                    <button type="button" onClick={() => onRegistra(row)} aria-label={`Registra fattura di ${row.ragioneSociale}`} title="Registra fattura" className="rounded-lg bg-white/70 p-1.5 text-indigo-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700"><FilePlus2 className="h-5 w-5" aria-hidden="true" /></button>
                    {row.fatturaInviataAt ? <span role="status" title="Fattura inviata" className="flex flex-col items-center gap-1 rounded-lg bg-white/70 p-1 text-emerald-900"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /><span className="text-[11px] font-bold">Fattura inviata</span></span> :
                      !elaborate && <button type="button" disabled={busy} onClick={() => onInviata(row)} aria-label={`Segna come inviata la fattura di ${row.ragioneSociale}`} title="Fattura inviata" className="rounded-lg bg-white/70 p-1.5 text-emerald-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50"><Send className="h-5 w-5" aria-hidden="true" /></button>}
                    {row.storicoPreesistente && <span title="Storico: verifica prima di registrare" aria-label="Storico: verifica prima di registrare" className="text-amber-800"><CircleAlert className="h-5 w-5" aria-hidden="true" /></span>}
                  </>}
                </div>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    {detailsRow && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={() => setDetailsRow(null)}>
      <div role="dialog" aria-modal="true" aria-labelledby="invoice-details-title" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 text-left text-slate-900 shadow-xl" onMouseDown={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 id="invoice-details-title" className="text-lg font-bold">Fattura registrata · {detailsRow.ragioneSociale}</h3>
          <button type="button" onClick={() => setDetailsRow(null)} aria-label="Chiudi dettagli fattura" className="rounded p-1 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 grid gap-3 rounded-lg bg-red-50 p-3 text-sm sm:grid-cols-3">
          <div><span className="block font-semibold">Importo da fatturare</span>{euro(detailsRow.importoTotale)}</div>
          <div><span className="block font-semibold">Importo registrato</span>{euro(detailsRow.importoRealmenteFatturato)}</div>
          <div className="text-red-700"><span className="block font-bold">Differenza</span>{euro(differenceCents(detailsRow) / 100)}</div>
        </div>
        <div className="mt-4 space-y-1 text-sm">
          <h4 className="font-bold">Note</h4>
          {detailsRow.notaFissa && <p>Nota fissa: {detailsRow.notaFissa}</p>}
          {detailsRow.notaMensile && <p>Nota del mese: {detailsRow.notaMensile}</p>}
          {!detailsRow.notaFissa && !detailsRow.notaMensile && <p>Nessuna nota.</p>}
        </div>
        <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
          <h4 className="font-bold">Fatture e allegati</h4>
          {(detailsRow.fatture || []).map(f => <p key={f.id}>Fattura {f.numero} · {f.data} · {euro(f.importo)} · registrata {new Date(f.registrataAt).toLocaleString('it-IT')} · {f.statoRiconciliazione === 'riconciliata' ? 'Riconciliata' : f.statoRiconciliazione === 'da_verificare' ? 'Da verificare' : 'In attesa XML/CSV'}{f.allegato && <> · <a className="font-semibold text-indigo-700 underline" href={`${base}/api/contabilita/fatture/${f.id}/allegato`}>Apri allegato</a></>}</p>)}
        </div>
      </div>
    </div>}
  </section>;
}
