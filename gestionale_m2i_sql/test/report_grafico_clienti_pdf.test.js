const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pdfParse = require('pdf-parse');
const { buildReportGraficoClientiPDF } = require('../pdf_generator');

test('il report grafico clienti include importi, regime e note su più pagine', async () => {
  const righe = Array.from({ length: 14 }, (_, indice) => ({
    ragioneSociale: indice === 0 ? 'ASSOCIAZIONE CLIENTE CON RAGIONE SOCIALE PARTICOLARMENTE LUNGA' : `CLIENTE PROVA ${indice + 1}`,
    oreLavorate: 12.5,
    tariffaOraria: 16,
    baseImponibile: 200,
    maggiorazioni: indice === 0 ? 20 : 0,
    sconti: indice === 0 ? 5 : 0,
    imponibile: indice === 0 ? 215 : 200,
    tipoTassazione: indice === 0 ? 'IVA' : 'REVERSE CHARGE',
    importoTotale: indice === 0 ? 262.3 : 200,
    importoRealmenteFatturato: indice === 0 ? 250 : 0,
    notaFissa: indice === 0 ? 'Servizi di pulizia, dicitura fissa in fattura' : '',
    notaMensile: indice === 0 ? 'Nota mensile con testo abbastanza lungo per verificare che rimanga leggibile' : '',
    noteMaggiorazioni: indice === 0 ? 'Supplemento festivo' : '',
    noteSconti: indice === 0 ? 'Sconto concordato' : ''
  }));
  const buffer = await buildReportGraficoClientiPDF(righe, 8, 2026).getBuffer();
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  const parsed = await pdfParse(buffer);
  assert.ok(parsed.numpages >= 3);
  const testo = parsed.text.replace(/\s+/g, ' ');
  for (const label of [
    'ELABORATO CLIENTI', 'Agosto 2026', 'Totale clienti', 'CLIENTE PROVA 14',
    'REVERSE CHARGE', '262,30', 'TOTALE REALMENTE FATTURATO', '250,00',
    '[FISSE] Servizi di pulizia', '[MESE] Nota mensile',
    '[M] Supplemento festivo', '[S] Sconto concordato'
  ]) {
    assert.ok(testo.includes(label), `Testo assente nel PDF: ${label}`);
  }
  assert.ok(!testo.includes('TOTALE BASE IMPONIBILE'));
  if (process.env.PDF_CLIENTI_PREVIEW_PATH) fs.writeFileSync(process.env.PDF_CLIENTI_PREVIEW_PATH, buffer);
});
