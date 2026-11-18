import { companyStampUrl } from '../../utils/companyStampUrl';
import IntestazioneAziendaLettera from './IntestazioneAziendaLettera';

const dateDots = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : value || '__.__.____';
const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const dateLong = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')
  ? `${Number(value.slice(8, 10))} ${mesi[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}` : dateDots(value);

export default function PrintableLetteraProroga({ data, azienda, previewMode = false }) {
  if (!data) return null;
  const timbro = companyStampUrl(azienda?.timbro_path);
  return <div id={previewMode ? undefined : 'lettera-proroga-pdf'}
    className={`${previewMode ? '' : 'print-only'} w-full bg-white font-sans text-slate-950`}>
    {!previewMode && <style>{'@page { size: A4; margin: 8mm; @bottom-right { content: counter(page) "/" counter(pages); font: 10px Arial, sans-serif; color: #334155; } }'}</style>}
    <article className="mx-auto flex w-full max-w-[190mm] flex-col px-6 py-5 print:min-h-[278mm] print:max-w-none print:px-[2mm] print:py-[4mm]">
      <IntestazioneAziendaLettera azienda={azienda} />
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Rapporto di lavoro</p>
          <h1 className="text-2xl font-bold tracking-tight">Lettera di proroga</h1>
        </div>
        <p className="text-right text-[12px] text-slate-700">Roma, {dateDots(data.dataFirma)}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 border-y border-slate-300 py-3 text-[12px] leading-[1.35]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Datore di lavoro</p>
          <p className="font-bold">{azienda?.ragione_sociale || 'M2I S.R.L.'}</p>
          <p>{azienda?.sede_legale || 'VIA DEL FONTANILE ANAGNINO 183, 00118 ROMA (RM)'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Destinatario</p>
          <p className="font-bold uppercase">{data.cognome} {data.nome}</p>
          <p className="uppercase">{data.indirizzo}</p>
          <p className="uppercase">{[data.cap, data.citta, data.provincia ? `(${data.provincia})` : ''].filter(Boolean).join(' ')}</p>
        </div>
      </div>
      <p className="mt-7 border-b border-blue-800 pb-2 text-[13px] font-bold uppercase tracking-[0.05em] text-blue-800">Oggetto: comunicazione di proroga del contratto di lavoro a tempo determinato ai sensi del D.Lgs. n. 81 del 15/06/2015 e art. 17 D.L. 22 marzo 2021 n. 41.</p>
      <div className="mt-7 space-y-5 text-[15px] leading-[1.55] text-slate-900">
        <p>Il sottoscritto <strong>{data.amministratore}</strong>, in qualità di Amministratore Unico della “<strong>{azienda?.ragione_sociale || 'M2I S.R.L.'}</strong>” C.F. <strong>{azienda?.codice_fiscale || azienda?.partita_iva || '15989811003'}</strong>, con sede legale a Roma in <strong>{azienda?.sede_legale || 'VIA DEL FONTANILE ANAGNINO 183, 00118 ROMA (RM)'}</strong>, Le comunica la proroga del rapporto di lavoro a tempo determinato ai sensi del D.Lgs. n. 81 del 15/06/2015 e art. 17 D.L. 22 marzo 2021 n. 41, instaurato in data <strong>{dateDots(data.dataAssunzione)}</strong>, con scadenza al <strong>{dateDots(data.nuovaScadenza)}</strong>.</p>
        <p>La sede di lavoro e le mansioni attribuiteLe restano immutate; le ore di lavoro saranno <strong>{data.oreSettimanali} ore settimanali</strong>. La proroga si riferisce alla stessa attività lavorativa per la quale è stato stipulato inizialmente il contratto a termine.</p>
        <p>La preghiamo sottoscrivere la copia della presente, per ricevuta e per integrale accettazione del contenuto.</p>
      </div>
      <div className="mt-8 flex items-end justify-between gap-4">
        <div className="text-[13px] text-slate-700">Roma, {dateLong(data.dataFirma)}<p className="mt-8">Firma del lavoratore</p><div className="mt-8 w-[65mm] border-b border-slate-500" /></div>
        <div className="flex w-[60mm] min-h-[32mm] flex-col items-center justify-end text-center">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">Timbro e firma</p>
          {timbro ? <img src={timbro} alt="Timbro e firma M2I" className="max-h-[27mm] max-w-[60mm] object-contain" /> : <span className="block h-[27mm]" />}
          <div className="w-full border-b border-slate-500" />
        </div>
      </div>
      <div className="mt-7 space-y-3 border-t border-slate-300 pt-4 text-[11px] leading-[1.4] text-slate-800">
        <p>Per l’instaurazione e l’esecuzione del rapporto di lavoro regolato dal presente contratto, la Società acquisisce e tratta i Suoi dati personali, conformemente a quanto previsto dal Regolamento UE 2016/679 e dalla normativa nazionale vigente, compresi eventuali provvedimenti emanati dall’Autorità di Controllo, ove applicabili, nonché dallo Statuto dei Lavoratori (L. 300/1970), come da Informativa sul trattamento dei dati personali allegata.</p>
        <p>In virtù del presente contratto, Lei è altresì obbligato/a a prestare la Sua attività nel rispetto delle istruzioni impartite ai sensi dell’art. 29 Regolamento UE 2016/679 sul trattamento dei dati personali per il quale è autorizzato dalla scrivente (come da documento allegato per il conferimento dell’autorizzazione al trattamento dei dati personali ed individuazione dell’ambito del trattamento consentito, ai sensi del Regolamento UE 2016/679).</p>
        <p className="pt-2">Firma del lavoratore</p><div className="w-[65mm] border-b border-slate-500" />
      </div>
    </article>
  </div>;
}
