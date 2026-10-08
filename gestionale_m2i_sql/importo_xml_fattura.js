const asArray = value => value == null ? [] : Array.isArray(value) ? value : [value];
const cents = value => Math.round(Number(value) * 100);

function calcolaImportoXmlFattura(documento, corpo, imponibile, iva) {
  const lordo = documento?.ImportoTotaleDocumento == null || String(documento.ImportoTotaleDocumento).trim() === ''
    ? Number(imponibile) + Number(iva) : Number(documento.ImportoTotaleDocumento);
  if (!Number.isFinite(lordo)) throw new Error('Importo totale XML non valido.');

  const ritenute = asArray(documento?.DatiRitenuta);
  if (!ritenute.length) return { importoTotale: cents(lordo) / 100, importoLordo: cents(lordo) / 100,
    importoRitenuta: 0 };

  const ritenutaCent = ritenute.reduce((sum, ritenuta) => {
    const importo = Number(ritenuta?.ImportoRitenuta);
    if (!Number.isFinite(importo) || importo < 0) throw new Error('Ritenuta XML non valida.');
    return sum + cents(importo);
  }, 0);
  const pagamenti = asArray(corpo?.DatiPagamento)
    .flatMap(pagamento => asArray(pagamento?.DettaglioPagamento))
    .filter(dettaglio => dettaglio?.ImportoPagamento != null);
  const pagamentoCent = pagamenti.length ? pagamenti.reduce((sum, dettaglio) => {
    const importo = Number(dettaglio.ImportoPagamento);
    if (!Number.isFinite(importo) || importo < 0) throw new Error('Importo pagamento XML non valido.');
    return sum + cents(importo);
  }, 0) : null;
  const importoCent = pagamentoCent ?? cents(lordo) - ritenutaCent;
  if (importoCent < 0) throw new Error('Importo dopo ritenuta XML non valido.');
  return { importoTotale: importoCent / 100, importoLordo: cents(lordo) / 100,
    importoRitenuta: ritenutaCent / 100 };
}

module.exports = { calcolaImportoXmlFattura };
