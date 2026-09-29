import { useEffect, useState } from 'react';
import { CircleAlert, X } from 'lucide-react';

const columns = [
  ['Cliente (ragione sociale)', '18%'],
  ['Ore', '5%'],
  ['Sconti/\nMaggiorazioni', '10%'],
  ['Totale imponibile', '9%'],
  ['Regime fiscale', '9%'],
  ['% tassa', '6%'],
  ['Tassa', '7%'],
  ['Totale\nfattura', '9%'],
  ['Costo personale', '10%'],
  ['Residuo senza\nstipendi', '10%'],
  ['Tariffa oraria', '7%']
];

const differenceCents = row => Math.round((Number(row.importoRealmenteFatturato) || 0) * 100) - Math.round((Number(row.importoTotale) || 0) * 100);

export default function TabellaFatture({ titolo, righe, vuoto, base, onRegistra, onInviata, busy, euro }) {
  const [detailsRow, setDetailsRow] = useState(null);
  useEffect(() => {
    if (!detailsRow) return;
    const closeOnEscape = event => { if (event.key === 'Escape') setDetailsRow(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [detailsRow]);

  return <section className="space-y-3">
    <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
      <h2 className="text-xl font-semibold text-slate-900">{titolo}</h2>
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700">{righe.length}</span>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
      <table className="w-full min-w-[1400px] table-fixed border-collapse text-center text-[13px] text-slate-800">
        <colgroup>{columns.map(([label, width]) => <col key={label} style={{ width }} />)}</colgroup>
        <thead className="bg-slate-100 text-slate-900"><tr>
          {columns.map(([label]) => <th key={label} scope="col" className="whitespace-pre-line border-b border-r border-slate-300 px-2 py-3 align-middle font-semibold uppercase last:border-r-0">{label}</th>)}
        </tr></thead>
        <tbody className="text-[13px] leading-snug">
          {!righe.length && <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-600">{vuoto}</td></tr>}
          {righe.map((row, index) => {
            const fatture = row.fatture || [];
            const costo = Number(row.costoPersonale) || 0;
            const totale = Number(row.importoTotale) || 0;
            const tassa = Number.isFinite(Number(row.importoTassa)) ? Number(row.importoTassa) : totale - (Number(row.imponibile) || 0);
            const residuo = Number.isFinite(Number(row.residuoSenzaStipendi)) ? Number(row.residuoSenzaStipendi) : totale - costo;
            const aliquota = Number(row.percentualeTassaEffettiva) || 0;
            const registered = fatture.length > 0;
            const hasDifference = registered && Math.abs(differenceCents(row)) > 20;
            const dettagli = Boolean(row.storicoPreesistente || row.notaFissa || row.notaMensile || row.noteMaggiorazioni || row.noteSconti);
            const cell = 'border-b-2 border-b-slate-400 border-r border-r-slate-200 px-2 py-3 align-middle last:border-r-0';
            const numberCell = `${cell} whitespace-nowrap text-[16px]`;
            const rowColor = registered ? 'bg-green-400' : row.fatturaInviataAt ? 'bg-emerald-200' : index % 2 ? 'bg-sky-200' : 'bg-white';
            return <tr key={row.idCliente} className={rowColor}>
              <td className={`${cell} break-words`}>
                <div className="font-semibold text-slate-900">{row.ragioneSociale}</div>
                {registered ? <div className="mt-2 flex items-center justify-center gap-2 font-bold text-emerald-950">
                  <span>Fattura registrata!</span>
                  {hasDifference && <button type="button" onClick={() => setDetailsRow(row)} aria-label={`Differenza nella fattura di ${row.ragioneSociale}: apri note e allegati`} title="Differenza superiore a € 0,20: apri note e allegati" className="rounded-full bg-white p-0.5 text-red-700 ring-1 ring-red-700 hover:bg-red-50">
                    <CircleAlert className="h-4 w-4" aria-hidden="true" />
                  </button>}
                </div> : <>
                  {row.storicoPreesistente && <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">Storico: verifica prima di registrare</span>}
                  <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                    <button type="button" onClick={() => onRegistra(row)} className="font-semibold text-indigo-700 underline">Registra fattura</button>
                    {row.fatturaInviataAt ? <span className="font-semibold text-emerald-700">Fattura inviata</span> :
                      <button type="button" disabled={busy} onClick={() => onInviata(row)} className="font-semibold text-emerald-700 underline disabled:opacity-50">Fattura inviata</button>}
                  </div>
                </>}
                {!registered && dettagli && <div className="mt-3 border-t border-slate-300 pt-2 font-semibold text-slate-800">
                  <div className="space-y-1 break-words">
                    {row.notaFissa && <p>Nota fissa: {row.notaFissa}</p>}
                    {row.notaMensile && <p>Nota del mese: {row.notaMensile}</p>}
                    {row.noteMaggiorazioni && <p>Maggiorazione: {row.noteMaggiorazioni}</p>}
                    {row.noteSconti && <p>Sconto: {row.noteSconti}</p>}
                  </div>
                </div>}
              </td>
              <td className={numberCell}>{Number(row.oreLavorate || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })}</td>
              <td className={numberCell}>
                {Number(row.maggiorazioni || 0) || Number(row.sconti || 0) ? <><div>+ {euro(row.maggiorazioni)}</div><div>- {euro(row.sconti)}</div></> : '—'}
              </td>
              <td className={numberCell}>{euro(row.imponibile)}</td>
              <td className={`${cell} break-words`}>{row.tipoTassazione || 'IVA'}</td>
              <td className={numberCell}>{aliquota.toLocaleString('it-IT', { maximumFractionDigits: 2 })}%</td>
              <td className={numberCell}>{euro(tassa)}</td>
              <td className={`${numberCell} font-semibold`}>{euro(totale)}</td>
              <td className={numberCell}>{euro(costo)}</td>
              <td className={`${numberCell} font-semibold ${residuo < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{euro(residuo)}</td>
              <td className={numberCell}>{euro(row.tariffaOraria)}</td>
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
          {detailsRow.noteMaggiorazioni && <p>Maggiorazione: {detailsRow.noteMaggiorazioni}</p>}
          {detailsRow.noteSconti && <p>Sconto: {detailsRow.noteSconti}</p>}
          {!detailsRow.notaFissa && !detailsRow.notaMensile && !detailsRow.noteMaggiorazioni && !detailsRow.noteSconti && <p>Nessuna nota.</p>}
        </div>
        <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
          <h4 className="font-bold">Fatture e allegati</h4>
          {(detailsRow.fatture || []).map(f => <p key={f.id}>Fattura {f.numero} · {f.data} · {euro(f.importo)} · registrata {new Date(f.registrataAt).toLocaleString('it-IT')} · {f.statoRiconciliazione === 'riconciliata' ? 'Riconciliata' : f.statoRiconciliazione === 'da_verificare' ? 'Da verificare' : 'In attesa XML/CSV'}{f.allegato && <> · <a className="font-semibold text-indigo-700 underline" href={`${base}/api/contabilita/fatture/${f.id}/allegato`}>Apri allegato</a></>}</p>)}
        </div>
      </div>
    </div>}
  </section>;
}
