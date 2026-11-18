import { companyStampUrl } from '../../utils/companyStampUrl';
import IntestazioneAziendaLettera from '../moduli/IntestazioneAziendaLettera';
import { testoContrattoAppalto } from './testoContrattoAppalto';

const headings = new Set([10, 13, 19, 25, 34, 38, 45, 50, 59, 63, 66, 70, 74, 79, 82, 95]);

export default function PrintableContrattoAppalto({ data, azienda, previewMode = false }) {
  if (!data) return null;
  const paragrafi = testoContrattoAppalto(data, azienda);
  const timbro = companyStampUrl(azienda?.timbro_path);
  return <div id={previewMode ? undefined : 'contratto-appalto-pdf'} className={`${previewMode ? '' : 'print-only'} bg-white font-sans text-slate-950`}>
    {!previewMode && <style>{'@page { size: A4; margin: 14mm 12mm 20mm; @bottom-center { content: "M2I S.R.L.P.I.: 15989811003 - Sede Legale: Via Del Fontanile Anagnino, 183 – 00118 Roma\\A Tel: 351.5471406 - Mail: info@emmeduei.com - Pec: emmedueisrl@pec.it"; white-space: pre; font: 8px Arial, sans-serif; color: #475569; } @bottom-right { content: counter(page) "/" counter(pages); font: 10px Arial, sans-serif; color: #334155; } }'}</style>}
    <article className="mx-auto max-w-[190mm] px-6 py-6 print:max-w-none print:px-0 print:py-0">
      <IntestazioneAziendaLettera azienda={azienda} area="" descrizione="" />
      {paragrafi.map((paragraph, index) => {
        if (!paragraph.trim()) return null;
        if (index === 0) return <h1 key={index} className="mt-7 text-center text-xl font-bold uppercase tracking-wide text-blue-800">{paragraph}</h1>;
        if (headings.has(index)) return <h2 key={index} className="mt-6 mb-2 border-b border-blue-800 pb-1 text-[12px] font-bold uppercase tracking-[0.06em] text-blue-800 print:break-after-avoid">{paragraph}</h2>;
        if (index === 8) return <p key={index} className="my-6 text-center text-sm font-bold tracking-wide">{paragraph}</p>;
        if (index === 100 || index === 117) return <div key={index} className="my-6 grid grid-cols-2 gap-8 break-inside-avoid text-center text-[12px] font-bold">
          <div>APPALTATORE{timbro && <img src={timbro} alt="Timbro e firma M2I" className="mx-auto mt-2 max-h-[27mm] max-w-[60mm] object-contain" />}<div className="mt-2 border-b border-slate-500" /></div>
          <div>COMMITTENTE<div className="mt-[27mm] border-b border-slate-500" /></div>
        </div>;
        return <p key={index} className={`${index === 2 || index === 4 ? 'mt-5' : 'mt-2'} text-[11.5px] leading-[1.5] text-slate-900 print:break-inside-avoid ${index === 3 || index === 5 ? 'italic' : ''}`}>{paragraph}</p>;
      })}
    </article>
    <footer className="px-6 py-2 text-center text-[8px] text-slate-600 print:hidden">
      <span>M2I S.R.L.</span><span>P.I.: 15989811003 - Sede Legale: Via Del Fontanile Anagnino, 183 – 00118 Roma</span><br />
      <span>Tel: 351.5471406 - Mail: info@emmeduei.com - Pec: emmedueisrl@pec.it</span>
    </footer>
  </div>;
}
