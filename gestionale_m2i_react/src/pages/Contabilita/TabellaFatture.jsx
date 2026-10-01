import { Fragment, useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, FilePlus2, Send, X } from 'lucide-react';

const columns = [
  ['Cliente (ragione sociale)', '16%'],
  ['Ore', '5%'],
  ['Sconti/\nMaggiorazioni', '9%'],
  ['Totale imponibile', '8%'],
  ['Regime fiscale', '8%'],
  ['% tassa', '5%'],
  ['Tassa', '6%'],
  ['Totale\nfattura', '8%'],
  ['Costo personale', '9%'],
  ['Residuo senza\nstipendi', '9%'],
  ['Tariffa oraria', '7%'],
  ['Azioni', '10%']
];

const differenceCents = row => Math.round((Number(row.importoRealmenteFatturato) || 0) * 100) - Math.round((Number(row.importoTotale) || 0) * 100);

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
            const hasNotes = Boolean(row.notaFissa || row.notaMensile || row.noteMaggiorazioni || row.noteSconti);
            const cell = `border-r border-r-slate-200 px-2 py-1 align-middle last:border-r-0 ${hasNotes ? '' : 'border-b-2 border-b-slate-400'}`;
            const numberCell = `${cell} whitespace-nowrap text-[16px]`;
            const rowColor = elaborate
              ? (index % 2 ? 'bg-green-400' : 'bg-emerald-200')
              : (index % 2 ? 'bg-sky-200' : 'bg-white');
            const paroleNome = String(row.ragioneSociale || '').trim().split(/\s+/);
            return <Fragment key={row.idCliente}>
            <tr className={`${rowColor} ${hasNotes ? 'h-16' : 'h-28'}`}>
              <td rowSpan={hasNotes ? 2 : undefined} className={`${cell} break-words border-b-2 border-b-slate-400`}>
                <div className="max-h-24 overflow-y-auto">
                <div className="font-semibold text-slate-900"><span className="text-[17px]">{paroleNome.slice(0, 3).join(' ')}</span>{paroleNome.length > 3 && <> <span>{paroleNome.slice(3).join(' ')}</span></>}</div>
                </div>
              </td>
              <td className={numberCell}>{Number(row.oreLavorate || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })}</td>
              <td className={numberCell}>
                {Number(row.maggiorazioni || 0) || Number(row.sconti || 0) ? <><div>+ {euro(row.maggiorazioni)}</div><div>- {euro(row.sconti)}</div></> : '0'}
              </td>
              <td className={numberCell}>{euro(row.imponibile)}</td>
              <td className={`${cell} break-words`}>{row.tipoTassazione || 'IVA'}</td>
              <td className={numberCell}>{aliquota.toLocaleString('it-IT', { maximumFractionDigits: 2 })}%</td>
              <td className={numberCell}>{euro(tassa)}</td>
              <td className={`${numberCell} font-semibold`}>{euro(totale)}</td>
              <td className={numberCell}>{euro(costo)}<span className="block text-xs font-semibold" title="Definitivo solo quando il mese dipendenti è chiuso o tutte le righe dipendenti sono blindate">{row.costoPersonaleDefinitivo === true ? 'Definitivo' : 'Provvisorio'}</span></td>
              <td className={`${numberCell} font-semibold ${residuo < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{euro(residuo)}<span className="block text-xs">{row.costoPersonaleDefinitivo === true ? 'Definitivo' : 'Provvisorio'}</span></td>
              <td className={numberCell}>{euro(row.tariffaOraria)}</td>
              <td rowSpan={hasNotes ? 2 : undefined} className={`${cell} border-b-2 border-b-slate-400`}>
                <div className="flex items-center justify-center gap-2">
                  {registered ? <>
                    <span role="status" title="Fattura registrata!" className="flex flex-col items-center gap-1 rounded-lg bg-white/70 p-2 text-emerald-900"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /><span className="text-[11px] font-bold">Fattura registrata!</span></span>
                    {hasDifference && <button type="button" onClick={() => setDetailsRow(row)} aria-label={`Differenza nella fattura di ${row.ragioneSociale}: apri note e allegati`} title="Differenza superiore a € 0,20: apri note e allegati" className="rounded-full bg-white p-1.5 text-red-700 ring-1 ring-red-700 hover:bg-red-50">
                      <CircleAlert className="h-5 w-5" aria-hidden="true" />
                    </button>}
                  </> : <>
                    <button type="button" onClick={() => onRegistra(row)} aria-label={`Registra fattura di ${row.ragioneSociale}`} title="Registra fattura" className="rounded-lg bg-white/70 p-2 text-indigo-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-700"><FilePlus2 className="h-5 w-5" aria-hidden="true" /></button>
                    {row.fatturaInviataAt ? <span role="status" title="Fattura inviata" className="flex flex-col items-center gap-1 rounded-lg bg-white/70 p-1 text-emerald-900"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /><span className="text-[11px] font-bold">Fattura inviata</span></span> :
                      !elaborate && <button type="button" disabled={busy} onClick={() => onInviata(row)} aria-label={`Segna come inviata la fattura di ${row.ragioneSociale}`} title="Fattura inviata" className="rounded-lg bg-white/70 p-2 text-emerald-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50"><Send className="h-5 w-5" aria-hidden="true" /></button>}
                    {row.storicoPreesistente && <span title="Storico: verifica prima di registrare" aria-label="Storico: verifica prima di registrare" className="text-amber-800"><CircleAlert className="h-5 w-5" aria-hidden="true" /></span>}
                  </>}
                </div>
              </td>
            </tr>
            {hasNotes && <tr className={`${rowColor} h-12`}>
              <td colSpan={columns.length - 2} className="border-b-2 border-b-slate-400 px-4 py-1 text-left align-middle font-semibold text-slate-800">
                <div className="h-9 overflow-y-auto break-words rounded-md bg-white/35 px-3 py-1">
                  <div className="space-y-1">
                    {row.notaFissa && <p>Nota fissa: {row.notaFissa}</p>}
                    {row.notaMensile && <p>Nota del mese: {row.notaMensile}</p>}
                    {row.noteMaggiorazioni && <p>Maggiorazione: {row.noteMaggiorazioni}</p>}
                    {row.noteSconti && <p>Sconto: {row.noteSconti}</p>}
                  </div>
                </div>
              </td>
            </tr>}
            </Fragment>;
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
