const test = require('node:test');
const assert = require('node:assert/strict');
const pdfParse = require('pdf-parse');
const { buildReportProvvigioniOperatoriPDF } = require('../report_provvigioni_operatori_pdf');

test('il report provvigioni mostra riepilogo e dettagli espansi degli operatori', async () => {
  const doc = buildReportProvvigioniOperatoriPDF([{
    operatore: 'Mario Rossi',
    fatturatoTotale: 301,
    provvigioneTotale: 25,
    clienti: [
      { cliente_id: '1', ragioneSociale: 'CLIENTE UNO', fatturato: 100, provvigione: 5 },
      { cliente_id: '2', ragioneSociale: 'CLIENTE DUE', fatturato: 201, provvigione: 20 }
    ]
  }], 9, 2026);

  const parsed = await pdfParse(await doc.getBuffer());
  for (const testo of [
    'RIEPILOGO PROVVIGIONI OPERATORI', 'SETTEMBRE 2026', 'Mario Rossi',
    'CLIENTE UNO', 'CLIENTE DUE', 'Fatturato imponibile', 'Provvigione'
  ]) assert.match(parsed.text, new RegExp(testo, 'i'));
});
