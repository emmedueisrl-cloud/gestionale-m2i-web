import React from 'react';

export default function ModuloRiconsegnaCliente({ clienteData, aziendaData, infoRiconsegna }) {
  if (!clienteData) return null;

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day} / ${month} / ${year}`;
  };

  const todayStr = formatDate(new Date().toISOString());
  const dataRiconsegna = infoRiconsegna?.dataRestituzione ? formatDate(infoRiconsegna.dataRestituzione) : todayStr;

  return (
    <div className="print-only bg-white text-black p-8 max-w-4xl mx-auto min-h-screen text-[15px] leading-relaxed relative">
      <h1 className="text-center font-bold text-xl mb-8 uppercase border-b-2 border-black pb-4">
        VERBALE DI RICONSEGNA CHIAVI AL CLIENTE
      </h1>

      <div className="flex justify-between mb-8">
        <div>
          <p><strong>Da:</strong></p>
          <p>{aziendaData?.ragione_sociale || 'M2I S.R.L.'}</p>
          <p>{aziendaData?.sede_legale}</p>
          <p>P.IVA: {aziendaData?.partita_iva}</p>
        </div>
        <div className="text-right">
          <p><strong>In data:</strong> {dataRiconsegna}</p>
        </div>
      </div>

      <p className="mb-6">
        Con la presente, la società {aziendaData?.ragione_sociale || 'M2I S.R.L.'} dichiara di <strong>riconsegnare</strong> in via definitiva al cliente:
      </p>

      <div className="mb-6 space-y-2 p-4 bg-gray-50 border border-gray-300 rounded">
        <p><strong>Cliente/Condominio:</strong> {clienteData.ragioneSociale || clienteData.ragione_sociale || '________________________________________'}</p>
        <p><strong>Indirizzo sede:</strong> {clienteData.indirizzoSede || clienteData.indirizzo_sede || '____________________________________'}</p>
      </div>

      <p className="mb-6">
        le chiavi (Copia N. <strong>{infoRiconsegna?.numCopia || '___'}</strong>) relative al seguente immobile/cantiere:
      </p>

      <div className="mb-8 space-y-2">
        <p><strong>Indirizzo immobile:</strong> {clienteData.indirizzoSede || clienteData.indirizzo_sede || '____________________________________'}</p>
      </div>

      <p className="mb-8">
        La riconsegna avviene a seguito della conclusione dell'appalto o su richiesta del Cliente. Con la sottoscrizione del presente verbale, il Cliente conferma di aver ricevuto le chiavi in oggetto e solleva M2I S.R.L. da ogni responsabilità relativa alla loro futura custodia o al loro utilizzo.
      </p>

      {infoRiconsegna?.note && (
        <div className="mb-8 p-4 border border-dashed border-gray-400">
          <p><strong>Note aggiuntive:</strong> {infoRiconsegna.note}</p>
        </div>
      )}

      <div className="flex justify-between mt-24 pt-8">
        <div className="text-center w-1/3 relative">
          <p className="mb-16 font-bold">Per {aziendaData?.ragione_sociale || 'M2I S.R.L.'} (Consegnatario)</p>
          
          <div className="absolute top-8 left-1/2 -translate-x-1/2 opacity-90 mix-blend-multiply flex items-center justify-center h-24">
            <img src="/timbro.png" alt="Timbro" className="max-h-24 max-w-full" />
          </div>
          
          <p className="text-sm border-t border-black pt-2 w-48 mx-auto">(Timbro e Firma)</p>
        </div>
        
        <div className="text-center w-1/3">
          <p className="mb-16 font-bold">Il Cliente (Ricevente)</p>
          <p className="mb-8 text-white">_</p>
          <p className="text-sm border-t border-black pt-2 w-48 mx-auto">(Timbro e Firma)</p>
        </div>
      </div>
    </div>
  );
}
