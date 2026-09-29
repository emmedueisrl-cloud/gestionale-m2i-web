const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pdfParse = require('pdf-parse');
const { buildReportGraficoDipendentiPDF } = require('../pdf_generator');

test('il report grafico include netto busta, assenze, note e dipendenti su più pagine', async () => {
  const righe = Array.from({ length: 14 }, (_, indice) => ({
    cognomeNome: `DIPENDENTE PROVA ${indice + 1}`,
    iban: `IT60X054281110100000012345${indice}`,
    oreLavorate: 26,
    pagaLavorato: 182,
    pagaFPM: indice === 0 ? 28 : 0,
    dettaglioFPM: indice === 0 ? { Malattia: 2, Permesso: 2 } : {},
    maggiorazioni: indice === 0 ? 5 : 0,
    detrazioni: indice === 0 ? 2 : 0,
    noteMaggiorazioni: indice === 0 ? 'Rimborso spese' : '',
    noteDetrazioni: indice === 0 ? 'Anticipo' : '',
    stipendioNetto: indice === 0 ? 210 : 182,
    nettoBusta: indice === 0 ? 205.5 : null,
    notaFissa: indice === 0 ? 'Nota fissa di esempio' : '',
    notaMensile: indice === 0 ? 'Nota del mese di esempio' : ''
  }));
  const buffer = await buildReportGraficoDipendentiPDF(righe, 9, 2026).getBuffer();
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  const parsed = await pdfParse(buffer);
  assert.equal(parsed.numpages, 3);
  const testo = parsed.text.replace(/\s+/g, ' ');
  for (const label of ['ELABORATO DIPENDENTI', 'Settembre 2026', 'Netto busta', '2.548,00', '205,50', 'Non disponibile', 'Malattia: 2,0 h', '[M] Rimborso spese', '[D] Anticipo', '[FISSE] Nota fissa di esempio', '[MESE] Nota del mese di esempio', 'DIPENDENTE PROVA 14']) {
    assert.ok(testo.includes(label), `Testo assente nel PDF: ${label}`);
  }
  if (process.env.PDF_PREVIEW_PATH) fs.writeFileSync(process.env.PDF_PREVIEW_PATH, buffer);
});
