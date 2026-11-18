import React from 'react';
import RegolamentoInterno from './RegolamentoInterno';
import { companyStampUrl } from '../../utils/companyStampUrl';
import IntestazioneAziendaLettera from './IntestazioneAziendaLettera';

const formattaData = value => {
  if (!value) return '____ / ____ / ________';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

function Condizione({ numero, titolo, children, wide = false }) {
  return <section className={`break-inside-avoid border-b border-slate-200 py-2 ${wide ? 'sm:col-span-2' : ''}`}>
    <div className="mb-1 flex items-baseline gap-2">
      <span className="text-[11px] font-bold tabular-nums text-blue-700">{numero}</span>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700">{titolo}</h3>
    </div>
    <div className="pl-5 text-[12px] leading-[1.35] text-slate-900">{children}</div>
  </section>;
}

function FirmaDatore({ timbroUrl }) {
  return <div className="flex w-[60mm] min-h-[32mm] flex-col items-center justify-end text-center">
    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">Il datore di lavoro</p>
    {timbroUrl ? <img src={timbroUrl} alt="Timbro e firma M2I" className="max-h-[27mm] max-w-[60mm] object-contain" /> :
      <span className="block h-[27mm]" />}
    <div className="w-full border-b border-slate-500" />
  </div>;
}

export default function PrintableContrattoAssunzione({ formData, aziendaData, includeRegolamento = false, previewMode = false }) {
  if (!formData) return null;

  const maschio = formData.sesso === 'M';
  const assunto = maschio ? 'assunto' : 'assunta';
  const obbligato = maschio ? 'obbligato' : 'obbligata';
  const autorizzato = maschio ? 'autorizzato' : 'autorizzata';
  const timbroUrl = companyStampUrl(aziendaData?.timbro_path);
  const ccnlRetribuzione = formData.ccnlRetribuzione ||
    (String(formData.livelloCCNL || '').includes('C.C.N.L.')
      ? String(formData.livelloCCNL).split(' ').slice(1).join(' ') : 'C.C.N.L. Pulizie');
  const sede = formData.sedeLavoro || aziendaData?.sede_legale || 'Via del Fontanile Anagnino 183, Roma';

  return <div id={previewMode ? undefined : 'contratto-assunzione-pdf'}
    className={`${previewMode ? '' : 'print-only'} w-full bg-white font-sans text-slate-950`}>
    {!previewMode && <style>{'@page { size: A4; margin: 8mm; @bottom-right { content: counter(page) "/" counter(pages); font: 10px Arial, sans-serif; color: #334155; } }'}</style>}
    <article className="mx-auto w-full max-w-[190mm] px-6 py-5 print:max-w-none print:px-0 print:py-0">
      <IntestazioneAziendaLettera azienda={aziendaData} />

      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Rapporto di lavoro</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Lettera di assunzione</h1>
        </div>
        <p className="text-right text-[12px] text-slate-700">Roma, {formattaData(formData.dataFirma)}</p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-4 border-y border-slate-300 py-2 text-[12px] leading-[1.35]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Datore di lavoro</p>
          <p className="font-bold">{aziendaData?.ragione_sociale || 'M2I S.R.L.'}</p>
          <p>{aziendaData?.sede_legale || 'Via del Fontanile Anagnino 183, Roma'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Destinatario</p>
          <p className="font-bold uppercase">{formData.cognome} {formData.nome}</p>
          <p className="uppercase">{formData.indirizzo}</p>
          <p className="uppercase">{[formData.cap, formData.citta, formData.provincia ? `(${formData.provincia})` : ''].filter(Boolean).join(' ')}</p>
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-[1.4]">Gentile {maschio ? 'Sig.' : 'Sig.ra'} <strong>{formData.cognome} {formData.nome}</strong>,<br />
        siamo lieti di comunicarLe che Lei è {assunto} alle nostre dipendenze dal giorno <strong>{formattaData(formData.dataInizio)}</strong> alle seguenti condizioni.</p>

      <h2 className="mt-3 border-b border-blue-800 pb-1 text-[12px] font-bold uppercase tracking-[0.1em] text-blue-800">Condizioni del rapporto</h2>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Condizione numero="01" titolo="Durata del lavoro">
          {formData.tipoContratto === 'Indeterminato' ? 'Tempo indeterminato.' :
            <>Tempo determinato fino al <strong>{formattaData(formData.dataFine)}</strong>, ai sensi del D.Lgs. n. 81 del 15/06/2015 e art. 17 D.L. 22 marzo 2021 n. 41.</>}
        </Condizione>
        <Condizione numero="02" titolo="Qualifica, mansioni e categoria">
          Qualifica: <strong>{formData.qualifica}</strong>. Mansioni: <strong>{formData.mansioni}</strong>. Livello: <strong>{formData.livelloCCNL}</strong>.
        </Condizione>
        <Condizione numero="03" titolo="Orario e retribuzione">
          L’orario stabilito è di <strong>{formData.oreSettimanali}</strong>. La retribuzione sarà quella prevista dal {ccnlRetribuzione}.
        </Condizione>
        <Condizione numero="04" titolo="Posizioni assicurative">
          INAIL: <strong>{aziendaData?.posizione_inail || '________'}</strong><br />
          INPS: <strong>{aziendaData?.posizione_inps || '________'}</strong>
        </Condizione>
        <Condizione numero="05" titolo="Periodo di prova">
          Il periodo di prova avrà la durata di <strong>{formData.periodoProva}</strong> giorni di lavoro effettivo.
        </Condizione>
        <Condizione numero="06" titolo="Sede">
          La sede dell’attività è sita in <strong>{sede}</strong>. Il datore di lavoro si riserva il diritto di affidarle, per motivi inerenti all’attività lavorativa, compiti o mansioni anche fuori sede.
        </Condizione>
        <Condizione numero="07" titolo="Regolamento ed usi dell’azienda" wide>
          Dovrà attenersi al regolamento, alle disposizioni e agli usi della società, che si intendono conosciuti e accettati qualora non abbia avanzato eccezioni per iscritto entro la scadenza del periodo di prova.
        </Condizione>
      </div>

      <div className="mt-3 flex items-end justify-between gap-4 break-inside-avoid">
        <p className="text-[12px] text-slate-700">Roma, {formattaData(formData.dataFirma)}</p>
        <FirmaDatore timbroUrl={timbroUrl} />
      </div>

      <section className="mt-3 border-t border-slate-300 pt-2">
        <h2 className="mb-1 block text-[12px] font-bold uppercase tracking-[0.1em] text-blue-800">Trattamento dei dati personali</h2>
        <div className="space-y-1 text-[11px] leading-[1.35] text-slate-800">
          <p>Per l’instaurazione e l’esecuzione del rapporto di lavoro regolato dal presente contratto, la Società acquisisce e tratta i Suoi dati personali, conformemente a quanto previsto dal Regolamento UE 2016/679 e dalla normativa nazionale vigente, compresi eventuali provvedimenti emanati dall’Autorità di Controllo, ove applicabili, nonché allo Statuto dei Lavoratori (L. 300/1970), come da Informativa sul trattamento dei dati personali allegata.</p>
          <p>In virtù del presente contratto, Lei è altresì {obbligato} a prestare la Sua attività nel rispetto delle istruzioni impartite ai sensi dell’art. 29 Regolamento UE 2016/679 sul trattamento dei dati personali per il quale è {autorizzato} dalla scrivente (come da documento allegato per il conferimento dell’autorizzazione al trattamento dei dati personali ed individuazione dell’ambito del trattamento consentito, ai sensi del Regolamento UE 2016/679).</p>
        </div>
      </section>

      <section className="mt-2 grid break-inside-avoid grid-cols-[1fr_60mm] gap-4 border-t border-slate-300 pt-2">
        <div>
          <h2 className="text-[12px] font-bold uppercase tracking-[0.1em] text-blue-800">Accettazione del lavoratore</h2>
          <p className="mt-1 text-[11px] leading-[1.35] text-slate-800">Accuso ricevuta della lettera di assunzione conforme alla copia riportata e l’accetto in ogni sua parte. Dichiaro inoltre di essere a perfetta conoscenza delle norme disciplinari relative alle infrazioni, alla procedura di contestazione ed alle sanzioni contenute nel Codice civile e nella Legge 300/1970 art. 7 e nel contratto collettivo.</p>
          <div className="mt-3 flex items-end gap-3 text-[11px]"><span>Firma del lavoratore</span><span className="w-40 border-b border-slate-600" /></div>
        </div>
        <FirmaDatore timbroUrl={timbroUrl} />
      </section>

      {(includeRegolamento || formData.allegaRegolamento === true) && <RegolamentoInterno dataFirma={formattaData(formData.dataFirma)} />}
    </article>
  </div>;
}
