import { companyStampUrl } from '../../utils/companyStampUrl';
import IntestazioneAziendaLettera from './IntestazioneAziendaLettera';

const dateIt = value => value && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : value || '____ / ____ / ________';
const dateDots = value => value && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : value || '__.__.____';
const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const dateLong = value => value && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? `${Number(value.slice(8, 10))} ${mesi[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}` : dateIt(value);

export default function PrintableLetteraTrasformazione({ data, azienda, previewMode = false }) {
  if (!data) return null;
  const timbro = companyStampUrl(azienda?.timbro_path);
  return <div id={previewMode ? undefined : 'lettera-trasformazione-pdf'}
    className={`${previewMode ? '' : 'print-only'} w-full bg-white font-sans text-slate-950`}>
    {!previewMode && <style>{'@page { size: A4; margin: 8mm; @bottom-right { content: counter(page) "/" counter(pages); font: 10px Arial, sans-serif; color: #334155; } }'}</style>}
    <article className="mx-auto flex w-full max-w-[190mm] flex-col px-6 py-5 print:min-h-[278mm] print:max-w-none print:px-[2mm] print:py-[4mm]">
      <IntestazioneAziendaLettera azienda={azienda} />

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Rapporto di lavoro</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Lettera di trasformazione</h1>
        </div>
        <p className="text-right text-[12px] text-slate-700">Roma, {dateIt(data.dataFirma)}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 border-y border-slate-300 py-3 text-[12px] leading-[1.35]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Datore di lavoro</p>
          <p className="font-bold">{azienda?.ragione_sociale || 'M2I S.R.L.'}</p>
          <p>{azienda?.sede_legale || 'Via del Fontanile Anagnino 183, Roma'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Destinatario</p>
          <p className="font-bold uppercase">{data.cognome} {data.nome}</p>
          <p className="uppercase">{data.indirizzo}</p>
          <p className="uppercase">{[data.cap, data.citta, data.provincia ? `(${data.provincia})` : ''].filter(Boolean).join(' ')}</p>
        </div>
      </div>

      <p className="mt-8 border-b border-blue-800 pb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-blue-800">Oggetto: trasformazione contratto di lavoro a tempo indeterminato.</p>

      <div className="mt-8 space-y-7 text-[16px] leading-[1.6] text-slate-900">
        <p>In riferimento al rapporto di lavoro a tempo determinato instaurato con la S.V. in data <strong>{dateDots(data.dataAssunzione)}</strong>, ai sensi del Dlgs. n. 368/2001, della Legge 247/2007 e secondo quanto previsto dall’art. 11 del CCNL Pulizie, siamo lieti di comunicarle che dalla data del <strong>{dateDots(data.dataTrasformazione)}</strong> il suo rapporto sarà trasformato in rapporto di lavoro a tempo indeterminato.</p>
        <p>La qualifica d’assunzione è quella di <strong>{data.qualifica}</strong> con le mansioni di <strong>{data.mansioni}</strong> <strong>{data.livello}</strong> per <strong>{data.oreSettimanali}</strong>.</p>
        <p>Per la retribuzione e gli altri aspetti del rapporto di lavoro, si fa riferimento alle norme di legge e del C.C.N.L. vigente del settore Imprese di pulizia.</p>
      </div>

      <div className="mt-12 flex items-end justify-between gap-4 border-t border-slate-300 pt-6 print:mt-auto">
        <p className="text-[13px] text-slate-700">Roma, {dateLong(data.dataFirma)}</p>
        <div className="flex w-[60mm] min-h-[32mm] flex-col items-center justify-end text-center">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">Timbro e firma</p>
          {timbro ? <img src={timbro} alt="Timbro e firma M2I" className="max-h-[27mm] max-w-[60mm] object-contain" /> : <span className="block h-[27mm]" />}
          <div className="w-full border-b border-slate-500" />
        </div>
      </div>
    </article>
  </div>;
}
