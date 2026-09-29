function calcolaValoriContabilitaCliente(row, costoPersonale) {
  const imponibile = Number(row.imponibile) || 0;
  const totale = Number(row.importoTotale) || 0;
  const costo = Number(costoPersonale) || 0;
  const importoTassa = Number((totale - imponibile).toFixed(2));
  const regime = String(row.tipoTassazione || 'IVA').trim().toUpperCase();
  const aliquotaImpostata = Number(row.percentualeTassazione) || 0;
  const percentualeTassaEffettiva = imponibile
    ? Number((importoTassa / imponibile * 100).toFixed(2))
    : regime === 'REVERSE CHARGE' ? 0 : (regime === 'IVA' ? (aliquotaImpostata > 0 ? aliquotaImpostata : 22) : aliquotaImpostata);
  return {
    importoTassa,
    percentualeTassaEffettiva,
    costoPersonale: costo,
    residuoSenzaStipendi: Number((totale - costo).toFixed(2))
  };
}

module.exports = { calcolaValoriContabilitaCliente };
