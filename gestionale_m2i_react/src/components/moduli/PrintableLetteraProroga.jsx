import { companyStampUrl } from '../../utils/companyStampUrl';
import IntestazioneAziendaLettera from './IntestazioneAziendaLettera';
import { luogoM2i, nomeM2i, sedeM2i } from '../../utils/datiM2iDocumento';
import { dataProrogaIt, oggettoLetteraProroga, presaVisioneProroga, segmentiLetteraProroga } from './letteraProrogaTesto';

export default function PrintableLetteraProroga({ data, azienda, previewMode = false }) {
  if (!data) return null;
  const timbro = companyStampUrl(azienda?.timbro_path);
  const paragrafi = segmentiLetteraProroga(data);
  return <div id={previewMode ? undefined : 'lettera-proroga-pdf'}
    className={`${previewMode ? '' : 'print-only'} w-full bg-white font-sans text-slate-950`}>
    {!previewMode && <style>{'@page { size: A4; margin: 8mm; @bottom-right { content: counter(page) "/" counter(pages); font: 10px Arial, sans-serif; color: #334155; } }'}</style>}
    <article className="mx-auto flex w-full max-w-[190mm] flex-col px-6 py-5 print:min-h-[278mm] print:max-w-none print:px-[2mm] print:py-[4mm]">
      <IntestazioneAziendaLettera azienda={azienda} area="" descrizione="" />
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lettera di proroga</h1>
        </div>
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
      <p className="mt-7 border-b border-blue-800 pb-2 text-[13px] font-bold uppercase tracking-[0.05em] text-blue-800">{oggettoLetteraProroga}</p>
      <div className="mt-7 space-y-5 text-[15px] leading-[1.55] text-slate-900">
        {paragrafi.map((parti, index) => <p key={index}>{parti.map((parte, piece) => parte.bold
          ? <strong key={piece}>{parte.text}</strong> : <span key={piece}>{parte.text}</span>)}</p>)}
      </div>
      <div className="mt-8 text-[13px] text-slate-700">{luogoM2i(azienda)}, <strong>{dataProrogaIt(data.dataFirma)}</strong></div>
      <p className="mt-6 text-[13px] text-slate-900">{presaVisioneProroga}</p>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="text-[13px] text-slate-700"><p>(Lavoratore)</p><div className="mt-8 w-[65mm] border-b border-slate-500" /></div>
        <div className="flex w-[60mm] min-h-[32mm] flex-col items-center justify-end text-center">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">{nomeM2i(azienda)} (Datore di lavoro)</p>
          {timbro ? <img src={timbro} alt="Timbro e firma M2I" className="max-h-[27mm] max-w-[60mm] object-contain" /> : <span className="block h-[27mm]" />}
        </div>
      </div>
    </article>
  </div>;
}
