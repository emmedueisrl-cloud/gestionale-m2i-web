import { companyStampUrl } from '../../utils/companyStampUrl';
import IntestazioneAziendaLettera from './IntestazioneAziendaLettera';
import { luogoM2i, nomeM2i, sedeM2i } from '../../utils/datiM2iDocumento';
import { segmentiLetteraTrasformazione } from './letteraTrasformazioneTesto';

const dateIt = value => value && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : value || '____ / ____ / ________';
const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const dateLong = value => value && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? `${Number(value.slice(8, 10))} ${mesi[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}` : dateIt(value);

export default function PrintableLetteraTrasformazione({ data, azienda, previewMode = false }) {
  if (!data) return null;
  const timbro = companyStampUrl(azienda?.timbro_path);
  const paragrafi = segmentiLetteraTrasformazione(data);
  return <div id={previewMode ? undefined : 'lettera-trasformazione-pdf'}
    className={`${previewMode ? '' : 'print-only'} w-full bg-white font-sans text-slate-950`}>
    {!previewMode && <style>{'@page { size: A4; margin: 8mm; @bottom-right { content: counter(page) "/" counter(pages); font: 10px Arial, sans-serif; color: #334155; } }'}</style>}
    <article className="mx-auto flex w-full max-w-[190mm] flex-col px-6 py-5 print:min-h-[278mm] print:max-w-none print:px-[2mm] print:py-[4mm]">
      <IntestazioneAziendaLettera azienda={azienda} area="" descrizione="" />

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Lettera di trasformazione</h1>
        </div>
        <p className="text-right text-[12px] text-slate-700">{luogoM2i(azienda)}, <strong>{dateIt(data.dataFirma)}</strong></p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6 border-y border-slate-300 py-3 text-[12px] leading-[1.35]">
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Datore di lavoro</p>
          <p className="font-bold">{nomeM2i(azienda)}</p>
          <p className="font-bold">{sedeM2i(azienda)}</p>
        </div>
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Destinatario</p>
          <p className="break-words font-bold uppercase">{data.cognome} {data.nome}</p>
          <p className="break-words font-bold uppercase">{data.indirizzo}</p>
          <p className="break-words font-bold uppercase">{[data.cap, data.citta, data.provincia ? `(${data.provincia})` : ''].filter(Boolean).join(' ')}</p>
        </div>
      </div>

      <div className="mt-8 space-y-7 text-[16px] leading-[1.6] text-slate-900">
        {paragrafi.map((parti, index) => <p key={index}>{parti.map((parte, piece) => parte.bold
          ? <strong key={piece}>{parte.text}</strong> : <span key={piece}>{parte.text}</span>)}</p>)}
      </div>

      <div className="mt-7 flex break-inside-avoid items-end justify-between gap-4 border-t border-slate-300 pt-5">
        <div className="text-[13px] text-slate-700"><p>{luogoM2i(azienda)}, <strong>{dateLong(data.dataFirma)}</strong></p>
          <p className="mt-8">Firma del lavoratore ____________________________</p></div>
        <div className="flex w-[60mm] min-h-[32mm] flex-col items-center justify-end text-center">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">Timbro e firma</p>
          {timbro ? <img src={timbro} alt="Timbro e firma M2I" className="max-h-[27mm] max-w-[60mm] object-contain" /> : <span className="block h-[27mm]" />}
          <div className="w-full border-b border-slate-500" />
        </div>
      </div>
    </article>
  </div>;
}
