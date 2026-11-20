import React from 'react';
import RegolamentoInterno from './RegolamentoInterno';
import { companyStampUrl } from '../../utils/companyStampUrl';
import IntestazioneAziendaLettera from './IntestazioneAziendaLettera';
import { luogoM2i, nomeM2i } from '../../utils/datiM2iDocumento';
import { dataItContratto, paragrafoOriginaleContrattoAssunzione, segmentiContrattoAssunzione,
  segmentiRecapitiContrattoAssunzione, titoloContrattoAssunzione } from './contrattoAssunzioneTesto';

function FirmaDatore({ timbroUrl, azienda }) {
  return <div className="flex w-[60mm] min-h-[32mm] flex-col items-center text-center">
    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">{nomeM2i(azienda)} (Datore di lavoro)</p>
    {timbroUrl ? <img src={timbroUrl} alt="Timbro e firma M2I" className="max-h-[27mm] max-w-[60mm] object-contain" /> :
      <span className="block h-[27mm]" />}
  </div>;
}

export default function PrintableContrattoAssunzione({ formData, aziendaData, includeRegolamento = false, previewMode = false }) {
  if (!formData) return null;

  const maschio = formData.sesso === 'M';
  const timbroUrl = companyStampUrl(aziendaData?.timbro_path);
  const paragraphs = segmentiContrattoAssunzione(formData, aziendaData);
  const recapiti = segmentiRecapitiContrattoAssunzione(formData);
  const mostraSegmenti = paragraph => paragraph.map((part, partIndex) => part.bold
    ? <strong key={partIndex}>{part.text}</strong> : <React.Fragment key={partIndex}>{part.text}</React.Fragment>);

  return <div id={previewMode ? undefined : 'contratto-assunzione-pdf'}
    className={`${previewMode ? '' : 'print-only'} w-full bg-white font-sans text-slate-950`}>
    {!previewMode && <style>{'@page { size: A4; margin: 8mm; @bottom-right { content: counter(page) "/" counter(pages); font: 10px Arial, sans-serif; color: #334155; } }'}</style>}
    <article className="mx-auto w-full max-w-[190mm] px-6 py-5 print:max-w-none print:px-0 print:py-0">
      <IntestazioneAziendaLettera azienda={aziendaData} area="" descrizione="" />

      <p className="mt-5 text-right text-[11px] text-slate-800">{luogoM2i(aziendaData)}, <strong>{dataItContratto(formData.dataFirma)}</strong></p>
      <div className="ml-auto mt-5 w-fit min-w-[65mm] text-[11px] leading-[1.5] text-slate-900">
        <p><strong>{maschio ? 'Gent.mo Sig.' : 'Gent.ma Sig.ra'}</strong></p>
        <p className="font-bold uppercase">{formData.cognome} {formData.nome}</p>
        <p className="font-bold uppercase">{formData.indirizzo}</p>
        <p className="font-bold uppercase">{[formData.cap, formData.citta, formData.provincia ? `(${formData.provincia})` : ''].filter(Boolean).join(' ')}</p>
      </div>

      <h1 className="mt-8 mb-5 text-center text-[14px] font-bold uppercase leading-[1.35] text-slate-950">{titoloContrattoAssunzione(formData)}</h1>
      <div className="space-y-3 text-[11px] leading-[1.5] text-slate-900">
        {paragraphs.map((paragraph, index) => <p key={index} className="text-justify">{mostraSegmenti(paragraph)}</p>)}
      </div>

      <div className="mt-5 break-inside-avoid text-[11px]">
        <p>{paragrafoOriginaleContrattoAssunzione(39)}</p><p>{luogoM2i(aziendaData)}, lì <strong>{dataItContratto(formData.dataFirma)}</strong></p>
        <div className="mt-5 grid grid-cols-2 items-start gap-8">
          <div className="flex w-[60mm] min-h-[32mm] flex-col items-center text-center">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">(Lavoratore)</p>
            <div className="h-[27mm] w-full border-b border-slate-500" />
          </div>
          <div className="justify-self-end"><FirmaDatore timbroUrl={timbroUrl} azienda={aziendaData} /></div>
        </div>
      </div>

      <section className="mt-7 break-inside-avoid border-t border-slate-300 pt-4 text-[11px] leading-[1.6] text-slate-900">
        <p>{mostraSegmenti(recapiti[0])}</p>
        {recapiti.slice(1).map((paragraph, index) => <p key={index} className={index === 0 ? 'mt-3' : ''}>{mostraSegmenti(paragraph)}</p>)}
        <p className="mt-4">{paragrafoOriginaleContrattoAssunzione(56)} <span>{paragrafoOriginaleContrattoAssunzione(57)}</span></p>
      </section>

      <section className="mt-6 break-inside-avoid border-t border-slate-300 pt-4 text-[10.5px] leading-[1.5] text-slate-800">
        <h2 className="mb-2 text-[11px] font-bold uppercase">{paragrafoOriginaleContrattoAssunzione(58)}</h2>
        <p>{paragrafoOriginaleContrattoAssunzione(59, aziendaData)}</p>
        <p className="mt-4">{paragrafoOriginaleContrattoAssunzione(61)}</p>
        <p className="mt-6">{paragrafoOriginaleContrattoAssunzione(64)} <span>{paragrafoOriginaleContrattoAssunzione(65)}</span></p>
      </section>

      {(includeRegolamento || formData.allegaRegolamento === true) && <RegolamentoInterno formData={formData} azienda={aziendaData} />}
    </article>
  </div>;
}
