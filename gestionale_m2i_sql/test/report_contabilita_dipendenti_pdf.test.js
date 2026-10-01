const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pdfParse = require('pdf-parse');
const { buildReportContabilitaDipendentiPDF } = require('../report_contabilita_dipendenti_pdf');

test('il report stipendi mostra prima i pagati e poi i dipendenti da pagare', async () => {
  const rows = [
    {
      idDipendente: 'D1', cognomeNome: 'ROSSI MARIA', oreLavorate: 120, pagaOraria: 8,
      tipoPaga: 'Oraria', pagaLavorato: 960, pagaFPM: 32, dettaglioFPM: { Ferie: 4 },
      maggiorazioni: 20, detrazioni: 12, stipendioNetto: 1000, iban: 'IT00TEST0001',
      nettoBusta: 995.5, notaFissa: 'Nota pagato', pagamento: { importo: 1000, pagatoAt: '2026-09-30T10:00:00Z' }
    },
    {
      idDipendente: 'D2', cognomeNome: 'BIANCHI LUCA', oreLavorate: 100, pagaOraria: 8,
      tipoPaga: 'Oraria', pagaLavorato: 800, pagaFPM: 0, maggiorazioni: 0,
      detrazioni: 0, stipendioNetto: 800, iban: 'IT00TEST0002', notaMensile: 'Nota da pagare', pagamento: null
    }
  ];
  for (let index = 3; index <= 16; index++) rows.push({
    idDipendente: `D${index}`, cognomeNome: `DIPENDENTE PROVA ${index}`, oreLavorate: 80,
    pagaOraria: 8, tipoPaga: 'Oraria', pagaLavorato: 640, pagaFPM: 0,
    maggiorazioni: 0, detrazioni: 0, stipendioNetto: 640, pagamento: null
  });
  const buffer = await buildReportContabilitaDipendentiPDF(rows, 9, 2026, 20).getBuffer();
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  const parsed = await pdfParse(buffer);
  const text = parsed.text.replace(/\s+/g, ' ');
  for (const label of ['STIPENDI DIPENDENTI', 'Settembre 2026', '16/20 dipendenti', 'PAGATI', 'DA PAGARE', 'DIPENDENTI PAGATI', 'DIPENDENTI DA PAGARE', 'Netto da elaborato', 'Netto busta', '995,50', 'Non caricata', 'ROSSI MARIA', 'BIANCHI LUCA', 'DIPENDENTE PROVA 16', 'IT00TEST0001', 'Nota da pagare']) {
    assert.ok(text.includes(label), `Testo assente nel PDF: ${label}`);
  }
  assert.ok(text.indexOf('DIPENDENTI PAGATI') < text.indexOf('DIPENDENTI DA PAGARE'));
  assert.ok(parsed.numpages >= 2);
  if (process.env.PDF_CONTABILITA_DIPENDENTI_PREVIEW_PATH) fs.writeFileSync(process.env.PDF_CONTABILITA_DIPENDENTI_PREVIEW_PATH, buffer);
});
