import React from 'react';
import RegolamentoInterno from './RegolamentoInterno';

export default function PrintableContrattoAssunzione({ formData, aziendaData }) {
  if (!formData) return null;

  const formattaData = (dataStr) => {
    if (!dataStr) return '_____ / _____ / __________';
    const [year, month, day] = dataStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const isMaschio = formData.sesso === 'M';
  const appellativo = isMaschio ? 'Gentile Sig.' : 'Gentile Sig.ra';
  const assunto = isMaschio ? 'assunto' : 'assunta';
  const obbligato = isMaschio ? 'obbligato' : 'obbligata';
  const autorizzato = isMaschio ? 'autorizzato' : 'autorizzata';

  const timbroUrl = aziendaData?.timbro_path ? `/${aziendaData.timbro_path.replace(/\\/g, '/')}` : null;

  return (
    <div id="contratto-assunzione-pdf" className="print-only bg-white text-black p-10 max-w-4xl mx-auto min-h-screen text-[14px] leading-relaxed font-sans relative">
      
      {/* Intestazione Azienda (Sinistra) e Dipendente (Destra) */}
      <div className="flex justify-between items-start mb-12">
        <div className="font-bold">
          <p>{aziendaData?.ragione_sociale || 'M2I S.R.L.'}</p>
          <p>{aziendaData?.sede_legale || 'VIA DEL FONTANILE ANAGNINO 183'}</p>
          <p>00118 - Roma</p>
        </div>
        <div className="text-right max-w-xs">
          <p>{appellativo}</p>
          <p className="font-bold uppercase">{formData.cognome} {formData.nome}</p>
          <p className="uppercase">{formData.indirizzo}</p>
          {(formData.cap || formData.citta || formData.provincia) && (
            <p className="uppercase">{formData.cap} - {formData.citta} - ({formData.provincia})</p>
          )}
        </div>
      </div>

      <p className="mb-6">
        Siamo lieti di comunicarLe che Lei è stato {assunto} alle nostre dipendenze dal giorno {formattaData(formData.dataInizio)} alle seguenti condizioni:
      </p>

      {/* Condizioni */}
      <div className="space-y-4 mb-8">
        <div>
          <span className="font-bold">DURATA DEL LAVORO:</span> {
            formData.tipoContratto === 'Indeterminato' 
            ? 'tempo indeterminato' 
            : `tempo determinato fino al ${formattaData(formData.dataFine)} . ai sensi del D.Lgs. n. 81 del 15/06/2015 e art. 17 D.L. 22 marzo 2021 n. 41;`
          }
        </div>

        <div>
          <p className="font-bold">QUALIFICA, MANSIONI E CATEGORIA:</p>
          <p>La Sua qualifica sarà di {formData.qualifica};</p>
          <p>Per le mansioni di {formData.mansioni};</p>
          <p>Il Suo livello, pertanto, sarà il {formData.livelloCCNL};</p>
        </div>

        <div>
          <p className="font-bold">ORARIO E RETRIBUZIONE:</p>
          <p>L’orario stabilito è di {formData.oreSettimanali}.</p>
        </div>

        <div>
          <p className="font-bold">POSIZIONI ASSICURATIVE:</p>
          <p>La posizione INAIL: 9603947533</p>
          <p>La posizione INPS: 707349806210</p>
        </div>

        <div>
          <p className="font-bold">PERIODO DI PROVA:</p>
          <p>Il periodo di prova avrà la durata di {formData.periodoProva} giorni di lavoro effettivo.</p>
        </div>

        <div>
          <p className="font-bold">RETRIBUZIONE:</p>
          <p>La sua retribuzione sarà quella prevista dal {formData.livelloCCNL.includes('C.C.N.L.') ? formData.livelloCCNL.split(' ').slice(1).join(' ') : 'C.C.N.L. Pulizie'};</p>
        </div>

        <div>
          <p className="font-bold">SEDE:</p>
          <p>La sede dell’attività è sita in {aziendaData?.sede_legale || 'Via del fontanile anagnino 183'}– Roma, il datore di lavoro si riserva il diritto di affidarle per motivi inerentiall’attività lavorativa compiti o mansioni anche fuori sede.</p>
        </div>

        <div>
          <p className="font-bold">REGOLAMENTO ED USI DELLA AZIENDA:</p>
          <p>dovrà tenersi al regolamento, disposizione ed usi della società, i quali tutti si intendano da Lei conosciuti ed accettati, qualora non abbia avanzato eccezioni per iscritto entro la scadenza del periodo di prova.</p>
        </div>
      </div>

      {/* Firme 1 */}
      <div className="flex justify-between items-end mb-8 mt-12">
        <p>Roma, lì {formattaData(formData.dataFirma)}</p>
        <div className="text-center w-64 relative flex flex-col items-center">
          <p className="font-bold mb-2">DATORE DI LAVORO</p>
          {timbroUrl ? (
            <img src={timbroUrl} alt="Timbro" className="h-20 object-contain mb-2 mix-blend-multiply" />
          ) : (
            <p className="mb-8 mt-4 text-slate-500">Timbro e Firma Soc.</p>
          )}
          <div className="border-b border-black w-full"></div>
        </div>
      </div>

      <hr className="border-t border-black my-8" />

      {/* Trattamento Dati */}
      <div className="mb-8 text-[13px] text-justify">
        <p className="font-bold mb-2 text-[14px]">TRATTAMENTO DEI DATI PERSONALI:</p>
        <p>Per l’instaurazione e l’esecuzione del rapporto di lavoro regolato dal presente contratto, la Società acquisisce e tratta i Suoi dati personali, conformemente a quanto previsto dal Regolamento UE 2016/679 e dalla normativa nazionale vigente, compresi eventuali provvedimenti emanati dall'Autorità di Controllo, ove applicabili, nonché allo Statuto dei Lavoratori (L. 300/1970), come da Informativa sul trattamento dei dati personali allegata.</p>
        <p>In virtù del presente contratto, Lei è altresì {obbligato} a prestare la Sua attività nel rispetto delle istruzioni impartite ai sensi dell’art. 29 Regolamento UE 2016/679 sul trattamento dei dati personali per il quale è {autorizzato} dalla scrivente (come da documento allegato per il conferimento dell'autorizzazione al trattamento dei dati personali ed individuazione dell'ambito del trattamento consentito, ai sensi del Regolamento UE 2016/679).</p>
      </div>

      {/* Firme 2 */}
      <div className="flex justify-end mb-8">
        <div className="text-center w-64 relative flex flex-col items-center">
          <p className="font-bold mb-2">DATORE DI LAVORO</p>
          {timbroUrl ? (
            <img src={timbroUrl} alt="Timbro" className="h-20 object-contain mb-2 mix-blend-multiply" />
          ) : (
            <p className="mb-8 mt-4 text-slate-500">Timbro e Firma Soc.</p>
          )}
          <div className="border-b border-black w-full"></div>
        </div>
      </div>

      <hr className="border-t border-black my-8" />

      {/* Accettazione */}
      <div className="mb-16">
        <p className="font-bold mb-2">ACCETTAZIONE</p>
        <p className="text-justify mb-8">Accuso ricevuta della lettera di assunzione conforme alla copia riportata e l’accetto in ogni sua parte. Dichiaro inoltre di essere a perfetta conoscenza delle norme disciplinari relative alle infrazioni, alla procedura di contestazione ed alle sanzioni contenute nel Codice civile e nella Legge 300/1970 art.7 e nel contratto collettivo.</p>
        <div className="flex items-end mt-12">
          <span className="mr-2">Firma</span>
          <div className="border-b border-black flex-grow border-dotted"></div>
        </div>
      </div>

      <RegolamentoInterno dataFirma={formattaData(formData.dataFirma)} />

    </div>
  );
}
