import React from 'react';
import { companyStampUrl } from '../../utils/companyStampUrl';
import { nomeM2i, sedeM2i } from '../../utils/datiM2iDocumento';

export default function PrintableModuloChiavi({ formData, dipendenteData, aziendaData, indirizzoStampa, cittaStampa }) {
  if (!formData || !dipendenteData) return null;
  const timbroUrl = companyStampUrl(aziendaData?.timbro_path);
  const logoUrl = companyStampUrl(aziendaData?.logo_path);

  const formattaData = (dataStr) => {
    if (!dataStr) return '_____ / _____ / __________';
    const [year, month, day] = dataStr.split('-');
    return `${day} / ${month} / ${year}`;
  };

  return (
    <div className="print-only w-full bg-white font-sans text-slate-950">
      <style>{'@page { size: A4; margin: 8mm; @bottom-right { content: counter(page) "/" counter(pages); font: 10px Arial, sans-serif; color: #334155; } }'}</style>
      <article className="mx-auto w-full max-w-[190mm] px-6 py-5 text-[13px] leading-[1.5] print:max-w-none print:px-[2mm] print:py-[4mm]">
      <div className="flex items-start gap-3 border-b-2 border-blue-800 pb-2 text-slate-700">
        {logoUrl && <img src={logoUrl} alt="Logo M2I" className="max-h-12 max-w-28 shrink-0 object-contain" />}
        <div className="min-w-0 text-[10px] leading-[1.25]">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.05em] text-slate-950">{nomeM2i(aziendaData)}</h2>
          <p>Sede Legale: {sedeM2i(aziendaData)}</p>
          <p>P.IVA: {aziendaData?.partita_iva || ''} - C.F.: {aziendaData?.codice_fiscale || ''}</p>
        </div>
      </div>

      <h1 className="mt-6 text-center text-xl font-bold uppercase tracking-tight text-slate-950">
        VERBALE DI AFFIDAMENTO CHIAVI AL DIPENDENTE
      </h1>

      <p className="mt-6">
        <strong>In data:</strong> {formattaData(formData.dataVerbale)}
      </p>

      <p className="mt-4">
        La società <strong>{nomeM2i(aziendaData)}</strong>, con sede in {sedeM2i(aziendaData)}, affida al proprio dipendente:
      </p>

      <div className="mt-3 space-y-1 border-y border-slate-300 py-3">
        <p><strong>Nome e Cognome:</strong> {dipendenteData.nomeCompleto || `${dipendenteData.nome || ''} ${dipendenteData.cognome || ''}`.trim()}</p>
        <p><strong>Codice Fiscale:</strong> {dipendenteData.codice_fiscale || dipendenteData.codiceFiscale || '________________________________________'}</p>
        <p><strong>Qualifica/Mansione:</strong> {dipendenteData.mansione || dipendenteData.qualifica || '________________________________________'}</p>
      </div>

      <p className="mt-4">
        le chiavi relative al seguente immobile del cliente:
      </p>

      <div className="mt-3 space-y-1">
        <p><strong>Cliente:</strong> {formData.clienteNome}</p>
        <p><strong>Indirizzo dell'immobile:</strong> {indirizzoStampa ? (indirizzoStampa + (cittaStampa ? ` - ${cittaStampa}` : '')) : '____________________________________'}</p>
      </div>

      <p className="mt-4">
        per consentire l'accesso ai locali esclusivamente ai fini dello svolgimento delle attività lavorative affidate.
      </p>

      <h2 className="mt-6 border-b border-blue-800 pb-1 text-[15px] font-bold text-blue-800 print:break-after-avoid">Dichiarazione del dipendente</h2>
      
      <p className="mt-3">
        Il sottoscritto dichiara di aver ricevuto le chiavi sopra indicate e si impegna a:
      </p>
      
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li>custodirle con la massima diligenza, evitando qualsiasi uso improprio;</li>
        <li>utilizzare le chiavi esclusivamente per l'esecuzione delle attività lavorative autorizzate dalla {nomeM2i(aziendaData)};</li>
        <li>non duplicare le chiavi né consegnarle o consentirne l'utilizzo a persone non autorizzate;</li>
        <li>non lasciare le chiavi incustodite o in luoghi accessibili a terzi;</li>
        <li>comunicare immediatamente alla Direzione della {nomeM2i(aziendaData)} l'eventuale smarrimento, furto o danneggiamento delle chiavi;</li>
        <li>restituire immediatamente tutte le chiavi ricevute alla {nomeM2i(aziendaData)} alla cessazione del rapporto di lavoro, al cambio di mansione o su semplice richiesta dell'azienda.</li>
      </ul>

      <p className="mt-4 text-justify">
        Il dipendente prende atto che le chiavi affidategli costituiscono beni aziendali ricevuti in custodia e che eventuali utilizzi non autorizzati, omissioni nella custodia o comportamenti negligenti potranno comportare responsabilità disciplinari e, ove previsto dalla legge, civili e patrimcolare.
      </p>

      <section className="print:break-before-page">
      <h2 className="mt-6 border-b border-blue-800 pb-1 text-[15px] font-bold text-blue-800 print:break-after-avoid">Materiale consegnato</h2>
      <table className="mt-3 w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-slate-100">
            <th className="w-2/3 border border-slate-300 px-3 py-1.5 text-left">Descrizione</th>
            <th className="w-1/3 border border-slate-300 px-3 py-1.5 text-center">Quantità</th>
          </tr>
        </thead>
        <tbody>
          <tr className="break-inside-avoid">
            <td className="border border-slate-300 px-3 py-1">Chiavi portone</td>
            <td className="border border-slate-300 px-3 py-1 text-center">{formData.chiaviPortone || '_____'}</td>
          </tr>
          <tr className="break-inside-avoid">
            <td className="border border-slate-300 px-3 py-1">Chiavi ingresso</td>
            <td className="border border-slate-300 px-3 py-1 text-center">{formData.chiaviIngresso || '_____'}</td>
          </tr>
          <tr className="break-inside-avoid">
            <td className="border border-slate-300 px-3 py-1">Chiavi cancello</td>
            <td className="border border-slate-300 px-3 py-1 text-center">{formData.chiaviCancello || '_____'}</td>
          </tr>
          <tr className="break-inside-avoid">
            <td className="border border-slate-300 px-3 py-1">Badge</td>
            <td className="border border-slate-300 px-3 py-1 text-center">{formData.badge || '_____'}</td>
          </tr>
          <tr className="break-inside-avoid">
            <td className="border border-slate-300 px-3 py-1">Telecomando</td>
            <td className="border border-slate-300 px-3 py-1 text-center">{formData.telecomando || '_____'}</td>
          </tr>
          <tr className="break-inside-avoid">
            <td className="border border-slate-300 px-3 py-1">Altro</td>
            <td className="border border-slate-300 px-3 py-1 text-center">{formData.altro || '__________________'}</td>
          </tr>
        </tbody>
      </table>

      {formData.note && (
        <div className="mt-5 break-inside-avoid text-justify">
          <h2 className="border-b border-blue-800 pb-1 text-[15px] font-bold text-blue-800">Note / Ulteriori Dettagli</h2>
          <p className="mt-2 whitespace-pre-wrap">{formData.note}</p>
        </div>
      )}

      <div className="mt-7 flex break-inside-avoid items-end justify-between gap-4 border-t border-slate-300 pt-5 text-[12px]">
        <div className="order-2 w-[60mm] max-w-[48%] text-center">
          <p className="font-bold">Per {nomeM2i(aziendaData)}</p>
          <div className="flex h-[27mm] items-center justify-center">
            {timbroUrl && <img src={timbroUrl} alt="Timbro Aziendale" className="max-h-[27mm] max-w-[60mm] object-contain" />}
          </div>
          <p className="border-t border-slate-500 pt-1">(Nome e Cognome)</p>
          <p className="mt-2 border-t border-slate-500 pt-1">Firma</p>
        </div>
        <div className="order-1 w-[65mm] max-w-[48%]">
          <p>Per ricevuta</p>
          <p className="mt-1 font-bold">Il Dipendente</p>
          <p className="mt-1">{dipendenteData.nome} {dipendenteData.cognome}</p>
          <p className="mt-[27mm] border-t border-slate-500 pt-1">Firma</p>
        </div>
      </div>
      </section>
      </article>
    </div>
  );
}
