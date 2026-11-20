import test from 'node:test';
import assert from 'node:assert/strict';
import { titoloContrattoAssunzione, paragrafiContrattoAssunzione, segmentiContrattoAssunzione,
  paragrafoOriginaleContrattoAssunzione, segmentiRecapitiContrattoAssunzione } from './contrattoAssunzioneTesto.js';

test('il titolo segue durata e tipo orario UNILAV', () => {
  assert.equal(titoloContrattoAssunzione({ tipoContratto: 'Determinato', tipoOrario: 'P - TEMPO PARZIALE' }),
    'LETTERA DI ASSUNZIONE CON CONTRATTO A TEMPO DETERMINATO PART TIME');
  assert.equal(titoloContrattoAssunzione({ tipoContratto: 'Indeterminato', tipoOrario: 'F - TEMPO PIENO' }),
    'LETTERA DI ASSUNZIONE CON CONTRATTO A TEMPO INDETERMINATO TEMPO PIENO');
  assert.equal(titoloContrattoAssunzione({ tipoContratto: 'Determinato' }),
    'LETTERA DI ASSUNZIONE CON CONTRATTO A TEMPO DETERMINATO');
});

test('il testo usa codice UNILAV solo se disponibile', () => {
  const data = { sesso: 'F', dataInizio: '2026-11-19', dataFine: '2027-02-19', tipoContratto: 'Determinato' };
  assert.match(paragrafiContrattoAssunzione({ ...data, codiceComunicazione: '1234567890' })[1], /Unilav N\. 1234567890/);
  assert.doesNotMatch(paragrafiContrattoAssunzione(data)[1], /Unilav N\. 0000000000000000/);
});

test('i dati variabili sono marcati in grassetto senza cambiare il testo', () => {
  const data = { dataInizio: '2026-12-01', dataFine: '2027-03-31',
    tipoContratto: 'Determinato', oreSettimanali: '20 ore settimanali', qualifica: 'Operaia' };
  const segments = segmentiContrattoAssunzione(data, { ragione_sociale: 'M2I S.R.L.' });
  assert.deepEqual(segments.map(parts => parts.map(part => part.text).join('')),
    paragrafiContrattoAssunzione(data, { ragione_sociale: 'M2I S.R.L.' }));
  for (const value of ['01/12/2026', '31/03/2027', '20 ORE SETTIMANALI', 'OPERAIA']) {
    assert.ok(segments.flat().some(part => part.bold && part.text.includes(value)), value);
  }
  assert.equal(segments[0][0].bold, false);
});

test('il corpo conserva esattamente il testo del Word con i valori originali', () => {
  const data = { sesso: 'F', dataInizio: '2026-07-02', dataFine: '2026-08-07',
    tipoContratto: 'Determinato', tipoOrario: 'Part Time', codiceComunicazione: '0000000000000000',
    sedeLavoro: 'via del Fontanile Anagnino 138 – 00118 Roma',
    oreSettimanali: 'PART TIME 8 ORE SETTIMANALI', qualifica: 'OPERAIO ADDETTO ALLE PULIZIE',
    livelloCCNL: '1°', periodoProva: '10', ccnlRetribuzione: 'CCNL PULIZIA' };
  const indexes = [13, 15, 17, 19, 21, 23, 25, 27, 29, 32, 33, 34, 35, 36, 38];
  assert.deepEqual(paragrafiContrattoAssunzione(data),
    indexes.map(index => paragrafoOriginaleContrattoAssunzione(index)));
  assert.deepEqual(segmentiRecapitiContrattoAssunzione().map(parts => parts.map(part => part.text).join('')),
    [50, 52, 53, 54].map(index => paragrafoOriginaleContrattoAssunzione(index)));
  for (const index of [58, 59, 61, 64, 65]) assert.ok(paragrafoOriginaleContrattoAssunzione(index));
});
