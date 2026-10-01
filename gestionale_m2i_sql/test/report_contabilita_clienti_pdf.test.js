const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pdfParse = require('pdf-parse');
const { buildReportContabilitaClientiPDF } = require('../report_contabilita_clienti_pdf');

test('il report fatture clienti riprende le sezioni e i riepiloghi della pagina', async () => {
  const rows = Array.from({ length: 15 }, (_, index) => ({
    idCliente: `C${index}`,
    ragioneSociale: `CLIENTE DI PROVA ${index + 1}`,
    oreLavorate: 12.5,
    maggiorazioni: 15,
    sconti: 0,
    imponibile: 215,
    tipoTassazione: 'IVA',
    percentualeTassaEffettiva: 22,
    importoTassa: 47.3,
    importoTotale: 262.3,
    costoPersonale: 70,
    residuoSenzaStipendi: 192.3,
    tariffaOraria: 16,
    notaFissa: index === 1 ? 'Nota fissa di controllo' : '',
    fatturaInviataAt: index === 1 ? '2026-09-29T10:00:00Z' : null,
    fatture: index === 2 ? [{ numero: '2026/15', data: '2026-09-29', importo: 260 }] : []
  }));
  const buffer = await buildReportContabilitaClientiPDF(rows, 9, 2026, 7).getBuffer();
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  const parsed = await pdfParse(buffer);
  const text = parsed.text.replace(/\s+/g, ' ');
  for (const label of [
    'FATTURE CLIENTI', 'Settembre 2026', '15/7 clienti', 'DA ELABORARE',
    'FATTURE DA ELABORARE', 'FATTURE ELABORATE', 'CLIENTE DI PROVA 15',
    'FATTURA INVIATA', 'FATTURA REGISTRATA', 'Nota fissa di controllo', '2026/15'
  ]) assert.ok(text.includes(label), `Testo assente nel PDF: ${label}`);
  assert.ok(text.indexOf('FATTURE ELABORATE') < text.indexOf('FATTURE DA ELABORARE'));
  assert.ok(parsed.numpages >= 2);
  if (process.env.PDF_CONTABILITA_PREVIEW_PATH) fs.writeFileSync(process.env.PDF_CONTABILITA_PREVIEW_PATH, buffer);
});
