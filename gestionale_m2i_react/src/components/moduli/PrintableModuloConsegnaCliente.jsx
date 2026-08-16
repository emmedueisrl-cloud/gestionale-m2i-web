import React from 'react';

export default function PrintableModuloConsegnaCliente({ clienteData, aziendaData, dataVerbale, note }) {
  if (!clienteData) return null;

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
        VERBALE DI CONSEGNA CHIAVI A {aziendaData?.ragione_sociale || 'M2I S.R.L.'}
      </h1>

      <p className="mb-6">
        <strong>In data:</strong> {formattaData(dataVerbale)}
      </p>

      <p className="mb-6">
        Il sottoscritto/a in qualità di legale rappresentante o referente per il cliente:
      </p>

      <div className="mb-6 space-y-2">
        <p><strong>Cliente/Condominio:</strong> {clienteData.ragioneSociale || clienteData.ragione_sociale || '________________________________________'}</p>
        <p><strong>P.IVA / C.F.:</strong> {clienteData.partitaIva || clienteData.partita_iva || clienteData.codiceFiscale || clienteData.codice_fiscale || '________________________________________'}</p>
      </div>

      <p className="mb-6">
        dichiara di consegnare alla società <strong>M2I S.R.L.</strong> le chiavi relative al seguente immobile/cantiere:
      </p>

      <div className="mb-6 space-y-2">
        <p><strong>Indirizzo immobile:</strong> {clienteData.indirizzoSede || clienteData.indirizzo_sede || '____________________________________'}</p>
        <p><strong>Città:</strong> {clienteData.citta || clienteData.citta_sede ? `${clienteData.citta || clienteData.citta_sede} (${clienteData.provincia || clienteData.provincia_sede || ''})` : '____________________________________'}</p>
      </div>

      <p className="mb-8">
        La consegna viene effettuata esclusivamente per consentire al personale incaricato dalla M2I S.R.L. l'accesso ai locali ai fini dello svolgimento dei servizi appaltati/affidati.
      </p>

      <h2 className="font-bold text-lg mb-4">Condizioni di custodia</h2>
      
      <p className="mb-4">
        Con la sottoscrizione del presente verbale, la M2I S.R.L. si impegna a:
      </p>
      
      <ul className="list-disc pl-8 mb-8 space-y-2">
        <li>Custodire le chiavi ricevute con la massima diligenza;</li>
        <li>Affidare le chiavi unicamente al proprio personale dipendente incaricato dell'esecuzione dei lavori;</li>
        <li>Non duplicare le chiavi senza esplicita autorizzazione scritta del Cliente;</li>
        <li>Non consentire l'utilizzo delle chiavi a persone non espressamente autorizzate;</li>
        <li>Comunicare tempestivamente al Cliente l'eventuale smarrimento o furto;</li>
        <li>Restituire le chiavi al termine dell'appalto o su semplice richiesta del Cliente.</li>
      </ul>

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
            <td className="border border-black p-2">Chiavi portone/ingresso</td>
            <td className="border border-black p-2 text-center">_____</td>
          </tr>
          <tr>
            <td className="border border-black p-2">Chiavi aree comuni/cancelli</td>
            <td className="border border-black p-2 text-center">_____</td>
          </tr>
          <tr>
            <td className="border border-black p-2">Chiavi locali specifici</td>
            <td className="border border-black p-2 text-center">_____</td>
          </tr>
          <tr>
            <td className="border border-black p-2">Badge / Telecomandi</td>
            <td className="border border-black p-2 text-center">_____</td>
          </tr>
          <tr>
            <td className="border border-black p-2">Altro: _________________________</td>
            <td className="border border-black p-2 text-center">_____</td>
          </tr>
        </tbody>
      </table>

      {note && (
        <div className="mb-12">
          <h3 className="font-bold mb-2">Note:</h3>
          <p className="border border-black p-4 min-h-[60px] whitespace-pre-wrap bg-gray-50">{note}</p>
        </div>
      )}

      <div className="flex justify-between mt-16 pt-8">
        <div className="text-center w-1/3">
          <p className="mb-8 font-bold">Il Cliente (Consegnatario)</p>
          <div className="h-24"></div>
          <p className="text-sm border-t border-black pt-1">(Timbro e Firma)</p>
        </div>
        <div className="text-center w-1/3 relative">
          <p className="mb-2 font-bold">Per {aziendaData?.ragione_sociale || 'M2I S.R.L.'} (Ricevente)</p>
          <div className="h-24 flex items-center justify-center">
            <img src="/timbro.png" alt="Timbro Aziendale" className="max-h-24 max-w-full mix-blend-multiply opacity-90" />
          </div>
          <p className="text-sm border-t border-black pt-1">(Timbro e Firma)</p>
        </div>
      </div>
    </div>
  );
}
