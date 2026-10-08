function calcolaImportiFatturaCliente(imponibile, tipoTassazione, percentualeTassazione) {
  const regime = String(tipoTassazione || 'IVA').trim().toUpperCase();
  if (regime === 'REVERSE CHARGE') {
    return { importoIva: 0, importoRitenuta: 0, importoTotale: imponibile };
  }
  if (regime === 'TRAT. ACC.' || regime === 'TRATTENUTA ACCONTO') {
    const imponibileCent = Math.round(Number(imponibile) * 100);
    const ivaCent = Math.round(imponibileCent * 0.22);
    const ritenutaCent = Math.round(imponibileCent * 0.04);
    return { importoIva: ivaCent / 100, importoRitenuta: ritenutaCent / 100,
      importoTotale: (imponibileCent + ivaCent - ritenutaCent) / 100 };
  }
  const aliquota = Number(percentualeTassazione) > 0 ? Number(percentualeTassazione) : 22;
  const importoIva = Number(imponibile) * aliquota / 100;
  return { importoIva, importoRitenuta: 0, importoTotale: Number(imponibile) + importoIva };
}

function calcolaValoriContabilitaCliente(row, costoPersonale) {
  const imponibile = Number(row.imponibile) || 0;
  const totale = Number(row.importoTotale) || 0;
  const costo = Number(costoPersonale) || 0;
  const importoTassa = Number((totale - imponibile).toFixed(2));
  const regime = String(row.tipoTassazione || 'IVA').trim().toUpperCase();
  const aliquotaImpostata = Number(row.percentualeTassazione) || 0;
  const percentualeTassaEffettiva = imponibile
    ? Number((importoTassa / imponibile * 100).toFixed(2))
    : regime === 'REVERSE CHARGE' ? 0 : ['TRAT. ACC.', 'TRATTENUTA ACCONTO'].includes(regime) ? 18
      : (regime === 'IVA' ? (aliquotaImpostata > 0 ? aliquotaImpostata : 22) : aliquotaImpostata);
  return {
    importoTassa,
    percentualeTassaEffettiva,
    costoPersonale: costo,
    residuoSenzaStipendi: Number((totale - costo).toFixed(2))
  };
}

module.exports = { calcolaImportiFatturaCliente, calcolaValoriContabilitaCliente };
