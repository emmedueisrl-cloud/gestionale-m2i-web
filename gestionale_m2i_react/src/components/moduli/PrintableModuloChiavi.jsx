import React from 'react';

export default function PrintableModuloChiavi({ formData, dipendenteData, aziendaData, indirizzoStampa, cittaStampa }) {
  if (!formData || !dipendenteData) return null;

  const formattaData = (dataStr) => {
    if (!dataStr) return '_____ / _____ / __________';
    const [year, month, day] = dataStr.split('-');
    return `${day} / ${month} / ${year}`;
  };

  return (
    <div className="print-only bg-white text-black p-8 max-w-4xl mx-auto min-h-screen text-[15px] leading-relaxed relative">
      <div className="flex flex-col items-center mb-6 border-b border-black pb-4">
        <h2 className="font-bold text-xl">{aziendaData?.ragione_sociale || 'M2I S.R.L.'}</h2>
        <p className="text-sm">Sede Legale: {aziendaData?.sede_legale || 'ROMA (RM) VIA DEL FONTANILE ANAGNINO 183 CAP 00118 C/O ST.COMM.DOT. CECCONI MARCO'}</p>
        <p className="text-sm">P.IVA: {aziendaData?.partita_iva || '15989811003'} - C.F.: {aziendaData?.codice_fiscale || '15989811003'}</p>
      </div>

      <h1 className="text-center font-bold text-xl mb-8 uppercase">
        VERBALE DI AFFIDAMENTO CHIAVI AL DIPENDENTE
      </h1>

      <p className="mb-6">
        <strong>In data:</strong> {formattaData(formData.dataVerbale)}
      </p>

      <p className="mb-6">
        La società <strong>{aziendaData?.ragione_sociale || 'M2I S.R.L.'}</strong>, con sede in {aziendaData?.sede_legale || 'ROMA (RM) VIA DEL FONTANILE ANAGNINO 183 CAP 00118 C/O ST.COMM.DOT. CECCONI MARCO'}, affida al proprio dipendente:
      </p>

      <div className="mb-6 space-y-2">
        <p><strong>Nome e Cognome:</strong> {dipendenteData.nome} {dipendenteData.cognome}</p>
        <p><strong>Codice Fiscale:</strong> {dipendenteData.codice_fiscale || '________________________________________'}</p>
        <p><strong>Qualifica/Mansione:</strong> {dipendenteData.qualifica || dipendenteData.mansione || '________________________________________'}</p>
      </div>

      <p className="mb-6">
        le chiavi relative al seguente immobile del cliente:
      </p>

      <div className="mb-6 space-y-2">
        <p><strong>Cliente:</strong> {formData.clienteNome}</p>
        <p><strong>Indirizzo dell'immobile:</strong> {indirizzoStampa ? (indirizzoStampa + (cittaStampa ? ` - ${cittaStampa}` : '')) : '____________________________________'}</p>
      </div>

      <p className="mb-8">
        per consentire l'accesso ai locali esclusivamente ai fini dello svolgimento delle attività lavorative affidate.
      </p>

      <h2 className="font-bold text-lg mb-4">Dichiarazione del dipendente</h2>
      
      <p className="mb-4">
        Il sottoscritto dichiara di aver ricevuto le chiavi sopra indicate e si impegna a:
      </p>
      
      <ul className="list-disc pl-8 mb-6 space-y-2">
        <li>custodirle con la massima diligenza, evitando qualsiasi uso improprio;</li>
        <li>utilizzare le chiavi esclusivamente per l'esecuzione delle attività lavorative autorizzate dalla M2I S.R.L.;</li>
        <li>non duplicare le chiavi né consegnarle o consentirne l'utilizzo a persone non autorizzate;</li>
        <li>non lasciare le chiavi incustodite o in luoghi accessibili a terzi;</li>
        <li>comunicare immediatamente alla Direzione della M2I S.R.L. l'eventuale smarrimento, furto o danneggiamento delle chiavi;</li>
        <li>restituire immediatamente tutte le chiavi ricevute alla M2I S.R.L. alla cessazione del rapporto di lavoro, al cambio di mansione o su semplice richiesta dell'azienda.</li>
      </ul>

      <p className="mb-8 text-justify">
        Il dipendente prende atto che le chiavi affidategli costituiscono beni aziendali ricevuti in custodia e che eventuali utilizzi non autorizzati, omissioni nella custodia o comportamenti negligenti potranno comportare responsabilità disciplinari e, ove previsto dalla legge, civili e patrimcolare.
      </p>

      <h2 className="font-bold text-lg mb-4">Materiale consegnato</h2>
      <table className="w-full mb-12 border-collapse border border-black">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-2 text-left w-2/3">Descrizione</th>
            <th className="border border-black p-2 text-center w-1/3">Quantità</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-2">Chiavi portone</td>
            <td className="border border-black p-2 text-center">{formData.chiaviPortone || '_____'}</td>
          </tr>
          <tr>
            <td className="border border-black p-2">Chiavi ingresso</td>
            <td className="border border-black p-2 text-center">{formData.chiaviIngresso || '_____'}</td>
          </tr>
          <tr>
            <td className="border border-black p-2">Chiavi cancello</td>
            <td className="border border-black p-2 text-center">{formData.chiaviCancello || '_____'}</td>
          </tr>
          <tr>
            <td className="border border-black p-2">Badge</td>
            <td className="border border-black p-2 text-center">{formData.badge || '_____'}</td>
          </tr>
          <tr>
            <td className="border border-black p-2">Telecomando</td>
            <td className="border border-black p-2 text-center">{formData.telecomando || '_____'}</td>
          </tr>
          <tr>
            <td className="border border-black p-2">Altro</td>
            <td className="border border-black p-2 text-center">{formData.altro || '__________________'}</td>
          </tr>
        </tbody>
      </table>

      {formData.note && (
        <div className="mb-12 text-justify">
          <h2 className="font-bold text-lg mb-2">Note / Ulteriori Dettagli</h2>
          <p className="whitespace-pre-wrap">{formData.note}</p>
        </div>
      )}

      <div className="flex justify-between mt-16 pt-8">
        <div className="text-center w-1/3 relative">
          <p className="mb-2 font-bold">Per {aziendaData?.ragione_sociale || 'M2I S.R.L.'}</p>
          <div className="h-24 flex items-center justify-center">
            <img src="/timbro.png" alt="Timbro Aziendale" className="max-h-24 max-w-full mix-blend-multiply opacity-90" />
          </div>
          <p className="text-sm border-t border-black pt-1">(Nome e Cognome)</p>
          <p className="mt-8 border-t border-black pt-2">Firma</p>
        </div>
        <div className="text-center w-1/3">
          <p className="mb-8">Per ricevuta</p>
          <p className="mb-8 font-bold">Il Dipendente</p>
          <p className="mb-8">{dipendenteData.nome} {dipendenteData.cognome}</p>
          <p className="mt-8 border-t border-black pt-2">Firma</p>
        </div>
      </div>
    </div>
  );
}
